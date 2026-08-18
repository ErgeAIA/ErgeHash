/** 哈希算法类型（与后端 HashAlgorithm serde lowercase 一致） */
export type HashAlgorithm = "sha256" | "md5" | "sha1" | "sha512" | "crc32";

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
  /** 结构化错误码（i18n 用，仅 status=error 时有值） */
  errorCode?: string;
  /** 错误动态参数（文件路径、系统错误等不可枚举内容，供文案插值） */
  errorDetail?: string;
  /** 兜底错误信息（errorCode 无前端映射时显示） */
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
  /** 拖入文件后是否自动开始校验（默认 false） */
  autoCalculate?: boolean;
  /** 是否启用界面动画（默认 true） */
  animations?: boolean;
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

/** 无法解析的孤立行（透明告警用） */
export interface UnrecognizedLine {
  lineNo: number;
  content: string;
}

/** 解析告警信号 */
export interface ParseWarning {
  kind: "fileTooLarge" | "lineTooLong" | "entryCapHit" | "duplicateName" | "encodingFallback";
  detail?: string;
}

/** 导入校验文件的解析报告：失败不中止，结构化返回 */
export interface VerificationParseReport {
  entries: VerificationEntry[];
  unrecognized: UnrecognizedLine[];
  warnings: ParseWarning[];
  /** 报告不完整（超尺寸 / 超条目上限） */
  truncated: boolean;
}

/** 校验文件批量导出报告：按算法在每个源文件同目录生成同名（加扩展名）校验文件 */
export interface VerificationExportReport {
  /** 成功写入的校验文件路径列表 */
  written: string[];
  /** 因无可用哈希（错误 / 空值）而跳过的条目数 */
  skipped: number;
  /** 失败条目（含路径与原因） */
  errors: VerificationExportError[];
}

/** 单条导出失败 */
export interface VerificationExportError {
  path: string;
  /** 结构化错误码（i18n 用） */
  errorCode: string;
  /** 错误动态参数（供文案插值） */
  errorDetail?: string;
  /** 兜底错误信息（errorCode 无映射时显示） */
  errorMessage?: string;
}

/** 文件列表项状态：computed=已计算但未验证, success=验证匹配, mismatch=验证不匹配, error=计算出错, undefined=未计算 */
export type FileItemStatus = "computed" | "success" | "mismatch" | "error" | undefined;

/** 单个算法子结果（文件 × 算法 二维，避免多算法相互覆盖） */
export interface FileResult {
  /** 使用的算法 */
  algorithm: HashAlgorithm;
  /** 哈希值 */
  hashValue: string;
  /** 耗时（秒） */
  elapsedTime: number;
  /** 状态 */
  status: FileItemStatus;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 结构化错误码（i18n 用，仅 status=error 时有值） */
  errorCode?: string;
  /** 错误动态参数（文件路径、系统错误等不可枚举内容，供文案插值） */
  errorDetail?: string;
  /** 兜底错误信息（errorCode 无映射时显示） */
  errorMessage?: string;
}

/** 文件列表项（前端 store 内部结构，非后端 DTO） */
export interface FileItem {
  /** 文件路径 */
  path: string;
  /** 文件大小（字节），由 get_file_metadata 填充 */
  size?: number;
  /** 文件角色：source 参与哈希计算；verification 为校验文件，仅展示与回填，不参与计算 */
  role?: "source" | "verification";
  /** 校验文件解析出的条目（仅 role=verification 时有效），用于在文件列表中以子级形式展示 */
  entries?: VerificationEntry[];
  /** 主导哈希值（取第一个子结果，仅供兼容单值场景） */
  hashValue?: string;
  /** 汇总状态（由 results 推导：error > mismatch > computed） */
  status?: FileItemStatus;
  /** 结构化错误码（i18n 用，仅 status=error 时有值） */
  errorCode?: string;
  /** 错误动态参数（文件路径、系统错误等不可枚举内容，供文案插值） */
  errorDetail?: string;
  /** 错误信息（兜底） */
  errorMessage?: string;
  /** 每个算法一行子结果，按算法维度累积 */
  results: FileResult[];
}
