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
 * 预期哈希语义分隔符：中英文逗号、分号、句号。
 * 这六类是用户显式分段意图（含中文句号"。"，常见于多 hash 连写）；
 * 空格与换行不作为"新增行"的分隔符，空格直接清除、换行仅作自然分隔。
 * 注：`|` 不作分隔符——表格式 `文件名 | hash` 中 `|` 后并非独立 hash，切开会引入脏数据。
 */
const EXPECTED_HASH_SEPARATORS = /[,，;；。]+/g;

/**
 * 算法名前缀（大小写不敏感）：用于剥离 `算法名: hash` 这类复制文本中的标签部分。
 * key 取自 HASH_LENGTH_ALGO_MAP，避免硬编码；匹配 `MD5:` / `sha-256:` / `SHA1：` 等。
 */
const ALGO_PREFIX_PATTERN = new RegExp(
  `^(?:${Object.keys(HASH_LENGTH_ALGO_MAP).join("|")})(?:[-_\\s]?):\\s*`,
  "i",
);

/**
 * 剥离单行的算法名前缀（如 `SHA-256: abc...` → `abc...`）。
 * 仅当行首命中已知算法名 + 冒号时才剥离，避免误伤普通文本。
 */
function stripAlgoPrefix(line: string): string {
  return line.replace(ALGO_PREFIX_PATTERN, "");
}

/**
 * 规范化用户输入的预期哈希值：
 * - 语义分隔符（, ， ; ； 。）统一替换为换行
 * - 逐行剥离算法名前缀（`MD5:` 等），再清除行内所有空白（含空格/回车），不制造新行
 * - 过滤空行（连续换行不会留下空行，不膨胀行数）
 */
export function normalizeExpectedHash(value: string): string {
  return value
    .replace(EXPECTED_HASH_SEPARATORS, "\n")
    .split("\n")
    .map((l) => stripAlgoPrefix(l.replace(/\s+/g, "")))
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
