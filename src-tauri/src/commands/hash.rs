use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::hashing::{file_cache_key, make_hasher, CHUNK_SIZE};
use crate::models::{HashAlgorithm, HashProgress, HashResult, HashStatus, VerifyResult};
use crate::AppState;

/// 计算单个文件哈希值
#[tauri::command]
pub async fn calculate_hash(
    file_path: String,
    algorithm: HashAlgorithm,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<HashResult, String> {
    // 重置状态
    state.cancel_flag.store(false, Ordering::Relaxed);
    state.pause_flag.store(false, Ordering::Relaxed);

    let start_time = Instant::now();

    // 检查缓存
    let path = Path::new(&file_path);
    if let Ok(meta) = path.metadata() {
        let file_size = meta.len();
        let cache_key = file_cache_key(&file_path, file_size, algorithm);
        let cache = state.hash_cache.lock().unwrap();
        if let Some(cached_hash) = cache.get(&cache_key) {
            return Ok(HashResult {
                file_path: file_path.clone(),
                algorithm,
                hash_value: cached_hash.clone(),
                elapsed_time: 0.0,
                status: HashStatus::Success,
                from_cache: true,
                error_code: None,
                error_detail: None,
                error_message: None,
            });
        }
    }

    let (hash_value, _file_size) = do_calculate_hash(&file_path, algorithm, &app, state.inner())?;

    let elapsed = start_time.elapsed().as_secs_f64();

    // 缓存结果
    if let Ok(meta) = path.metadata() {
        let mut cache = state.hash_cache.lock().unwrap();
        cache.insert(
            file_cache_key(&file_path, meta.len(), algorithm),
            hash_value.clone(),
        );
    }

    Ok(HashResult {
        file_path,
        algorithm,
        hash_value,
        elapsed_time: elapsed,
        status: HashStatus::Success,
        from_cache: false,
        error_code: None,
        error_detail: None,
        error_message: None,
    })
}

/// 快速计算文件哈希值（大文件只读部分）
#[tauri::command]
pub async fn quick_calculate_hash(
    file_path: String,
    algorithm: HashAlgorithm,
    _app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<HashResult, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("{}|{}", crate::models::error_codes::FILE_NOT_FOUND, file_path));
    }

    let file_size = path
        .metadata()
        .map_err(|e| format!("{}|{}", crate::models::error_codes::APP_DATA_DIR_FAILED, e))?
        .len();

    // 快速比较语义（对齐 PyQt）：≤1GB 读全文件（真哈希，避免前缀误判），>1GB 只读前 5MB
    let read_limit = if file_size > 1 * 1024 * 1024 * 1024 {
        5 * 1024 * 1024
    } else {
        file_size
    };

    let mut file = File::open(path).map_err(|e| {
        format!("{}|{}", crate::models::error_codes::READ_FILE_FAILED, e)
    })?;
    // 缓冲按实际读取量分配：至少 1MB 但不超过文件大小，避免小文件白白分配 1MB
    let buffer_len = CHUNK_SIZE.min(read_limit as usize);
    let mut buffer = vec![0u8; buffer_len];
    let start_time = Instant::now();

    let mut hasher = make_hasher(algorithm);
    let mut total_read = 0u64;
    while total_read < read_limit {
        let want = std::cmp::min(buffer.len() as u64, read_limit - total_read) as usize;
        let bytes_read = file.read(&mut buffer[..want]).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
        total_read += bytes_read as u64;
    }
    let hash_value = hasher.finalize_hex();

    Ok(HashResult {
        file_path,
        algorithm,
        hash_value,
        elapsed_time: start_time.elapsed().as_secs_f64(),
        status: HashStatus::Success,
        from_cache: false,
        error_code: None,
        error_detail: None,
        error_message: None,
    })
}

/// 暂停哈希计算
#[tauri::command]
pub fn pause_hash_calculation(state: State<'_, AppState>) -> Result<(), String> {
    state.pause_flag.store(true, Ordering::Relaxed);
    Ok(())
}

/// 恢复哈希计算
#[tauri::command]
pub fn resume_hash_calculation(state: State<'_, AppState>) -> Result<(), String> {
    state.pause_flag.store(false, Ordering::Relaxed);
    Ok(())
}

/// 取消哈希计算
#[tauri::command]
pub fn cancel_hash_calculation(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::Relaxed);
    state.pause_flag.store(false, Ordering::Relaxed);
    Ok(())
}

/// 分块计算文件哈希值，逐块检查取消/暂停并发送进度
fn do_calculate_hash(
    file_path: &str,
    algorithm: HashAlgorithm,
    app: &AppHandle,
    state: &AppState,
) -> Result<(String, u64), String> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!(
            "{}|{}",
            crate::models::error_codes::FILE_NOT_FOUND,
            file_path
        ));
    }

    let file_size = path
        .metadata()
        .map_err(|e| format!("{}|{}", crate::models::error_codes::APP_DATA_DIR_FAILED, e))?
        .len();

    let mut file = File::open(path).map_err(|e| {
        format!("{}|{}", crate::models::error_codes::READ_FILE_FAILED, e)
    })?;
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut total_read = 0u64;

    let mut hasher = make_hasher(algorithm);
    // 仅在整个整数百分比变化时才发送进度事件：735MB 文件从 735 次 IPC 降到 ≤100 次，
    // 大幅削减跨语言调用开销，同时保留可用进度粒度。
    let mut last_progress: i32 = -1;

    loop {
        state.check_interrupted()?;

        let bytes_read = file.read(&mut buffer).map_err(|e| {
            format!("{}|{}", crate::models::error_codes::READ_FILE_FAILED, e)
        })?;
        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
        total_read += bytes_read as u64;

        // 发送进度（按整数百分比节流）
        let progress = if file_size > 0 {
            (total_read as f64 / file_size as f64 * 100.0) as i32
        } else {
            100
        };
        if progress != last_progress {
            last_progress = progress;
            let _ = app.emit(
                "hash-progress",
                HashProgress {
                    file_path: file_path.to_string(),
                    progress: progress as u8,
                    bytes_read: total_read,
                    total_bytes: file_size,
                },
            );
        }
    }

    // 确保收尾进度 100% 一定发出（末块可能未恰好触发百分比变化）
    if last_progress != 100 {
        let _ = app.emit(
            "hash-progress",
            HashProgress {
                file_path: file_path.to_string(),
                progress: 100,
                bytes_read: total_read,
                total_bytes: file_size,
            },
        );
    }

    Ok((hasher.finalize_hex(), file_size))
}

/// 右键菜单批量计算：对一组路径用指定算法计算完整哈希（复用哈希内核与缓存，
/// 不触发前端进度条），返回每个文件的结果。用于「右键 → 计算/比较」的报告窗口。
#[tauri::command]
pub fn compute_hashes(
    paths: Vec<String>,
    algorithm: HashAlgorithm,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Vec<HashResult> {
    paths
        .iter()
        .map(|p| compute_full(p, algorithm, &app, state.inner()))
        .collect()
}

fn compute_full(
    file_path: &str,
    algorithm: HashAlgorithm,
    app: &AppHandle,
    state: &AppState,
) -> HashResult {
    use std::time::Instant;

    let start = Instant::now();
    let path = Path::new(file_path);

    // 命中缓存直接返回
    if let Ok(meta) = path.metadata() {
        let key = file_cache_key(file_path, meta.len(), algorithm);
        if let Some(h) = state.hash_cache.lock().unwrap().get(&key).cloned() {
            return HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value: h,
                elapsed_time: 0.0,
                status: HashStatus::Success,
                from_cache: true,
                error_code: None,
                error_detail: None,
                error_message: None,
            };
        }
    }

    let result = match do_calculate_hash(file_path, algorithm, app, state) {
        Ok((hash_value, _size)) => {
            if let Ok(meta) = path.metadata() {
                state.hash_cache.lock().unwrap().insert(
                    file_cache_key(file_path, meta.len(), algorithm),
                    hash_value.clone(),
                );
            }
            HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value,
                elapsed_time: start.elapsed().as_secs_f64(),
                status: HashStatus::Success,
                from_cache: false,
                error_code: None,
                error_detail: None,
                error_message: None,
            }
        }
        Err(e) => {
            let (code, detail) = split_error(&e);
            HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value: String::new(),
                elapsed_time: start.elapsed().as_secs_f64(),
                status: HashStatus::Error,
                from_cache: false,
                error_code: Some(code),
                error_detail: detail,
                error_message: None,
            }
        }
    };

    result
}

/// 算法名（小写）转枚举；支持 sha-256 等带连字符写法。
fn algo_from_str(s: &str) -> Option<HashAlgorithm> {
    match s.to_ascii_lowercase().as_str() {
        "sha256" | "sha-256" => Some(HashAlgorithm::SHA256),
        "md5" => Some(HashAlgorithm::MD5),
        "sha1" | "sha-1" => Some(HashAlgorithm::SHA1),
        "sha512" | "sha-512" => Some(HashAlgorithm::SHA512),
        "crc32" => Some(HashAlgorithm::Crc32),
        _ => None,
    }
}

/// 右键菜单「用校验文件验证」：解析校验文件，按条目相对目录解析实际文件、
/// 用条目声明的算法计算哈希并与期望哈希比对，返回逐条目结果。
#[tauri::command]
pub fn verify_checksum_file(
    checksum_file: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<VerifyResult>, String> {
    // 重置中断标志：右键报告窗与计算窗共享 AppState，若此前某次计算被取消，残留的
    // cancel_flag 会让本命令首行 check_interrupted 立即报错，导致所有条目 error。
    state.cancel_flag.store(false, Ordering::Relaxed);
    state.pause_flag.store(false, Ordering::Relaxed);

    let report = crate::commands::verification_parser::parse_verification_file(&checksum_file)
        .map_err(|e| e)?;
    // 校验文件所在目录（用于路径越界保护）。canonicalize 失败（极少见）则退化为不限制。
    let base_dir = Path::new(&checksum_file)
        .parent()
        .and_then(|p| p.canonicalize().ok());

    let mut results: Vec<VerifyResult> = Vec::new();
    for entry in report.entries {
        // 解析被校验文件绝对路径：目录 join 条目名后 canonicalize 规范化，并拦截路径遍历
        // （如 "../secret.txt" 或绝对路径）指向校验文件目录之外的文件。
        let joined = match Path::new(&checksum_file).parent() {
            Some(p) => p.join(&entry.filename),
            None => PathBuf::from(entry.filename.clone()),
        };
        let resolved = match joined.canonicalize() {
            Ok(canon) => {
                if base_dir.as_ref().map_or(true, |b| canon.starts_with(b)) {
                    canon
                } else {
                    results.push(VerifyResult {
                        file_path: joined.to_string_lossy().to_string(),
                        algorithm: entry.algorithm.clone(),
                        expected: entry.hash_value.clone(),
                        actual: String::new(),
                        status: "error".to_string(),
                        error_code: Some(
                            crate::models::error_codes::PATH_TRAVERSAL.to_string(),
                        ),
                        error_detail: None,
                        error_message: None,
                    });
                    continue;
                }
            }
            Err(_) => {
                results.push(VerifyResult {
                    file_path: joined.to_string_lossy().to_string(),
                    algorithm: entry.algorithm.clone(),
                    expected: entry.hash_value.clone(),
                    actual: String::new(),
                    status: "error".to_string(),
                    error_code: Some(
                        crate::models::error_codes::FILE_NOT_FOUND.to_string(),
                    ),
                    error_detail: Some(joined.display().to_string()),
                    error_message: None,
                });
                continue;
            }
        };
        let file_path = resolved.to_string_lossy().to_string();
        let algo = algo_from_str(&entry.algorithm);
        // 三元组：(status, actual, error_code, error_detail)
        let (status, actual, err_code, err_detail) = match algo {
            Some(a) => {
                let res = compute_full(&file_path, a, &app, state.inner());
                match res.status {
                    HashStatus::Success => {
                        let ok = res.hash_value.eq_ignore_ascii_case(&entry.hash_value);
                        (
                            if ok { "match".to_string() } else { "mismatch".to_string() },
                            res.hash_value,
                            None,
                            None,
                        )
                    }
                    HashStatus::Error => (
                        "error".to_string(),
                        String::new(),
                        res.error_code,
                        res.error_detail,
                    ),
                    _ => (
                        "error".to_string(),
                        String::new(),
                        res.error_code,
                        res.error_detail,
                    ),
                }
            }
            None => (
                "error".to_string(),
                String::new(),
                Some(crate::models::error_codes::UNSUPPORTED_ALGORITHM.to_string()),
                Some(entry.algorithm.clone()),
            ),
        };
        results.push(VerifyResult {
            file_path,
            algorithm: entry.algorithm,
            expected: entry.hash_value,
            actual,
            status,
            error_code: err_code,
            error_detail: err_detail,
            error_message: None,
        });
    }
    Ok(results)
}

/// 将 `CODE|detail` 格式的后端错误字符串拆分为 (code, detail)。
/// 若不含 `|`，则整体作为 code、detail 为 None。
fn split_error(err: &str) -> (String, Option<String>) {
    match err.split_once('|') {
        Some((code, detail)) => (code.to_string(), Some(detail.to_string())),
        None => (err.to_string(), None),
    }
}
