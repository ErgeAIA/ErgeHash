use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::hashing::{
    check_interrupted, make_hasher, HashCache, HashSink, CHUNK_SIZE,
};
use crate::models::{BatchProgress, BatchResult, HashAlgorithm, HashResult, HashStatus};
use crate::AppState;

/// 开始批量校验（整批在 blocking 线程中顺序执行，不占用异步 worker；
/// 暂停/恢复/取消、进度事件顺序与前端契约保持不变）
#[tauri::command]
pub async fn start_batch_validation(
    file_paths: Vec<String>,
    algorithms: Vec<HashAlgorithm>,
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
        let mut results = Vec::with_capacity(total_files * algorithms.len().max(1));
        let mut success_count = 0;
        let mut error_count = 0;
        let mut done_files = 0;

        for file_path in file_paths {
            // 检查是否取消（文件之间）
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let file_start = Instant::now();
            // 关键优化：一次顺序读取，同时为所有算法计算哈希（多算法不再重复读文件）
            let file_results = process_single_file(
                &file_path,
                &algorithms,
                &pause_flag,
                &cancel_flag,
                &hash_cache,
            );

            for mut hash_result in file_results {
                hash_result.elapsed_time = file_start.elapsed().as_secs_f64();
                let ok = hash_result.status == HashStatus::Success;
                results.push(hash_result.clone());
                if ok {
                    success_count += 1;
                } else {
                    error_count += 1;
                }
                // 发送单文件-单算法完成事件（与前端 per-result 契约保持一致）
                let _ = app.emit("batch-file-complete", hash_result);
            }

            done_files += 1;
            // 发送批量进度（按“已处理文件数”计，避免多算法导致进度 > 100%）
            let _ = app.emit(
                "batch-progress",
                BatchProgress {
                    done: done_files,
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

/// 处理单个文件：在一次顺序读取中计算所有请求算法的哈希值。
///
/// 性能要点：无论请求多少种算法，文件只被打开并顺序读取一遍（原实现每种算法
/// 各读一遍，多算法时产生 N 倍磁盘/IO 开销）。同一份数据块同时喂给所有未命中
/// 缓存的 hasher，与 Python hashlib 单次多哈希的工作方式一致。
fn process_single_file(
    file_path: &str,
    algorithms: &[HashAlgorithm],
    pause_flag: &Arc<AtomicBool>,
    cancel_flag: &Arc<AtomicBool>,
    hash_cache: &Arc<Mutex<HashCache>>,
) -> Vec<HashResult> {
    let path = Path::new(file_path);

    // 统一错误构造：当文件不存在/无法访问时，为每种算法各返回一条错误结果
    let err_all = |msg: String| -> Vec<HashResult> {
        algorithms
            .iter()
            .map(|&algorithm| HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value: String::new(),
                elapsed_time: 0.0,
                status: HashStatus::Error,
                from_cache: false,
                error_message: Some(msg.clone()),
            })
            .collect()
    };

    if !path.exists() {
        return err_all(format!("文件不存在: {}", file_path));
    }

    let metadata = match path.metadata() {
        Ok(m) => m,
        Err(e) => return err_all(e.to_string()),
    };
    let file_size = metadata.len();
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    // 打开一次
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(e) => return err_all(e.to_string()),
    };

    // 为每个算法建一个 hasher；命中缓存的用 None 占位（跳过计算，直接回写缓存值）
    let mut hashers: Vec<Option<Box<dyn HashSink>>> = algorithms
        .iter()
        .map(|&algorithm| {
            if hash_cache
                .lock()
                .unwrap()
                .contains_key(&(file_path.to_string(), file_size, mtime, algorithm))
            {
                None
            } else {
                Some(make_hasher(algorithm))
            }
        })
        .collect();

    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut cancelled = false;

    loop {
        if check_interrupted(pause_flag.as_ref(), cancel_flag.as_ref()).is_err() {
            cancelled = true;
            break;
        }

        let bytes_read = match file.read(&mut buffer) {
            Ok(n) => n,
            Err(e) => return err_all(format!("读取文件失败: {}", e)),
        };
        if bytes_read == 0 {
            break;
        }

        // 同一份数据喂给所有未缓存的 hasher（一次读取，多次 update）
        for h in hashers.iter_mut().flatten() {
            h.update(&buffer[..bytes_read]);
        }
    }

    algorithms
        .iter()
        .zip(hashers.into_iter())
        .map(|(&algorithm, hasher)| {
            let key = (file_path.to_string(), file_size, mtime, algorithm);

            if cancelled {
                return HashResult {
                    file_path: file_path.to_string(),
                    algorithm,
                    hash_value: String::new(),
                    elapsed_time: 0.0,
                    status: HashStatus::Error,
                    from_cache: false,
                    error_message: Some("操作已取消".to_string()),
                };
            }

            match hasher {
                // 缓存命中：直接回写缓存值
                None => {
                    let cached = hash_cache
                        .lock()
                        .unwrap()
                        .get(&key)
                        .cloned()
                        .unwrap_or_default();
                    HashResult {
                        file_path: file_path.to_string(),
                        algorithm,
                        hash_value: cached,
                        elapsed_time: 0.0,
                        status: HashStatus::Success,
                        from_cache: true,
                        error_message: None,
                    }
                }
                // 新计算
                Some(h) => {
                    let hash_value = h.finalize_hex();
                    hash_cache.lock().unwrap().insert(key, hash_value.clone());
                    HashResult {
                        file_path: file_path.to_string(),
                        algorithm,
                        hash_value,
                        elapsed_time: 0.0,
                        status: HashStatus::Success,
                        from_cache: false,
                        error_message: None,
                    }
                }
            }
        })
        .collect()
}
