use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Instant;

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use tauri::{AppHandle, Emitter, State};

use crate::models::{BatchResult, BatchStatistics, HashAlgorithm, HashResult, HashStatus};
use crate::AppState;

/// 开始批量校验
#[tauri::command]
pub async fn start_batch_validation(
    file_paths: Vec<String>,
    algorithm: HashAlgorithm,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatchResult, String> {
    // 重置状态
    state.cancel_flag.store(false, Ordering::Relaxed);
    state.pause_flag.store(false, Ordering::Relaxed);

    let start_time = Instant::now();
    let mut results = Vec::with_capacity(file_paths.len());
    let mut success_count = 0;
    let mut error_count = 0;

    for file_path in file_paths {
        // 检查是否取消
        if state.cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let file_start = Instant::now();
        let result = process_single_file(&file_path, algorithm, &app, &state);

        match result {
            Ok(mut hash_result) => {
                hash_result.elapsed_time = file_start.elapsed().as_secs_f64();
                results.push(hash_result.clone());
                success_count += 1;

                // 发送单文件完成事件
                let _ = app.emit("batch-file-complete", hash_result);
            }
            Err(e) => {
                let error_result = HashResult {
                    file_path: file_path.clone(),
                    algorithm,
                    hash_value: String::new(),
                    elapsed_time: file_start.elapsed().as_secs_f64(),
                    status: HashStatus::Error,
                    error_message: Some(e),
                };
                results.push(error_result.clone());
                error_count += 1;

                let _ = app.emit("batch-file-complete", error_result);
            }
        }
    }

    let total_time = start_time.elapsed().as_secs_f64();

    let batch_result = BatchResult {
        results: results.clone(),
        statistics: BatchStatistics {
            total: results.len(),
            success: success_count,
            error: error_count,
            mismatch: 0,
            total_time,
        },
    };

    // 存储结果
    let mut batch_results = state.batch_results.lock().unwrap();
    *batch_results = results;

    // 发送批量完成事件
    let _ = app.emit("batch-complete", batch_result.clone());

    Ok(batch_result)
}

fn process_single_file(
    file_path: &str,
    algorithm: HashAlgorithm,
    _app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<HashResult, String> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let file_size = path.metadata().map_err(|e| e.to_string())?.len();

    // 检查缓存
    let cache_key = (file_size, algorithm);
    let cache = state.hash_cache.lock().unwrap();
    if let Some(cached_hash) = cache.get(&cache_key) {
        return Ok(HashResult {
            file_path: file_path.to_string(),
            algorithm,
            hash_value: cached_hash.clone(),
            elapsed_time: 0.0,
            status: HashStatus::Success,
            error_message: None,
        });
    }
    drop(cache);

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = [0u8; 8192];

    let hash_value = match algorithm {
        HashAlgorithm::SHA256 => {
            let mut hasher = Sha256::new();
            loop {
                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }
                hasher.update(&buffer[..bytes_read]);
            }
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::MD5 => {
            let mut hasher = Md5::new();
            loop {
                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }
                hasher.update(&buffer[..bytes_read]);
            }
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::SHA1 => {
            let mut hasher = Sha1::new();
            loop {
                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }
                hasher.update(&buffer[..bytes_read]);
            }
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::SHA512 => {
            let mut hasher = Sha512::new();
            loop {
                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }
                hasher.update(&buffer[..bytes_read]);
            }
            format!("{:x}", hasher.finalize())
        }
    };

    // 缓存结果
    let mut cache = state.hash_cache.lock().unwrap();
    cache.insert((file_size, algorithm), hash_value.clone());

    Ok(HashResult {
        file_path: file_path.to_string(),
        algorithm,
        hash_value,
        elapsed_time: 0.0,
        status: HashStatus::Success,
        error_message: None,
    })
}
