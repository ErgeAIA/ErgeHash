use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::hashing::{check_interrupted, file_cache_key, make_hasher, HashCache, CHUNK_SIZE};
use crate::models::{BatchProgress, BatchResult, HashAlgorithm, HashResult, HashStatus};
use crate::AppState;

/// 开始批量校验（整批在 blocking 线程中顺序执行，不占用异步 worker；
/// 暂停/恢复/取消、进度事件顺序与前端契约保持不变）
#[tauri::command]
pub async fn start_batch_validation(
    file_paths: Vec<String>,
    algorithm: HashAlgorithm,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatchResult, String> {
    // 提取可跨线程的 Arc（State 借用不能 move 进 'static blocking 闭包）
    let pause_flag = state.pause_flag.clone();
    let cancel_flag = state.cancel_flag.clone();
    let hash_cache = state.hash_cache.clone();
    let batch_results = state.batch_results.clone();

    // 重置状态
    cancel_flag.store(false, Ordering::Relaxed);
    pause_flag.store(false, Ordering::Relaxed);

    let inner = tauri::async_runtime::spawn_blocking(move || {
        let start_time = Instant::now();
        let total_files = file_paths.len();
        let mut results = Vec::with_capacity(total_files);
        let mut success_count = 0;
        let mut error_count = 0;

        for file_path in file_paths {
            // 检查是否取消（文件之间）
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let file_start = Instant::now();
            let result = process_single_file(
                &file_path,
                algorithm,
                &pause_flag,
                &cancel_flag,
                &hash_cache,
            );

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
                        from_cache: false,
                        error_message: Some(e),
                    };
                    results.push(error_result.clone());
                    error_count += 1;

                    let _ = app.emit("batch-file-complete", error_result);
                }
            }

            // 发送批量进度
            let _ = app.emit(
                "batch-progress",
                BatchProgress {
                    done: results.len(),
                    total: total_files,
                },
            );
        }

        let total_time = start_time.elapsed().as_secs_f64();

        let batch_result = BatchResult {
            results: results.clone(),
            total: results.len(),
            success: success_count,
            error: error_count,
            mismatch: 0,
            total_time,
        };

        // 存储结果
        *batch_results.lock().unwrap() = results;

        // 发送批量完成事件
        let _ = app.emit("batch-complete", batch_result.clone());

        Ok::<BatchResult, String>(batch_result)
    })
    .await
    .map_err(|e| format!("批量校验线程异常: {}", e))?;

    // inner 已是 Result<BatchResult, String>，直接返回（不再 Ok 包裹）
    inner
}

/// 处理单个文件：检查缓存，未命中则分块计算（逐块检查取消/暂停）。
/// 通过克隆出的 Arc 标志与缓存访问，可在 blocking 线程中使用。
fn process_single_file(
    file_path: &str,
    algorithm: HashAlgorithm,
    pause_flag: &Arc<AtomicBool>,
    cancel_flag: &Arc<AtomicBool>,
    hash_cache: &Arc<Mutex<HashCache>>,
) -> Result<HashResult, String> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let file_size = path.metadata().map_err(|e| e.to_string())?.len();

    // 检查缓存
    let cache_key = file_cache_key(file_path, file_size, algorithm);
    {
        let cache = hash_cache.lock().unwrap();
        if let Some(cached_hash) = cache.get(&cache_key) {
            return Ok(HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value: cached_hash.clone(),
                elapsed_time: 0.0,
                status: HashStatus::Success,
                from_cache: true,
                error_message: None,
            });
        }
    }

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; CHUNK_SIZE];

    let mut hasher = make_hasher(algorithm);
    loop {
        check_interrupted(pause_flag.as_ref(), cancel_flag.as_ref())?;

        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    let hash_value = hasher.finalize_hex();

    // 缓存结果
    let mut cache = hash_cache.lock().unwrap();
    cache.insert(
        file_cache_key(file_path, file_size, algorithm),
        hash_value.clone(),
    );

    Ok(HashResult {
        file_path: file_path.to_string(),
        algorithm,
        hash_value,
        elapsed_time: 0.0,
        status: HashStatus::Success,
        from_cache: false,
        error_message: None,
    })
}
