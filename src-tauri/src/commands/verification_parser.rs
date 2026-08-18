use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use serde::Serialize;

use crate::models::VerificationEntry;

/// 资源自愈上限（避免 OOM / 内存尖峰）
const SIZE_CAP: usize = 50_000_000; // 单文件最大读取字节数（50MB）
const LINE_CAP: usize = 65_536; // 单行最大字符数（64KB）
const ENTRY_CAP: usize = 100_000; // 最大解析条目数

/// 无法解析的孤立行（用于透明告警，不阻断其余行）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnrecognizedLine {
    pub line_no: usize,
    pub content: String,
}

/// 自愈告警信号（结构化，便于前端展示）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseWarning {
    pub kind: String, // fileTooLarge | lineTooLong | entryCapHit | duplicateName | encodingFallback
    pub detail: Option<String>,
}

/// 解析报告：所有结果均返回，失败不中止
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseReport {
    pub entries: Vec<VerificationEntry>,
    pub unrecognized: Vec<UnrecognizedLine>,
    pub warnings: Vec<ParseWarning>,
    /// 报告不完整（超尺寸 / 超条目上限）
    pub truncated: bool,
}

/// 支持的文件名裸哈希（无文件名时从源文件名派生）
pub(crate) fn parse_verification_file(file_path: &str) -> Result<ParseReport, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!(
            "{}|{}",
            crate::models::error_codes::VERIFY_FILE_NOT_FOUND,
            file_path
        ));
    }

    let mut file_too_large = false;
    let bytes = open_bounded(path, &mut file_too_large).map_err(|e| {
        format!(
            "{}|{}",
            crate::models::error_codes::VERIFY_FILE_READ_FAILED,
            e
        )
    })?;

    // 编码自愈：非法 UTF-8 用 lossy 尽力解析
    let (content, encoding_fallback) = match String::from_utf8(bytes) {
        Ok(s) => (s, false),
        Err(e) => (String::from_utf8_lossy(&e.into_bytes()).into_owned(), true),
    };
    let content = content.strip_prefix('\u{feff}').unwrap_or(&content);

    let source_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let mut entries: Vec<VerificationEntry> = Vec::new();
    let mut unrecognized: Vec<UnrecognizedLine> = Vec::new();
    let mut warnings: Vec<ParseWarning> = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    let mut truncated = file_too_large;

    if file_too_large {
        warnings.push(ParseWarning {
            kind: "fileTooLarge".into(),
            detail: Some(SIZE_CAP.to_string()),
        });
    }
    if encoding_fallback {
        warnings.push(ParseWarning {
            kind: "encodingFallback".into(),
            detail: None,
        });
    }

    for (idx, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        // 注释行（SFV 约定 ; 或 # 开头）
        if line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        // 单行超限：跳过 + 告警，避免内存尖峰
        if line.chars().count() > LINE_CAP {
            warnings.push(ParseWarning {
                kind: "lineTooLong".into(),
                detail: Some((idx + 1).to_string()),
            });
            unrecognized.push(UnrecognizedLine {
                line_no: idx + 1,
                content: line.to_string(),
            });
            continue;
        }
        match parse_line(line, &source_stem) {
            Some((algo, hash, filename)) => {
                if entries.len() >= ENTRY_CAP {
                    truncated = true;
                    warnings.push(ParseWarning {
                        kind: "entryCapHit".into(),
                        detail: Some(ENTRY_CAP.to_string()),
                    });
                    break;
                }
                let key = filename.to_lowercase();
                if !seen_names.insert(key) {
                    warnings.push(ParseWarning {
                        kind: "duplicateName".into(),
                        detail: Some(filename.clone()),
                    });
                }
                entries.push(VerificationEntry {
                    filename,
                    algorithm: algo,
                    hash_value: hash,
                });
            }
            None => {
                unrecognized.push(UnrecognizedLine {
                    line_no: idx + 1,
                    content: line.to_string(),
                });
            }
        }
    }

    Ok(ParseReport {
        entries,
        unrecognized,
        warnings,
        truncated,
    })
}

/// 读取文件，超限则只取前 SIZE_CAP 字节（size 上限自愈）
fn open_bounded(path: &Path, too_large: &mut bool) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| {
        format!(
            "{}|{}",
            crate::models::error_codes::VERIFY_FILE_READ_FAILED,
            e
        )
    })?;
    let size = file
        .metadata()
        .map(|m| m.len() as usize)
        .unwrap_or(0);
    let mut reader: Box<dyn Read> = if size > SIZE_CAP {
        *too_large = true;
        Box::new(BufReader::new(file).take(SIZE_CAP as u64))
    } else {
        Box::new(BufReader::new(file))
    };
    let mut buf = Vec::with_capacity(size.min(SIZE_CAP));
    reader
        .read_to_end(&mut buf)
        .map_err(|e| e.to_string())?;
    Ok(buf)
}

/// 逐行嗅探：按格式优先级解析（无正则，纯 std 字符串操作）
fn parse_line(line: &str, source_stem: &str) -> Option<(String, String, String)> {
    if let Some(r) = parse_bsd(line) {
        return Some(r);
    }
    if let Some(r) = parse_own(line) {
        return Some(r);
    }
    if let Some(r) = parse_gnu(line) {
        return Some(r);
    }
    if let Some(r) = parse_sfv(line) {
        return Some(r);
    }
    if let Some(h) = parse_bare(line) {
        if source_stem.is_empty() {
            return None;
        }
        let algo = infer_algo_by_len(&h)?;
        return Some((algo, h, source_stem.to_string()));
    }
    None
}

/// BSD / --tag：`MD5 (name) = hash`（算法名显式）
fn parse_bsd(line: &str) -> Option<(String, String, String)> {
    const ALGOS: &[&str] = &["MD5", "SHA1", "SHA256", "SHA512", "CRC32"];
    for a in ALGOS {
        if !line.starts_with(a) {
            continue;
        }
        let rest = &line[a.len()..];
        let open = rest.find('(')?;
        let close = rest[open..].find(')')?;
        let name = rest[open + 1..open + close].trim().to_string();
        if name.is_empty() {
            return None;
        }
        let after = &rest[open + close + 1..];
        let eq = after.find('=')?;
        let hash = after[eq + 1..].trim().to_string();
        if !is_hex(&hash) {
            return None;
        }
        return Some((a.to_lowercase(), hash, name));
    }
    None
}

/// 自有格式：`ALGO: hash  filename`（冒号 + 两空格）
fn parse_own(line: &str) -> Option<(String, String, String)> {
    let colon = line.find(':')?;
    let algo_part = line[..colon].trim();
    if algo_part.is_empty() || algo_part.chars().any(|c| c.is_whitespace()) {
        return None;
    }
    let algo = algo_part.to_lowercase();
    if !is_known_algo(&algo) {
        return None;
    }
    let rest = line[colon + 1..].trim_start();
    let mut split = rest.splitn(2, "  ");
    let hash = split.next()?.trim();
    let name = split.next()?.trim();
    if hash.is_empty() || name.is_empty() || !is_hex(hash) {
        return None;
    }
    Some((algo, hash.to_string(), name.to_string()))
}

/// GNU coreutils：`<hex>  name`（文本）或 `<hex> *name`（二进制）
fn parse_gnu(line: &str) -> Option<(String, String, String)> {
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() && is_hex_byte(bytes[i]) {
        i += 1;
    }
    if i == 0 || i >= bytes.len() || bytes[i] != b' ' {
        return None;
    }
    let hash = &line[..i];
    let mut rest = &line[i + 1..];
    if rest.starts_with('*') {
        rest = &rest[1..];
    }
    let name = rest.trim_start();
    if name.is_empty() {
        return None;
    }
    let algo = infer_algo_by_len(hash)?;
    Some((algo, hash.to_string(), name.to_string()))
}

/// SFV / 通用尾随哈希：`name <hash>`（hash 长度可推断算法）
fn parse_sfv(line: &str) -> Option<(String, String, String)> {
    let trimmed = line.trim_end();
    let space = trimmed.rfind(char::is_whitespace)?;
    let name = trimmed[..space].trim();
    let hash = trimmed[space..].trim();
    if name.is_empty() || !is_hex(hash) {
        return None;
    }
    let algo = infer_algo_by_len(hash)?;
    Some((algo, hash.to_string(), name.to_string()))
}

/// 裸哈希单行（文件名由 source_stem 派生）
fn parse_bare(line: &str) -> Option<String> {
    if is_hex(line) && infer_algo_by_len(line).is_some() {
        Some(line.to_string())
    } else {
        None
    }
}

fn is_hex_byte(b: u8) -> bool {
    b.is_ascii_digit() || (b'A'..=b'F').contains(&b) || (b'a'..=b'f').contains(&b)
}

fn is_hex(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(is_hex_byte)
}

fn is_known_algo(a: &str) -> bool {
    matches!(a, "md5" | "sha1" | "sha256" | "sha512" | "crc32")
}

fn infer_algo_by_len(hash: &str) -> Option<String> {
    match hash.len() {
        8 => Some("crc32".into()),
        32 => Some("md5".into()),
        40 => Some("sha1".into()),
        64 => Some("sha256".into()),
        128 => Some("sha512".into()),
        _ => None,
    }
}

#[tauri::command]
pub fn import_verification_file(file_path: String) -> Result<ParseReport, String> {
    parse_verification_file(&file_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(algo: &str, hash: &str, filename: &str) -> VerificationEntry {
        VerificationEntry {
            filename: filename.into(),
            algorithm: algo.into(),
            hash_value: hash.into(),
        }
    }

    #[test]
    fn parse_own_format() {
        let r = parse_line("SHA256: abc123def456  filename.txt", "vf")
            .expect("own format");
        assert_eq!(r, ("sha256".into(), "abc123def456".into(), "filename.txt".into()));
    }

    #[test]
    fn parse_gnu_text_and_binary() {
        let text = parse_line("d41d8cd98f00b204e9800998ecf8427e  file.txt", "vf")
            .expect("gnu text");
        assert_eq!(text, ("md5".into(), "d41d8cd98f00b204e9800998ecf8427e".into(), "file.txt".into()));
        let bin = parse_line("d41d8cd98f00b204e9800998ecf8427e *file.bin", "vf")
            .expect("gnu binary");
        assert_eq!(bin.2, "file.bin");
    }

    #[test]
    fn parse_bsd_tag() {
        let r = parse_line("MD5 (file.txt) = d41d8cd98f00b204e9800998ecf8427e", "vf")
            .expect("bsd");
        assert_eq!(r, ("md5".into(), "d41d8cd98f00b204e9800998ecf8427e".into(), "file.txt".into()));
    }

    #[test]
    fn parse_sfv_crc32() {
        let r = parse_line("my file.zip 0A1B2C3D", "vf").expect("sfv");
        assert_eq!(r, ("crc32".into(), "0A1B2C3D".into(), "my file.zip".into()));
    }

    #[test]
    fn parse_bare_uses_source_stem() {
        let r = parse_line("d41d8cd98f00b204e9800998ecf8427e", "archive")
            .expect("bare");
        assert_eq!(r, ("md5".into(), "d41d8cd98f00b204e9800998ecf8427e".into(), "archive".into()));
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_line("Hello, this is not a hash", "vf").is_none());
        assert!(parse_line("just text without hex", "vf").is_none());
    }

    #[test]
    fn full_report_handles_mixed_and_comments() {
        let input = "d41d8cd98f00b204e9800998ecf8427e  a.txt\n\
                     # this is a comment\n\
                     MD5 (b.txt) = d41d8cd98f00b204e9800998ecf8427e\n\
                     not a hash at all\n\
                     SHA256: abc  c.txt\n";
        // 模拟整文件解析：写临时逻辑等价
        let mut entries = Vec::new();
        for raw in input.lines() {
            if let Some(r) = parse_line(raw.trim(), "vf") {
                entries.push(entry(&r.0, &r.1, &r.2));
            }
        }
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].filename, "a.txt");
        assert_eq!(entries[1].filename, "b.txt");
        assert_eq!(entries[2].filename, "c.txt");
    }
}
