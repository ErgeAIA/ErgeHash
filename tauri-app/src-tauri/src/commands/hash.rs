use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Instant;

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use tauri::{AppHandle, Emitter, State};

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
        let cache_key = (file_size, algorithm);
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
        cache.insert((meta.len(), algorithm), hash_value.clone());
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
    let max_read = 10 * 1024 * 1024; // 10MB

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::with_capacity(std::cmp::min(file_size, max_read) as usize);

    let start_time = Instant::now();

    let bytes_to_read = std::cmp::min(file_size, max_read) as usize;
    buffer.resize(bytes_to_read, 0);
    file.read_exact(&mut buffer).map_err(|e| e.to_string())?;

    let hash_value = match algorithm {
        HashAlgorithm::SHA256 => {
            let mut hasher = Sha256::new();
            hasher.update(&buffer);
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::MD5 => {
            let mut hasher = Md5::new();
            hasher.update(&buffer);
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::SHA1 => {
            let mut hasher = Sha1::new();
            hasher.update(&buffer);
            format!("{:x}", hasher.finalize())
        }
        HashAlgorithm::SHA512 => {
            let mut hasher = Sha512::new();
            hasher.update(&buffer);
            format!("{:x}", hasher.finalize())
        }
    };

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
    let mut buffer = [0u8; 8192];
    let mut total_read = 0u64;

    match algorithm {
        HashAlgorithm::SHA256 => {
            let mut hasher = Sha256::new();
            loop {
                if state.cancel_flag.load(Ordering::Relaxed) {
                    return Err("计算已取消".into());
                }

                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }

                hasher.update(&buffer[..bytes_read]);
                total_read += bytes_read as u64;

                // 发送进度
                let progress = if file_size > 0 {
                    (total_read as f64 / file_size as f64 * 100.0) as u8
                } else {
                    100
                };
                let _ = app.emit(
                    "hash-progress",
                    HashProgress {
                        file_path: file_path.to_string(),
                        progress,
                        bytes_read: total_read,
                        total_bytes: file_size,
                    },
                );
            }
            Ok((format!("{:x}", hasher.finalize()), file_size))
        }
        HashAlgorithm::MD5 => {
            let mut hasher = Md5::new();
            loop {
                if state.cancel_flag.load(Ordering::Relaxed) {
                    return Err("计算已取消".into());
                }

                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }

                hasher.update(&buffer[..bytes_read]);
                total_read += bytes_read as u64;

                let progress = if file_size > 0 {
                    (total_read as f64 / file_size as f64 * 100.0) as u8
                } else {
                    100
                };
                let _ = app.emit(
                    "hash-progress",
                    HashProgress {
                        file_path: file_path.to_string(),
                        progress,
                        bytes_read: total_read,
                        total_bytes: file_size,
                    },
                );
            }
            Ok((format!("{:x}", hasher.finalize()), file_size))
        }
        HashAlgorithm::SHA1 => {
            let mut hasher = Sha1::new();
            loop {
                if state.cancel_flag.load(Ordering::Relaxed) {
                    return Err("计算已取消".into());
                }

                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }

                hasher.update(&buffer[..bytes_read]);
                total_read += bytes_read as u64;

                let progress = if file_size > 0 {
                    (total_read as f64 / file_size as f64 * 100.0) as u8
                } else {
                    100
                };
                let _ = app.emit(
                    "hash-progress",
                    HashProgress {
                        file_path: file_path.to_string(),
                        progress,
                        bytes_read: total_read,
                        total_bytes: file_size,
                    },
                );
            }
            Ok((format!("{:x}", hasher.finalize()), file_size))
        }
        HashAlgorithm::SHA512 => {
            let mut hasher = Sha512::new();
            loop {
                if state.cancel_flag.load(Ordering::Relaxed) {
                    return Err("计算已取消".into());
                }

                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }

                hasher.update(&buffer[..bytes_read]);
                total_read += bytes_read as u64;

                let progress = if file_size > 0 {
                    (total_read as f64 / file_size as f64 * 100.0) as u8
                } else {
                    100
                };
                let _ = app.emit(
                    "hash-progress",
                    HashProgress {
                        file_path: file_path.to_string(),
                        progress,
                        bytes_read: total_read,
                        total_bytes: file_size,
                    },
                );
            }
            Ok((format!("{:x}", hasher.finalize()), file_size))
        }
    }
}
