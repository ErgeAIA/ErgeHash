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
export const ALGO_DISPLAY_NAME: Record<HashAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  sha512: "SHA512",
  crc32: "CRC32",
};

/** 根据哈希字符串长度自动推断算法（单行十六进制） */
export function detectHashAlgorithm(value: string): HashAlgorithm | null {
  const trimmed = value.trim();
  if (trimmed.includes("\n")) return null;

  const cleaned = trimmed.replace(/\s/g, "");
  if (cleaned.length > 0 && /^[0-9a-f]+$/i.test(cleaned)) {
    return HASH_LENGTH_ALGO_MAP[cleaned.length] ?? null;
  }
  return null;
}
