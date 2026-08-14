/** 常见校验文件扩展名（含点，小写）——直接判定为校验文件 */
const CHECKSUM_EXT = new Set<string>([
  ".md5", ".sha1", ".sha224", ".sha256", ".sha384", ".sha512",
  ".sfv", ".crc",
]);

/**
 * 歧义文本扩展名 + 无扩展名——无法确定，需内容嗅探兜底。
 * 注意：无扩展名文件也可能为二进制（如 /usr/bin/foo），嗅探受调用方的 MAX_SNIFF 上限约束。
 */
const AMBIGUOUS_TEXT_EXT = new Set<string>([
  ".txt", ".log", ".asc", ".text", "",
]);

/** 单次拖放允许内容嗅探的最大文件数；超出则剩余歧义文件降级为普通文件，避免 IPC 风暴 */
export const MAX_SNIFF = 200;

/** 取小写扩展名（含点），无扩展名返回空串 */
function getExt(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  const idx = base.lastIndexOf(".");
  if (idx <= 0) return ""; // 无扩展名或隐藏文件（如 .gitignore）
  return base.slice(idx).toLowerCase();
}

export interface ClassifiedPaths {
  /** 扩展名命中的校验文件（走解析 + file 模式） */
  checksum: string[];
  /** 歧义文本/无扩展名文件（需内容嗅探兜底，受 MAX_SNIFF 约束） */
  ambiguous: string[];
  /** 明确非校验的文档/源码/二进制（直接当普通待哈希文件，不嗅探） */
  regular: string[];
}

/**
 * 仅按扩展名分类拖入路径（纯同步，无 IPC）：
 * - 命中 CHECKSUM_EXT → checksum；
 * - 命中 AMBIGUOUS_TEXT_EXT（含无扩展名）→ ambiguous（由调用方嗅探兜底）；
 * - 其余（.csv/.json/.md/.ts 等及二进制）→ regular（不嗅探，避免无谓 IPC 与误判）。
 */
export function classifyDroppedPaths(paths: string[]): ClassifiedPaths {
  const result: ClassifiedPaths = { checksum: [], ambiguous: [], regular: [] };
  for (const p of paths) {
    const ext = getExt(p);
    if (CHECKSUM_EXT.has(ext)) {
      result.checksum.push(p);
    } else if (AMBIGUOUS_TEXT_EXT.has(ext)) {
      result.ambiguous.push(p);
    } else {
      result.regular.push(p);
    }
  }
  return result;
}
