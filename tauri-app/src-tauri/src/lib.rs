use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

mod commands;
mod hashing;
mod models;

use commands::batch::start_batch_validation;
use commands::config::{add_history, clear_history, get_config, get_history, set_config};
use commands::export::{
    export_csv, export_json, generate_verification_file, import_verification_file,
};
use commands::filesystem::{open_file_dialog, open_folder_dialog, save_file_dialog, scan_directory};
use commands::hash::{
    calculate_hash, cancel_hash_calculation, pause_hash_calculation, quick_calculate_hash,
    resume_hash_calculation,
};

/// 应用共享状态
pub struct AppState {
    /// 暂停标志
    pub pause_flag: Arc<AtomicBool>,
    /// 取消标志
    pub cancel_flag: Arc<AtomicBool>,
    /// 哈希缓存：(文件路径, 文件大小, 修改时间纳秒, 算法) -> 哈希值
    pub hash_cache: Arc<Mutex<HashMap<(String, u64, u128, models::HashAlgorithm), String>>>,
    /// 批量处理结果
    pub batch_results: Arc<Mutex<Vec<models::HashResult>>>,
}

impl AppState {
    /// 中断检查：已取消则返回错误；已暂停则阻塞等待恢复（期间仍检查取消）。
    /// 供哈希计算分块循环逐块调用。
    pub fn check_interrupted(&self) -> Result<(), String> {
        if self.cancel_flag.load(Ordering::Relaxed) {
            return Err("计算已取消".into());
        }
        while self.pause_flag.load(Ordering::Relaxed) {
            if self.cancel_flag.load(Ordering::Relaxed) {
                return Err("计算已取消".into());
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Ok(())
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
            scan_directory,
            open_file_dialog,
            open_folder_dialog,
            save_file_dialog,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| eprintln!("Error while running tauri application: {}", e))
        .ok();
}
