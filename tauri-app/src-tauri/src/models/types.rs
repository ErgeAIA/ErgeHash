use serde::{Deserialize, Serialize};

/// 哈希算法枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HashAlgorithm {
    SHA256,
    MD5,
    SHA1,
    SHA512,
}

impl HashAlgorithm {
    /// 获取算法的字符串名称（小写，与前端 HashAlgorithm 类型一致）
    pub fn as_str(&self) -> &'static str {
        match self {
            HashAlgorithm::SHA256 => "sha256",
            HashAlgorithm::MD5 => "md5",
            HashAlgorithm::SHA1 => "sha1",
            HashAlgorithm::SHA512 => "sha512",
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
    /// 错误信息（仅状态为 Error 或 Mismatch 时有值）
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
    /// 窗口几何信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_geometry: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            algorithm: "sha256".to_string(),
            theme: "light".to_string(),
            language: "zh".to_string(),
            window_geometry: None,
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
