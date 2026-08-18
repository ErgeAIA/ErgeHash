use serde::{Deserialize, Serialize};

/// 哈希算法枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HashAlgorithm {
    SHA256,
    MD5,
    SHA1,
    SHA512,
    Crc32,
}

impl HashAlgorithm {
    /// 获取算法的字符串名称（小写，与前端 HashAlgorithm 类型一致）
    pub fn as_str(&self) -> &'static str {
        match self {
            HashAlgorithm::SHA256 => "sha256",
            HashAlgorithm::MD5 => "md5",
            HashAlgorithm::SHA1 => "sha1",
            HashAlgorithm::SHA512 => "sha512",
            HashAlgorithm::Crc32 => "crc32",
        }
    }
}

impl std::fmt::Display for HashAlgorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// 哈希计算结果状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HashStatus {
    Success,
    Mismatch,
    Error,
}

/// 哈希计算结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    /// 文件路径
    pub file_path: String,
    /// 使用的算法
    pub algorithm: HashAlgorithm,
    /// 哈希值
    pub hash_value: String,
    /// 耗时（秒）
    pub elapsed_time: f64,
    /// 状态
    pub status: HashStatus,
    /// 是否来自缓存
    pub from_cache: bool,
    /// 结构化错误码（i18n 用，仅状态为 Error 时有值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    /// 错误动态参数（文件路径、系统错误等不可枚举内容，供前端文案插值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_detail: Option<String>,
    /// 兜底错误信息（当 error_code 在前端无映射时显示）。后端不再写入本地化文案。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// 哈希计算进度
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashProgress {
    /// 文件路径
    pub file_path: String,
    /// 进度百分比 0-100
    pub progress: u8,
    /// 已读取字节数
    pub bytes_read: u64,
    /// 总字节数
    pub total_bytes: u64,
}

/// 批量处理结果（扁平结构，统计信息直接平铺）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    /// 所有文件的结果
    pub results: Vec<HashResult>,
    /// 总文件数
    pub total: usize,
    /// 成功数
    pub success: usize,
    /// 错误数
    pub error: usize,
    /// 不匹配数
    pub mismatch: usize,
    /// 总耗时（秒）
    pub total_time: f64,
}

/// 批量处理进度（每完成一个文件发送一次）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProgress {
    /// 已完成文件数
    pub done: usize,
    /// 总文件数
    pub total: usize,
}

/// 历史记录条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    /// 文件路径
    pub file_path: String,
    /// 算法
    pub algorithm: String,
    /// 哈希值
    pub hash_value: String,
    /// 时间戳
    pub timestamp: String,
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// 默认算法
    pub algorithm: String,
    /// 主题
    pub theme: String,
    /// 语言
    pub language: String,
    /// 拖入文件后是否自动开始校验（默认 false）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_calculate: Option<bool>,
    /// 是否启用界面动画（默认 true）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animations: Option<bool>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            algorithm: "sha256".to_string(),
            theme: "dark".to_string(),
            language: "zh".to_string(),
            auto_calculate: Some(false),
            animations: Some(true),
        }
    }
}

/// 验证文件导入条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationEntry {
    /// 算法
    pub algorithm: String,
    /// 哈希值
    pub hash_value: String,
    /// 文件名
    pub filename: String,
}

/// 右键菜单启动请求（由命令行参数解析得到，传递给报告窗口）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenuRequest {
    /// 操作类型：compute（计算单个/多个哈希）、compare（比较多个文件一致性）或 verify（用校验文件验证）
    pub operation: String,
    /// 指定算法
    pub algorithm: HashAlgorithm,
    /// 传入的文件路径
    pub paths: Vec<String>,
}

/// 校验文件验证结果（右键菜单「用校验文件验证」时由后端逐条目比对得到）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    /// 被校验文件的路径（相对校验文件目录解析后的绝对/相对路径）
    pub file_path: String,
    /// 算法（小写，如 sha256）
    pub algorithm: String,
    /// 校验文件中的期望哈希
    pub expected: String,
    /// 实际计算得到的哈希（error 时为空）
    pub actual: String,
    /// 状态：match（一致）/ mismatch（不一致）/ error（文件缺失或计算失败）
    pub status: String,
    /// 结构化错误码（i18n 用，仅 status 为 error 时有值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    /// 错误动态参数（文件路径、系统错误等不可枚举内容，供前端文案插值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_detail: Option<String>,
    /// 兜底错误信息（当 error_code 在前端无映射时显示）。后端不再写入本地化文案。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}
