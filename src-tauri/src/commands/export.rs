use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::models::{HashAlgorithm, HashResult, HashStatus};

/// 导出为 CSV（保留原有行为）
#[tauri::command]
pub async fn export_csv(data: Vec<HashResult>, file_path: String) -> Result<(), String> {
    let mut csv = String::from("algorithm,file_path,hash_value,elapsed_time,status\n");
    for r in &data {
        csv.push_str(&format!(
            "{},{},{},{},{:?}\n",
            r.algorithm, r.file_path, r.hash_value, r.elapsed_time, r.status
        ));
    }
    std::fs::write(&file_path, csv)
        .map_err(|e| format!("写入 CSV 失败: {} ({})", e, file_path))
}

/// 导出为 JSON（保留原有行为）
#[tauri::command]
pub async fn export_json(data: Vec<HashResult>, file_path: String) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化 JSON 失败: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("写入 JSON 失败: {} ({})", e, file_path))
}

/// 校验文件导出报告
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationExportReport {
    /// 成功写入的校验文件路径
    pub written: Vec<String>,
    /// 因无可用哈希（错误/空值）而跳过的条目数
    pub skipped: usize,
    /// 失败条目（含路径与原因）
    pub errors: Vec<VerificationExportError>,
}

/// 单条导出失败
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationExportError {
    pub path: String,
    pub message: String,
}

/// 算法 → 校验文件扩展名（不含点）
fn algo_ext(algo: HashAlgorithm) -> &'static str {
    match algo {
        HashAlgorithm::MD5 => "md5",
        HashAlgorithm::SHA1 => "sha1",
        HashAlgorithm::SHA256 => "sha256",
        HashAlgorithm::SHA512 => "sha512",
        HashAlgorithm::Crc32 => "sfv",
    }
}

/// 构造单行校验内容。
/// - CRC32 → SFV 格式（大写 hex，单空格）：`filename HEX`
/// - 文件名以 `-` 开头 → BSD 标签格式（避免被 `sha256sum -c` 误判为选项）：`ALGO (filename) = hash`
/// - 其余 → GNU coreutils 格式（小写 hex，双空格）：`hash  filename`
fn format_line(algo: HashAlgorithm, hash: &str, filename: &str) -> String {
    if algo == HashAlgorithm::Crc32 {
        format!("{} {}\n", filename, hash.to_uppercase())
    } else if filename.starts_with('-') {
        format!("{} ({}) = {}\n", algo.as_str().to_uppercase(), filename, hash.to_lowercase())
    } else {
        format!("{}  {}\n", hash.to_lowercase(), filename)
    }
}

/// 按算法批量生成标准校验文件，写在与源文件同目录、同名（加算法扩展名）。
///
/// 例如 `report.pdf` 勾选 MD5+SHA256 → 在同目录生成 `report.pdf.md5`、`report.pdf.sha256`。
/// CRC32 生成 `.sfv`。写覆盖风险仅限“它自己的旧校验文件”，不会误伤无关文件。
#[tauri::command]
pub async fn export_verification_files(
    data: Vec<HashResult>,
) -> Result<VerificationExportReport, String> {
    let mut report = VerificationExportReport {
        written: Vec::new(),
        skipped: 0,
        errors: Vec::new(),
    };

    // 按源文件路径分组，保证每个源文件只解析一次目录与文件名
    let mut by_file: HashMap<String, Vec<&HashResult>> = HashMap::new();
    for r in &data {
        by_file.entry(r.file_path.clone()).or_default().push(r);
    }

    for (file_path, results) in by_file {
        let path = Path::new(&file_path);
        let parent = match path.parent() {
            Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
            _ => {
                report.errors.push(VerificationExportError {
                    path: file_path.clone(),
                    message: "无法解析源文件所在目录".to_string(),
                });
                continue;
            }
        };
        let basename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => {
                report.errors.push(VerificationExportError {
                    path: file_path.clone(),
                    message: "源文件名包含非法字符".to_string(),
                });
                continue;
            }
        };

        // 文件名含换行/回车会破坏行式格式，跳过并告警
        if basename.contains(['\n', '\r']) {
            report.errors.push(VerificationExportError {
                path: file_path.clone(),
                message: "文件名含换行符，无法安全写入校验文件".to_string(),
            });
            continue;
        }

        for r in results {
            if r.status == HashStatus::Error || r.hash_value.is_empty() {
                report.skipped += 1;
                continue;
            }

            let ext = algo_ext(r.algorithm);
            let target: PathBuf = parent.join(format!("{}.{}", basename, ext));
            let content = format_line(r.algorithm, &r.hash_value, &basename);

            match std::fs::write(&target, content) {
                Ok(()) => report.written.push(target.to_string_lossy().to_string()),
                Err(e) => report.errors.push(VerificationExportError {
                    path: target.to_string_lossy().to_string(),
                    message: format!("写入失败: {}", e),
                }),
            }
        }
    }

    Ok(report)
}
