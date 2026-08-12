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

/**
 * 预期哈希分隔符：逗号/竖线/句号/分号（中英文）及任意空白。
 * 用于把"一段可能混排了多种分隔符的文本"统一拆行。
 */
const EXPECTED_HASH_SEPARATORS = /[,，|。；;\s]+/g;

/**
 * 规范化用户输入的预期哈希值：
 * - 所有分隔符/空白统一替换为换行
 * - 逐行 trim 并过滤空行
 * 不修改哈希字符本身（去除内部空格由比对逻辑负责，避免静默欺骗）。
 */
export function normalizeExpectedHash(value: string): string {
  return value
    .replace(EXPECTED_HASH_SEPARATORS, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * 从（可能多行/多算法的）预期哈希文本中识别所有涉及的算法。
 * 返回去重后的算法列表，顺序按 HASH_LENGTH_ALGO_MAP 稳定排列。
 */
export function detectHashAlgorithms(value: string): HashAlgorithm[] {
  const normalized = normalizeExpectedHash(value);
  if (!normalized) return [];
  const algos = new Set<HashAlgorithm>();
  for (const line of normalized.split("\n")) {
    const algo = detectHashAlgorithm(line);
    if (algo) algos.add(algo);
  }
  return Array.from(algos);
}
