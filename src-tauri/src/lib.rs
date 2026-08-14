use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use tauri::Manager;

mod commands;
mod hashing;
mod models;

use commands::batch::start_batch_validation;
use commands::config::{add_history, clear_history, get_config, get_history, set_config};
use commands::export::{export_csv, export_json, generate_verification_file};
use commands::verification_parser::import_verification_file;
use commands::filesystem::{
    get_file_metadata, open_file_dialog, open_folder_dialog, open_notepad, save_file_dialog,
    scan_directory,
};
use commands::hash::{
    calculate_hash, cancel_hash_calculation, pause_hash_calculation, quick_calculate_hash,
    resume_hash_calculation,
};

use crate::hashing::{check_interrupted, HashCache};

/// 应用共享状态
pub struct AppState {
    /// 暂停标志
    pub pause_flag: Arc<AtomicBool>,
    /// 取消标志
    pub cancel_flag: Arc<AtomicBool>,
    /// 哈希缓存：(文件路径, 文件大小, 修改时间纳秒, 算法) -> 哈希值
    pub hash_cache: Arc<Mutex<HashCache>>,
    /// 批量处理结果
    pub batch_results: Arc<Mutex<Vec<models::HashResult>>>,
}

impl AppState {
    /// 中断检查：已取消则返回错误；已暂停则阻塞等待恢复（期间仍检查取消）。
    /// 供哈希计算分块循环逐块调用。实现委托给 hashing::check_interrupted。
    pub fn check_interrupted(&self) -> Result<(), String> {
        check_interrupted(self.pause_flag.as_ref(), self.cancel_flag.as_ref())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            pause_flag: Arc::new(AtomicBool::new(false)),
            cancel_flag: Arc::new(AtomicBool::new(false)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // 窗口初始化时固定在屏幕中央，不记忆上次位置
                let _ = window.center();
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 哈希计算
            calculate_hash,
            quick_calculate_hash,
            pause_hash_calculation,
            resume_hash_calculation,
            cancel_hash_calculation,
            // 批量处理
            start_batch_validation,
            // 配置管理
            get_config,
            set_config,
            get_history,
            add_history,
            clear_history,
            // 导出
            export_csv,
            export_json,
            generate_verification_file,
            import_verification_file,
            // 文件系统
            get_file_metadata,
            scan_directory,
            open_file_dialog,
            open_folder_dialog,
            save_file_dialog,
            open_notepad,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| eprintln!("Error while running tauri application: {}", e))
        .ok();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;
    use std::time::{Duration, Instant};

    /// 已取消 → 立即返回错误
    #[test]
    fn check_interrupted_cancel_returns_error() {
        let state = AppState {
            pause_flag: Arc::new(AtomicBool::new(false)),
            cancel_flag: Arc::new(AtomicBool::new(true)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        };
        let err = state.check_interrupted().unwrap_err();
        assert!(err.contains("取消"), "错误信息应包含取消提示，实际: {}", err);
    }

    /// 暂停中收到取消 → 立即返回错误（不被暂停阻塞）
    #[test]
    fn check_interrupted_cancel_during_pause_returns_error() {
        let state = AppState {
            pause_flag: Arc::new(AtomicBool::new(true)),
            cancel_flag: Arc::new(AtomicBool::new(true)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        };
        let start = Instant::now();
        assert!(state.check_interrupted().is_err());
        assert!(
            start.elapsed() < Duration::from_millis(150),
            "暂停中取消应立即返回，不应被暂停阻塞"
        );
    }

    /// 暂停中阻塞等待；恢复后返回 Ok（轮询间隔 50ms，200ms 后恢复）
    #[test]
    fn check_interrupted_pause_blocks_until_resume() {
        let state = AppState {
            pause_flag: Arc::new(AtomicBool::new(true)),
            cancel_flag: Arc::new(AtomicBool::new(false)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        };
        // 200ms 后在另一个线程恢复
        let resume_flag = state.pause_flag.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(200));
            resume_flag.store(false, Ordering::Relaxed);
        });

        let start = Instant::now();
        assert!(state.check_interrupted().is_ok());
        assert!(
            start.elapsed() >= Duration::from_millis(150),
            "暂停应在恢复前阻塞至少约 150ms"
        );
    }
}
