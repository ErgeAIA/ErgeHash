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
 * 预期哈希语义分隔符：仅中英文逗号与分号。
 * 这四类是用户显式分段意图；空格与换行不作为"新增行"的分隔符，
 * 空格直接清除、换行仅作自然分隔（多余换行经过滤自然消解）。
 */
const EXPECTED_HASH_SEPARATORS = /[,，;；]+/g;

/**
 * 规范化用户输入的预期哈希值：
 * - 语义分隔符（, ， ; ；）统一替换为换行
 * - 行内所有空白（含空格/回车）直接清除，不制造新行
 * - 逐行 trim 并过滤空行（连续换行不会留下空行，不膨胀行数）
 */
export function normalizeExpectedHash(value: string): string {
  return value
    .replace(EXPECTED_HASH_SEPARATORS, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, "").trim())
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
