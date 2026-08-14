import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAppStore } from "@/store/appStore";
import type { HashAlgorithm } from "@/services/types";

/** 哈希值长度与算法的映射表 */
const HASH_LENGTH_ALGO_MAP: Record<number, HashAlgorithm> = {
  8: "crc32",
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
  crc32: "CRC32",
};

/** 哈希验证区域组件：单一「开始校验」主按钮 */
export function HashVerification() {
  const { t } = useTranslation();
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const setSelectedAlgorithms = useAppStore((s) => s.setSelectedAlgorithms);

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
          setSelectedAlgorithms([algo]);
          setDetectedAlgo(algo);
          return;
        }
      }
      setDetectedAlgo(null);
    },
    [setExpectedHash, setSelectedAlgorithms],
  );

  return (
    <section className="flex shrink-0 flex-col gap-3">
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

      {/* 自动检测到的算法提示 */}
      {detectedAlgo && (
        <div className="text-xs text-muted-foreground">
          {t("auto_detected")}: {ALGO_DISPLAY_NAME[detectedAlgo]}
        </div>
      )}
    </section>
  );
}
