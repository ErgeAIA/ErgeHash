use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::hashing::{file_cache_key, make_hasher, CHUNK_SIZE};
use crate::models::{HashAlgorithm, HashProgress, HashResult, HashStatus};
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
                error_message: None,
            });
        }
    }

    let (hash_value, _file_size) = do_calculate_hash(&file_path, algorithm, &app, &state)?;

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
        return Err(format!("文件不存在: {}", file_path));
    }

    let file_size = path.metadata().map_err(|e| e.to_string())?.len();

    // 快速比较语义（对齐 PyQt）：≤1GB 读全文件（真哈希，避免前缀误判），>1GB 只读前 5MB
    let read_limit = if file_size > 1 * 1024 * 1024 * 1024 {
        5 * 1024 * 1024
    } else {
        file_size
    };

    let mut file = File::open(path).map_err(|e| e.to_string())?;
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
    state: &State<'_, AppState>,
) -> Result<(String, u64), String> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let file_size = path.metadata().map_err(|e| e.to_string())?.len();

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut total_read = 0u64;

    let mut hasher = make_hasher(algorithm);
    // 仅在整个整数百分比变化时才发送进度事件：735MB 文件从 735 次 IPC 降到 ≤100 次，
    // 大幅削减跨语言调用开销，同时保留可用进度粒度。
    let mut last_progress: i32 = -1;

    loop {
        state.check_interrupted()?;

        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
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
