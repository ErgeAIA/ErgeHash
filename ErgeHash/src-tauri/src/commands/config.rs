use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::models::{AppConfig, HistoryEntry};

/// 串行化 config.json / history.json 的读改写，避免并发竞态丢更新
static CONFIG_IO_LOCK: Mutex<()> = Mutex::new(());

/// 获取应用配置
#[tauri::command]
pub fn get_config(app: AppHandle) -> Result<AppConfig, String> {
    let _guard = CONFIG_IO_LOCK.lock().unwrap();
    let config_path = get_config_file_path(&app)?;

    if !config_path.exists() {
        let default = AppConfig::default();
        // 创建默认配置文件
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {}", e))?;
        }
        let json =
            serde_json::to_string_pretty(&default).map_err(|e| format!("序列化配置失败: {}", e))?;
        fs::write(&config_path, json).map_err(|e| format!("写入配置文件失败: {}", e))?;
        return Ok(default);
    }

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("读取配置文件失败: {}", e))?;
    let config: AppConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;
    Ok(config)
}

/// 设置配置项
#[tauri::command]
pub fn set_config(app: AppHandle, key: String, value: serde_json::Value) -> Result<(), String> {
    let _guard = CONFIG_IO_LOCK.lock().unwrap();
    let config_path = get_config_file_path(&app)?;

    // 读取现有配置
    let mut config = if config_path.exists() {
        let content =
            fs::read_to_string(&config_path).map_err(|e| format!("读取配置文件失败: {}", e))?;
        let map: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;
        map
    } else {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {}", e))?;
        }
        serde_json::Map::new()
    };

    // 更新指定键
    config.insert(key, value);

    // 写回文件
    let json =
        serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&config_path, json).map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(())
}

/// 获取历史记录
#[tauri::command]
pub fn get_history(app: AppHandle, limit: Option<usize>) -> Result<Vec<HistoryEntry>, String> {
    let _guard = CONFIG_IO_LOCK.lock().unwrap();
    let history_path = get_history_file_path(&app)?;
    let limit = limit.unwrap_or(50);

    if !history_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(&history_path).map_err(|e| format!("读取历史记录失败: {}", e))?;
    let mut history: Vec<HistoryEntry> =
        serde_json::from_str(&content).map_err(|e| format!("解析历史记录失败: {}", e))?;

    history.truncate(limit);
    Ok(history)
}

/// 添加历史记录
#[tauri::command]
pub fn add_history(app: AppHandle, entry: HistoryEntry) -> Result<(), String> {
    let _guard = CONFIG_IO_LOCK.lock().unwrap();
    let history_path = get_history_file_path(&app)?;

    // 确保目录存在
    if let Some(parent) = history_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建历史记录目录失败: {}", e))?;
    }

    // 读取现有历史
    let mut history: Vec<HistoryEntry> = if history_path.exists() {
        let content =
            fs::read_to_string(&history_path).map_err(|e| format!("读取历史记录失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // 检查是否已存在相同记录（同路径同算法），如果存在则更新
    let existing_index = history
        .iter()
        .position(|h| h.file_path == entry.file_path && h.algorithm == entry.algorithm);

    if let Some(idx) = existing_index {
        history[idx] = entry;
    } else {
        // 插入到开头
        history.insert(0, entry);
    }

    // 最多保留 50 条
    history.truncate(50);

    // 写回文件
    let json =
        serde_json::to_string_pretty(&history).map_err(|e| format!("序列化历史记录失败: {}", e))?;
    fs::write(&history_path, json).map_err(|e| format!("写入历史记录失败: {}", e))?;

    Ok(())
}

/// 清空历史记录
#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    let _guard = CONFIG_IO_LOCK.lock().unwrap();
    let history_path = get_history_file_path(&app)?;

    if history_path.exists() {
        fs::write(&history_path, "[]").map_err(|e| format!("清空历史记录失败: {}", e))?;
    }

    Ok(())
}

/// 获取配置文件路径
fn get_config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    Ok(app_data_dir.join("config.json"))
}

/// 获取历史记录文件路径
fn get_history_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    Ok(app_data_dir.join("history.json"))
}
