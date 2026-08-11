import { useState, useCallback, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

/** 预期哈希值输入区块（二区）：输入哈希值并按长度自动推断算法 */
export function ExpectedHashSection({ className }: { className?: string }) {
  const { t } = useTranslation();
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);

  /* 输入框聚焦状态 */
  const [hashFocused, setHashFocused] = useState(false);
  /* 自动检测到的算法提示状态 */
  const [detectedAlgo, setDetectedAlgo] = useState<HashAlgorithm | null>(null);

  /** 预期哈希值变更：同步到 store 并按长度推断算法 */
  const handleExpectedHashChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setExpectedHash(value);

      const trimmed = value.trim();
      if (trimmed.includes("\n")) {
        setDetectedAlgo(null);
        return;
      }

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

  return (
    <section className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* 预期哈希值输入 */}
      <div className="relative shrink-0">
        <Textarea
          value={expectedHash}
          onChange={handleExpectedHashChange}
          onFocus={() => setHashFocused(true)}
          onBlur={() => setHashFocused(false)}
          placeholder=""
          className="h-[72px] resize-none pr-8"
        />
        {/* 空态居中提示：与文件列表/结果区空态提示风格一致 */}
        {!expectedHash.trim() && !hashFocused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("expected_hash_placeholder")}
          </div>
        )}
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
        <div className="shrink-0 text-xs text-muted-foreground">
          {t("auto_detected")}: {ALGO_DISPLAY_NAME[detectedAlgo]}
        </div>
      )}
    </section>
  );
}
