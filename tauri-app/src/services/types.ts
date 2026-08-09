/** 哈希算法类型 */
export type HashAlgorithm = "sha256" | "md5" | "sha1" | "sha512";

/** 哈希计算结果 */
export interface HashResult {
  /** 文件路径 */
  path: string;
  /** 使用的算法 */
  algorithm: HashAlgorithm;
  /** 哈希值 */
  hash: string;
  /** 耗时（秒） */
  elapsed: number;
  /** 是否来自缓存 */
  fromCache: boolean;
}

/** 哈希计算进度事件 */
export interface HashProgress {
  /** 文件路径 */
  filePath: string;
  /** 进度百分比 0-100 */
  progress: number;
}

/** 批量校验结果 */
export interface BatchResult {
  /** 总文件数 */
  total: number;
  /** 成功数 */
  success: number;
  /** 失败数 */
  errors: number;
  /** 总耗时（秒） */
  totalTime: number;
  /** 各文件结果 */
  results: HashResult[];
}

/** 批量校验统计信息 */
export interface BatchStatistics {
  /** 总文件数 */
  total: number;
  /** 成功数 */
  success: number;
  /** 失败数 */
  errors: number;
  /** 已缓存数 */
  cached: number;
}

/** 历史记录条目 */
export interface HistoryEntry {
  /** 文件路径 */
  path: string;
  /** 使用的算法 */
  algorithm: HashAlgorithm;
  /** 哈希值 */
  hash: string;
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
  /** 计算完成后自动复制 */
  autoCopy: boolean;
  /** 窗口位置信息 */
  windowGeometry: string | null;
}

/** 验证文件条目 */
export interface VerificationEntry {
  /** 文件名 */
  filename: string;
  /** 哈希值 */
  hash: string;
  /** 算法 */
  algorithm: HashAlgorithm;
}

/** 文件列表项状态 */
export type FileItemStatus = "success" | "mismatch" | "error" | undefined;

/** 文件列表项 */
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
