import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { startBatchValidation } from "@/services/api";
import type { HashAlgorithm } from "@/services/types";

/** 哈希值长度与算法的映射表 */
const HASH_LENGTH_ALGO_MAP: Record<number, HashAlgorithm> = {
  32: "md5",
  40: "sha1",
  64: "sha256",
  128: "sha512",
};

/** 算法显示名（大写形式，与后端 serde UPPERCASE 序列化一致） */
const ALGO_DISPLAY_NAME: Record<HashAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  sha512: "SHA512",
};

/** 哈希验证区域组件：单一「开始校验」主按钮 */
export function HashVerification() {
  const { t } = useTranslation();
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const fileList = useAppStore((s) => s.fileList);
  const algorithm = useAppStore((s) => s.algorithm);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const updateFileByPath = useAppStore((s) => s.updateFileByPath);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setPaused = useAppStore((s) => s.setPaused);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setResultText = useAppStore((s) => s.setResultText);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const addToast = useToastStore((s) => s.addToast);

  // 自动检测到的算法提示状态
  const [detectedAlgo, setDetectedAlgo] = useState<HashAlgorithm | null>(null);

  /** 预期哈希值变更：同步到 store 并按长度推断算法 */
  const handleExpectedHashChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setExpectedHash(value);

      // 仅对单行输入进行算法推断，避免多行场景误判
      const trimmed = value.trim();
      if (trimmed.includes("\n")) {
        setDetectedAlgo(null);
        return;
      }

      // 移除所有空白字符后判断长度与 hex 格式
      const cleaned = trimmed.replace(/\s/g, "");
      if (cleaned.length > 0 && /^[0-9a-f]+$/i.test(cleaned)) {
        const algo = HASH_LENGTH_ALGO_MAP[cleaned.length];
        if (algo) {
          setAlgorithm(algo);
          setDetectedAlgo(algo);
          return;
        }
      }
      setDetectedAlgo(null);
    },
    [setExpectedHash, setAlgorithm],
  );

  /** 开始校验：验证区有输入时先计算全部文件哈希再逐一比对；为空时仅计算哈希 */
  const handleStartVerify = useCallback(async () => {
    if (isCalculating) return;
    if (fileList.length === 0) {
      addToast("error", t("please_add_files"));
      return;
    }

    const paths = fileList.map((f) => f.path);
    const expected = expectedHash.trim();

    // 重置状态
    setCalculating(true);
    setPaused(false);
    setProgress(0);
    setCurrentFile(null);
    setResultText("");
    setStatusMessage("calculating");

    try {
      const batch = await startBatchValidation(paths, algorithm);
      // 批量完成：列表已由 batch-file-complete 事件回填 computed 状态
      setCalculating(false);
      setProgress(100);
      setStatusMessage("completed");

      // 验证区为空：仅计算，统计信息已由 batch-complete 事件写入结果区
      if (!expected) return;

      // 有预期哈希：逐一与计算结果比对
      const expectedLines = expected
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // 仅比对有哈希值的计算结果（错误文件保持 error 状态）
      const computedResults = batch.results.filter((r) => r.hashValue);

      let compText = `\n${t("comparison_results")}\n\n`;
      let matchCount = 0;
      let mismatchCount = 0;

      if (expectedLines.length === 1) {
        // 单行预期值：与所有计算结果比较
        const expectedClean = expectedLines[0].toLowerCase().replace(/\s/g, "");
        if (!/^[0-9a-f]+$/i.test(expectedClean)) {
          setResultText((prev) => prev + `\n⚠ ${t("invalid_hash_format")}\n`);
          return;
        }
        for (const r of computedResults) {
          const fileName = r.filePath.split(/[/\\]/).pop() ?? r.filePath;
          const isMatch = r.hashValue.toLowerCase() === expectedClean;
          updateFileByPath(r.filePath, r.hashValue, isMatch ? "success" : "mismatch");
          if (isMatch) {
            compText += `✓ ${fileName} ${t("match")}\n`;
            matchCount++;
          } else {
            compText += `✗ ${fileName} ${t("mismatch")}\n`;
            mismatchCount++;
          }
        }
      } else {
        // 多行预期值：逐行与计算结果比较
        if (expectedLines.length !== computedResults.length) {
          setResultText((prev) => prev + `\n⚠ ${t("lines_mismatch")}\n`);
          return;
        }
        for (let i = 0; i < expectedLines.length; i++) {
          const expectedClean = expectedLines[i].toLowerCase().replace(/\s/g, "");
          const r = computedResults[i];
          const fileName = r.filePath.split(/[/\\]/).pop() ?? r.filePath;
          if (!/^[0-9a-f]+$/i.test(expectedClean)) {
            compText += `${i + 1}. ✗ ${t("format_error")}\n`;
            mismatchCount++;
            updateFileByPath(r.filePath, r.hashValue, "mismatch");
            continue;
          }
          const isMatch = r.hashValue.toLowerCase() === expectedClean;
          updateFileByPath(r.filePath, r.hashValue, isMatch ? "success" : "mismatch");
          if (isMatch) {
            compText += `${i + 1}. ✓ ${fileName} ${t("match")}\n`;
            matchCount++;
          } else {
            compText += `${i + 1}. ✗ ${fileName} ${t("mismatch")}\n`;
            mismatchCount++;
          }
        }
      }

      compText += `\n---\n${t("total_summary")}: ${computedResults.length} | ${t("match")}: ${matchCount} | ${t("mismatch")}: ${mismatchCount}\n`;
      setResultText((prev) => prev + compText);
    } catch (err) {
      setResultText((prev) => prev + `\n✗ ${String(err)}\n`);
      setCalculating(false);
      setStatusMessage("ready");
    }
  }, [
    isCalculating,
    fileList,
    expectedHash,
    algorithm,
    setCalculating,
    setPaused,
    setProgress,
    setCurrentFile,
    setResultText,
    setStatusMessage,
    updateFileByPath,
    addToast,
    t,
  ]);

  return (
    <section className="flex flex-col gap-3">
      {/* 二级标题 */}
      <h2 className="text-lg font-semibold text-foreground">
        {t("verify_group")}
      </h2>

      {/* 预期哈希值输入 */}
      <div className="relative">
        <Textarea
          value={expectedHash}
          onChange={handleExpectedHashChange}
          placeholder={t("expected_hash_placeholder")}
          className="h-[80px] resize-none pr-8"
        />
        {/* 有内容时显示的清空按钮 */}
        {expectedHash.trim() && (
          <button
            className="absolute right-2 top-2 rounded-full bg-muted p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setExpectedHash("")}
            title={t("clear")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 自动检测到的算法提示 */}
      {detectedAlgo && (
        <div className="text-xs text-muted-foreground">
          {t("auto_detected")}: {ALGO_DISPLAY_NAME[detectedAlgo]}
        </div>
      )}

      {/* 唯一主操作按钮：大圆形运行/播放按钮 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleStartVerify}
          disabled={isCalculating || fileList.length === 0}
          title={t("start_verify")}
          aria-label={t("start_verify")}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all",
            "hover:scale-105 hover:bg-primary/90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
          )}
        >
          {isCalculating ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
          ) : (
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          )}
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {isCalculating ? t("calculating") : t("start_verify")}
          </span>
          <span className="text-xs text-muted-foreground">
            {fileList.length > 0
              ? `${fileList.length} ${fileList.length === 1 ? t("file") : t("files")}`
              : t("please_add_files")}
          </span>
        </div>
      </div>
    </section>
  );
}
