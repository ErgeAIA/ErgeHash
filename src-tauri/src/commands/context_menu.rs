use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, State, WebviewWindow};

use crate::models::ContextMenuRequest;
use crate::AppState;

/// 返回右键菜单启动请求（算法 + 路径 + 操作类型），供报告窗口读取。
#[tauri::command]
pub fn get_context_request(state: State<'_, AppState>) -> Option<ContextMenuRequest> {
    state.context_request.lock().unwrap().clone()
}

/// 报告窗口中点击「在 ErgeHash 中打开」：显示并聚焦主窗口，标记已唤起。
#[tauri::command]
pub fn reveal_main_window(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
        let _ = main.center();
        state.main_revealed.store(true, Ordering::SeqCst);
        Ok(())
    } else {
        Err(crate::models::error_codes::MAIN_WINDOW_MISSING.to_string())
    }
}

/// 报告窗口关闭时调用：若主窗口从未被打开，则直接退出进程；
/// 否则（用户已打开主窗口）仅关闭当前报告窗口，保持进程运行。
/// 前端通过 onCloseRequested 阻止默认关闭行为后调用本命令，避免 report 窗
/// 在「计算卡死 / main_revealed=true」等场景下无法关闭。
#[tauri::command]
pub fn maybe_exit(window: WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    if !state.main_revealed.load(Ordering::Relaxed) {
        window.app_handle().exit(0);
    } else {
        let _ = window.close();
    }
    Ok(())
}
