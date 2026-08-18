//! 集中管理所有用户可见错误的错误码（i18n 用）。
//!
//! 设计：后端只回传结构化错误码（`error_code`）与可选动态参数（`error_detail`，
//! 用于文件路径、系统错误等不可枚举的内容），**不回传任何本地化文案**。
//! 前端根据当前语言把错误码映射为对应文案，从而实现错误信息随界面语言切换，
//! 且二进制中不含硬编码的中/英文字符串。
//!
//! 命名约定：大写蛇形（UPPER_SNAKE），按功能域前缀分组。

// ===== 文件 / 路径相关 =====
pub const FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";
pub const PATH_TRAVERSAL: &str = "PATH_TRAVERSAL";
pub const DIR_NOT_FOUND: &str = "DIR_NOT_FOUND";
pub const PATH_NOT_DIR: &str = "PATH_NOT_DIR";
pub const READ_FILE_FAILED: &str = "READ_FILE_FAILED";
pub const UNSUPPORTED_ALGORITHM: &str = "UNSUPPORTED_ALGORITHM";

// ===== 计算流程 =====
pub const COMPUTE_CANCELLED: &str = "COMPUTE_CANCELLED";
pub const BATCH_THREAD_PANIC: &str = "BATCH_THREAD_PANIC";

// ===== 记事本（Windows 专属能力） =====
pub const OPEN_NOTEPAD_FAILED: &str = "OPEN_NOTEPAD_FAILED";
pub const NOTEPAD_WINDOWS_ONLY: &str = "NOTEPAD_WINDOWS_ONLY";

// ===== 校验文件导出 =====
pub const EXPORT_DIR_UNRESOLVABLE: &str = "EXPORT_DIR_UNRESOLVABLE";
pub const EXPORT_ILLEGAL_FILENAME: &str = "EXPORT_ILLEGAL_FILENAME";
pub const EXPORT_FILENAME_NEWLINE: &str = "EXPORT_FILENAME_NEWLINE";
pub const EXPORT_WRITE_FAILED: &str = "EXPORT_WRITE_FAILED";
pub const WRITE_CSV_FAILED: &str = "WRITE_CSV_FAILED";
pub const SERIALIZE_JSON_FAILED: &str = "SERIALIZE_JSON_FAILED";
pub const WRITE_JSON_FAILED: &str = "WRITE_JSON_FAILED";

// ===== 校验文件导入解析 =====
pub const VERIFY_FILE_NOT_FOUND: &str = "VERIFY_FILE_NOT_FOUND";
pub const VERIFY_FILE_READ_FAILED: &str = "VERIFY_FILE_READ_FAILED";

// ===== 窗口 / 命令 =====
pub const MAIN_WINDOW_MISSING: &str = "MAIN_WINDOW_MISSING";

// ===== 配置 / 历史读写 =====
pub const CONFIG_DIR_CREATE_FAILED: &str = "CONFIG_DIR_CREATE_FAILED";
pub const CONFIG_SERIALIZE_FAILED: &str = "CONFIG_SERIALIZE_FAILED";
pub const CONFIG_WRITE_FAILED: &str = "CONFIG_WRITE_FAILED";
pub const CONFIG_READ_FAILED: &str = "CONFIG_READ_FAILED";
pub const CONFIG_PARSE_FAILED: &str = "CONFIG_PARSE_FAILED";
pub const HISTORY_DIR_CREATE_FAILED: &str = "HISTORY_DIR_CREATE_FAILED";
pub const HISTORY_READ_FAILED: &str = "HISTORY_READ_FAILED";
pub const HISTORY_PARSE_FAILED: &str = "HISTORY_PARSE_FAILED";
pub const HISTORY_SERIALIZE_FAILED: &str = "HISTORY_SERIALIZE_FAILED";
pub const HISTORY_WRITE_FAILED: &str = "HISTORY_WRITE_FAILED";
pub const HISTORY_CLEAR_FAILED: &str = "HISTORY_CLEAR_FAILED";
pub const APP_DATA_DIR_FAILED: &str = "APP_DATA_DIR_FAILED";
