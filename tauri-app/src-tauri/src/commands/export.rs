use std::fs;
use std::path::Path;

use crate::models::{HashResult, VerificationEntry};

/// 导出为 CSV 格式（UTF-8 BOM）
#[tauri::command]
pub fn export_csv(data: Vec<HashResult>, file_path: String) -> Result<(), String> {
    if data.is_empty() {
        return Err("没有数据可导出".to_string());
    }

    let path = Path::new(&file_path);

    // UTF-8 BOM
    let mut content = String::from("\u{feff}");
    // 表头
    content.push_str("文件路径,算法,哈希值,耗时(秒),状态\n");

    for result in &data {
        let status_str = match result.status {
            crate::models::HashStatus::Success => "成功",
            crate::models::HashStatus::Mismatch => "不匹配",
            crate::models::HashStatus::Error => "错误",
        };
        // 对 CSV 中的逗号和引号进行转义
        let escaped_path = csv_escape(&result.file_path);
        content.push_str(&format!(
            "{},{},{},{:.2},{}\n",
            escaped_path,
            result.algorithm,
            result.hash_value,
            result.elapsed_time,
            status_str,
        ));
    }

    fs::write(path, content.as_bytes())
        .map_err(|e| format!("写入 CSV 文件失败: {}", e))?;

    Ok(())
}

/// 导出为 JSON 格式
#[tauri::command]
pub fn export_json(data: Vec<HashResult>, file_path: String) -> Result<(), String> {
    if data.is_empty() {
        return Err("没有数据可导出".to_string());
    }

    let path = Path::new(&file_path);
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化 JSON 失败: {}", e))?;

    fs::write(path, json.as_bytes())
        .map_err(|e| format!("写入 JSON 文件失败: {}", e))?;

    Ok(())
}

/// 生成验证文件
#[tauri::command]
pub fn generate_verification_file(
    file_path: String,
    algorithm: String,
    hash_value: String,
    output_path: String,
) -> Result<(), String> {
    let path = Path::new(&file_path);
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let content = format!("{}: {}  {}\n", algorithm.to_uppercase(), hash_value, filename);

    let out_path = Path::new(&output_path);
    fs::write(out_path, content.as_bytes())
        .map_err(|e| format!("写入验证文件失败: {}", e))?;

    Ok(())
}

/// 导入验证文件并解析
#[tauri::command]
pub fn import_verification_file(file_path: String) -> Result<Vec<VerificationEntry>, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("读取验证文件失败: {}", e))?;

    let mut entries = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();

        if parts.len() >= 2 {
            // 格式1: SHA256: abc123def456  filename.txt
            // 格式2: abc123def456  filename.txt
            if parts[0].contains(':') {
                let algorithm = parts[0].replace(':', "").to_lowercase();
                let hash_value = parts[1].to_string();
                let filename = if parts.len() > 2 {
                    parts[2..].join(" ")
                } else {
                    "unknown".to_string()
                };
                entries.push(VerificationEntry {
                    algorithm,
                    hash_value,
                    filename,
                });
            } else {
                // 无算法前缀格式
                let hash_value = parts[0].to_string();
                let filename = if parts.len() > 1 {
                    parts[1..].join(" ")
                } else {
                    "unknown".to_string()
                };
                entries.push(VerificationEntry {
                    algorithm: "unknown".to_string(),
                    hash_value,
                    filename,
                });
            }
        }
    }

    Ok(entries)
}

/// CSV 字段转义：如果包含逗号、引号或换行，用双引号包裹
fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
