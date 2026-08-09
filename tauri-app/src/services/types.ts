/** 哈希算法类型（与后端 HashAlgorithm serde lowercase 一致） */
export type HashAlgorithm = "sha256" | "md5" | "sha1" | "sha512";

/** 哈希计算结果（与后端 HashResult 契约一致：camelCase 字段） */
export interface HashResult {
  /** 文件路径 */
  filePath: string;
  /** 使用的算法 */
  algorithm: HashAlgorithm;
  /** 哈希值 */
  hashValue: string;
  /** 耗时（秒） */
  elapsedTime: number;
  /** 状态 */
  status: "success" | "mismatch" | "error";
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 错误信息（可选） */
  errorMessage?: string;
}

/** 哈希计算进度事件 */
export interface HashProgress {
  /** 文件路径 */
  filePath: string;
  /** 进度百分比 0-100 */
  progress: number;
  /** 已读取字节数 */
  bytesRead: number;
  /** 总字节数 */
  totalBytes: number;
}

/** 批量校验结果（扁平结构，统计字段平铺） */
export interface BatchResult {
  /** 总文件数 */
  total: number;
  /** 成功数 */
  success: number;
  /** 失败数 */
  error: number;
  /** 不匹配数 */
  mismatch: number;
  /** 总耗时（秒） */
  totalTime: number;
  /** 各文件结果 */
  results: HashResult[];
}

/** 历史记录条目 */
export interface HistoryEntry {
  /** 文件路径 */
  filePath: string;
  /** 使用的算法（存储值恒为小写算法名） */
  algorithm: HashAlgorithm;
  /** 哈希值 */
  hashValue: string;
  /** 时间戳 */
  timestamp: string;
}

/** 应用配置 */
export interface AppConfig {
  /** 默认算法 */
  algorithm: HashAlgorithm;
  /** 主题：light / dark */
  theme: "light" | "dark";
  /** 语言：zh / en */
  language: "zh" | "en";
  /** 窗口位置信息 */
  windowGeometry: string | null;
}

/** 验证文件条目 */
export interface VerificationEntry {
  /** 文件名 */
  filename: string;
  /** 哈希值 */
  hashValue: string;
  /** 算法 */
  algorithm: string;
}

/** 文件列表项状态 */
export type FileItemStatus = "success" | "mismatch" | "error" | undefined;

/** 文件列表项（前端 store 内部结构，非后端 DTO） */
export interface FileItem {
  /** 文件路径 */
  path: string;
  /** 哈希值 */
  hashValue?: string;
  /** 状态 */
  status?: FileItemStatus;
  /** 错误信息 */
  errorMessage?: string;
}
