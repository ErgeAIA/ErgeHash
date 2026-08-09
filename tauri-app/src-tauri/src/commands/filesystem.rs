use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

/// 递归扫描目录，返回所有文件路径
#[tauri::command]
pub fn scan_directory(dir_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&dir_path);

    if !path.exists() {
        return Err(format!("目录不存在: {}", dir_path));
    }

    if !path.is_dir() {
        return Err(format!("路径不是目录: {}", dir_path));
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(path_str) = entry.path().to_str() {
                files.push(path_str.to_string());
            }
        }
    }

    // 按文件名排序
    files.sort();

    Ok(files)
}

/// 打开文件选择对话框
#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<Vec<String>>, String> {
    let file_paths = app.dialog().file().blocking_pick_files();

    match file_paths {
        Some(paths) => {
            let result: Vec<String> = paths
                .into_iter()
                .filter_map(|p| match p {
                    tauri_plugin_dialog::FilePath::Path(path) => {
                        Some(path.to_string_lossy().to_string())
                    }
                    tauri_plugin_dialog::FilePath::Url(url) => {
                        url.to_file_path().ok().map(|p| p.to_string_lossy().to_string())
                    }
                })
                .collect();
            if result.is_empty() {
                Ok(None)
            } else {
                Ok(Some(result))
            }
        }
        None => Ok(None),
    }
}

/// 打开文件夹选择对话框
#[tauri::command]
pub async fn open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let folder_path = app.dialog().file().blocking_pick_folder();

    match folder_path {
        Some(path) => {
            let path_str = match path {
                tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
                tauri_plugin_dialog::FilePath::Url(url) => url
                    .to_file_path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            };
            if path_str.is_empty() {
                Ok(None)
            } else {
                Ok(Some(path_str))
            }
        }
        None => Ok(None),
    }
}

/// 保存文件对话框
#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    default_name: String,
) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_str = match path {
                tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
                tauri_plugin_dialog::FilePath::Url(url) => url
                    .to_file_path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            };
            if path_str.is_empty() {
                Ok(None)
            } else {
                Ok(Some(path_str))
            }
        }
        None => Ok(None),
    }
}
