import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { startBatchValidation } from "@/services/api";
import { ask } from "@tauri-apps/plugin-dialog";

/** 文件列表底部的全局操作按钮：开始校验 + 清空列表 */
export function FileActions() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const expectedHash = useAppStore((s) => s.expectedHash);
  const algorithm = useAppStore((s) => s.algorithm);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setPaused = useAppStore((s) => s.setPaused);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setResultText = useAppStore((s) => s.setResultText);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const updateFileByPath = useAppStore((s) => s.updateFileByPath);
  const clearFiles = useAppStore((s) => s.clearFiles);
  const addToast = useToastStore((s) => s.addToast);

  const hasFiles = fileList.length > 0;

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

  /** 点击清空列表按钮（带确认） */
  const handleClearClick = useCallback(async () => {
    const ok = await ask(t("confirm_clear_files"), { title: t("warning") });
    if (ok) {
      clearFiles();
    }
  }, [clearFiles, t]);

  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleStartVerify();
        }}
        disabled={isCalculating || !hasFiles}
        title={hasFiles ? t("start_verify") : t("please_add_files")}
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleClearClick();
        }}
        disabled={!hasFiles}
        title={t("clear_list")}
        aria-label={t("clear_list")}
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-all",
          "hover:scale-105 hover:bg-destructive/90 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
        )}
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}
