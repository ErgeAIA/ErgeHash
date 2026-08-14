import { useState, useCallback, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { normalizeExpectedHash, detectHashAlgorithms } from "@/lib/hash";

/** 预期哈希值输入区块（二区）：输入哈希值并按长度自动推断算法 */
export function ExpectedHashSection({ className }: { className?: string }) {
  const { t } = useTranslation();
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const setSelectedAlgorithms = useAppStore((s) => s.setSelectedAlgorithms);
  const verificationMode = useAppStore((s) => s.verificationMode);

  /* 输入框聚焦状态 */
  const [hashFocused, setHashFocused] = useState(false);

  /** 预期哈希值变更：仅同步原始值到 store，不在输入过程中改算法选择 */
  const handleExpectedHashChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setExpectedHash(e.target.value);
    },
    [setExpectedHash],
  );

  /** 失焦：规范化（分隔符分行、去空白行）并据内容自动选择算法 */
  const handleExpectedHashBlur = useCallback(() => {
    setHashFocused(false);
    // 导入预览（file 模式）内容由 importedEntries 驱动，不做规范化改写：
    // 否则失焦会触发 setExpectedHash，清空导入条目并误切到 single 模式。
    if (verificationMode === "file") return;
    const normalized = normalizeExpectedHash(expectedHash);
    if (normalized !== expectedHash) {
      setExpectedHash(normalized);
    }
    const algos = detectHashAlgorithms(normalized);
    // 仅当识别到新算法集合时同步算法选择；空输入保留用户上次选择
    if (algos.length > 0) {
      setSelectedAlgorithms(algos);
    }
  }, [expectedHash, setExpectedHash, setSelectedAlgorithms, verificationMode]);

  return (
    <section className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* 预期哈希值输入 */}
      <div className="relative shrink-0">
        <Textarea
          value={expectedHash}
          onChange={handleExpectedHashChange}
          onFocus={() => setHashFocused(true)}
          onBlur={handleExpectedHashBlur}
          placeholder=""
          className="h-[144px] resize-none pr-8 border-primary transition-colors hover:border-primary focus-visible:border-2 focus-visible:!border-primary focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0"
        />
        {/* 空态居中提示：与文件列表/结果区空态提示风格一致 */}
        {!expectedHash.trim() && !hashFocused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("expected_hash_placeholder")}
          </div>
        )}
        {expectedHash.trim() && (
          <Tooltip label={t("clear")}>
            <button
              type="button"
              aria-label={t("clear")}
              className="absolute right-2 top-2 rounded-full bg-muted p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setExpectedHash("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>

    </section>
  );
}
