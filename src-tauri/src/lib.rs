use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};

mod commands;
mod hashing;
mod models;

use commands::batch::start_batch_validation;
use commands::config::{add_history, clear_history, get_config, get_history, set_config};
use commands::export::{export_csv, export_json, export_verification_files};
use commands::verification_parser::import_verification_file;
use commands::filesystem::{
    get_file_metadata, open_file_dialog, open_folder_dialog, open_notepad, save_file_dialog,
    scan_directory,
};
use commands::hash::{
    calculate_hash, cancel_hash_calculation, compute_hashes, pause_hash_calculation,
    quick_calculate_hash, resume_hash_calculation, verify_checksum_file,
};
use commands::context_menu::{get_context_request, maybe_exit, reveal_main_window};

use crate::hashing::{check_interrupted, HashCache};
use models::{ContextMenuRequest, HashAlgorithm};

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
    /// 右键菜单启动请求（来自命令行参数），无则为普通启动
    pub context_request: Arc<Mutex<Option<ContextMenuRequest>>>,
    /// 主窗口是否已被用户打开（报告窗口关闭时据此决定是否退出进程）
    pub main_revealed: Arc<AtomicBool>,
    /// 累积中的右键路径（多选启动多进程时，由单实例插件转发后聚合）
    pub pending_paths: Arc<Mutex<Vec<String>>>,
    /// 累积期间最近一次解析到的算法
    pub pending_algorithm: Arc<Mutex<HashAlgorithm>>,
    /// 累积期间是否进入「用校验文件验证」模式（--verify）
    pub pending_verify: Arc<Mutex<bool>>,
    /// 累积期间是否进入「对比文件」模式（--compare）
    pub pending_compare: Arc<Mutex<bool>>,
    /// 是否已有派发定时器在运行（防止重复排程）
    pub dispatch_timer: Arc<AtomicBool>,
}

impl AppState {
    /// 中断检查：已取消则返回错误；已暂停则阻塞等待恢复（期间仍检查取消）。
    /// 供哈希计算分块循环逐块调用。实现委托给 hashing::check_interrupted。
    pub fn check_interrupted(&self) -> Result<(), String> {
        check_interrupted(self.pause_flag.as_ref(), self.cancel_flag.as_ref())
    }
}

/// 把命令行参数映射为算法枚举（大小写不敏感）。
fn parse_algorithm(s: &str) -> Option<HashAlgorithm> {
    match s.to_ascii_lowercase().as_str() {
        "sha256" | "sha-256" => Some(HashAlgorithm::SHA256),
        "md5" => Some(HashAlgorithm::MD5),
        "sha1" | "sha-1" => Some(HashAlgorithm::SHA1),
        "sha512" | "sha-512" => Some(HashAlgorithm::SHA512),
        "crc32" => Some(HashAlgorithm::Crc32),
        _ => None,
    }
}

/// 生成首帧 anti-FOUC 脚本：在 WebView 解析 HTML 之前同步应用主题类，
/// 避免暗色模式下弹窗/主窗口先以亮色底色（白屏）渲染再瞬间变黑的重绘闪烁。
/// 主题存于磁盘 config.json，前端无法在挂载前同步读取，必须由 Rust 注入。
fn anti_fouc_script(app: &AppHandle) -> String {
    let dark = get_config(app.clone()).map(|c| c.theme == "dark").unwrap_or(false);
    let set = if dark { "add" } else { "remove" };
    format!(
        "(function(){{document.documentElement.classList.{}(\"dark\");}})();",
        set
    )
}

/// 右键参数解析结果
struct ParsedContext {
    /// 算法（--algo，verify 模式下忽略）
    algorithm: HashAlgorithm,
    /// 路径参数（文件 / 文件夹 / 校验文件）
    paths: Vec<String>,
    /// 是否「用校验文件验证」模式（--verify）
    verify: bool,
    /// 是否「对比文件」模式（--compare，强制进入 compare 横幅）
    compare: bool,
}

/// 从参数向量中提取右键菜单信息：跳过可执行文件自身，解析 --algo / --verify，
/// 其余视为文件路径。单实例插件回调的 args 以可执行文件路径作为第一项。
///
/// 注意：单实例插件、快捷方式、安装器自动启动等场景传入的第一项可能是纯文件名，
/// 也可能是完整路径；因此不能只做字符串相等比较，必须按路径语义判断。
fn extract_context(args: &[String]) -> ParsedContext {
    let current_exe = std::env::current_exe().ok();
    let exe_name = current_exe
        .as_ref()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()));
    // 提前 canonicalize 当前 exe，用于与参数中的完整路径做比较（忽略大小写）。
    // 失败时回退到原始路径；开发期 `cargo run` 路径通常仍可匹配。
    let exe_canonical = current_exe
        .as_ref()
        .and_then(|p| std::fs::canonicalize(p).ok())
        .or_else(|| current_exe.clone());

    let mut algorithm = HashAlgorithm::SHA256;
    let mut paths: Vec<String> = Vec::new();
    let mut verify = false;
    let mut compare = false;
    let mut first = true;
    let mut i = 0;
    while i < args.len() {
        let a = &args[i];
        if first {
            first = false;
            // 跳过可执行文件自身（参数列表第一项）。比较三种形式：
            // 1) 纯文件名；2) 完整/相对路径；3) canonicalize 后的完整路径。
            let is_self = exe_name.as_deref().map_or(false, |name| {
                name.eq_ignore_ascii_case(a)
                    || std::path::Path::new(a)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.eq_ignore_ascii_case(name))
                        .unwrap_or(false)
            }) || exe_canonical.as_ref().map_or(false, |exe| {
                std::path::Path::new(a)
                    .canonicalize()
                    .ok()
                    .map(|p| p == *exe)
                    .unwrap_or(false)
                    || a.eq_ignore_ascii_case(&exe.to_string_lossy())
            });
            if is_self {
                i += 1;
                continue;
            }
            // 若第一项不是 exe 自身（不同版本行为差异），当作普通参数继续处理
        }
        if a == "--algo" || a == "-a" {
            if let Some(v) = args.get(i + 1) {
                algorithm = parse_algorithm(v).unwrap_or(algorithm);
            }
            i += 2;
        } else if let Some(v) = a.strip_prefix("--algo=") {
            algorithm = parse_algorithm(v).unwrap_or(algorithm);
            i += 1;
        } else if a == "--verify" || a == "-v" {
            verify = true;
            i += 1;
        } else if let Some(v) = a.strip_prefix("--verify=") {
            verify = true;
            paths.push(v.to_string());
            i += 1;
        } else if a == "--compare" || a == "-c" {
            compare = true;
            i += 1;
        } else if !a.starts_with('-') {
            paths.push(a.clone());
            i += 1;
        } else {
            i += 1;
        }
    }
    ParsedContext {
        algorithm,
        paths,
        verify,
        compare,
    }
}

/// 把路径中的目录递归展开为文件，文件原样保留；返回（展开后的文件列表，是否含目录）。
fn expand_paths(raw: &[String]) -> (Vec<String>, bool) {
    let mut files: Vec<String> = Vec::new();
    let mut had_dir = false;
    for p in raw {
        let path = std::path::Path::new(p);
        // 用 symlink_metadata（不跟随符号链接）判定：只有「真实目录」才递归展开。
        // 若顶层参数本身是指向目录的符号链接，旧实现会跟随它把整棵目标树拉入计算
        // （指向 / 时等于枚举整个盘），现改为跳过（作为路径交给后端，文件计算会安全失败）。
        match std::fs::symlink_metadata(path) {
            Ok(meta) if meta.is_dir() => {
                had_dir = true;
                collect_files(path, &mut files);
            }
            _ => files.push(p.clone()),
        }
    }
    (files, had_dir)
}

/// 递归收集目录下所有普通文件。
/// 使用 entry.file_type()（symlink_metadata 语义，不跟随符号链接）判定：目录递归、
/// 普通文件收集、符号链接（及未知类型）直接跳过——避免指向目录的符号链接造成无限递归，
/// 也避免误把符号链接目标整树拉入计算。
fn collect_files(dir: &std::path::Path, out: &mut Vec<String>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            match entry.file_type() {
                Ok(ft) if ft.is_dir() => collect_files(&p, out),
                Ok(ft) if ft.is_file() => out.push(p.to_string_lossy().to_string()),
                _ => { /* 符号链接 / 未知类型：跳过 */ }
            }
        }
    }
}

/// 显示并聚焦主窗口，标记已被唤起（用于普通启动 / 报告窗「在 ErgeHash 中打开」）。
fn reveal_main(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.main_revealed.store(true, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        // 在 show 之前同步应用主题类，避免暗色模式下主窗口首帧以亮色（白屏）渲染再变黑。
        // 主窗口由 tauri.conf.json 自动创建，无法走 initialization_script，故用 eval 兜底。
        let _ = w.eval(&anti_fouc_script(app));
        let _ = w.center();
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// 根据已解析的右键上下文直接创建/聚焦报告窗口（首次启动用，无需累积）。
fn dispatch_context_menu(app: &AppHandle, parsed: ParsedContext) {
    if parsed.paths.is_empty() {
        return;
    }
    let state = app.state::<AppState>();
    // 校验文件模式：路径即校验文件本身，不再展开目录。
    // 普通模式：把目录递归展开为文件；含目录则按 compute 处理（不进入 compare 横幅）；
    // 多文件或显式 --compare 进入 compare 横幅（对比文件一致性）。
    let (paths, operation) = if parsed.verify {
        (parsed.paths, "verify".to_string())
    } else {
        let (files, had_dir) = expand_paths(&parsed.paths);
        let operation = if had_dir {
            "compute".to_string()
        } else if parsed.compare || parsed.paths.len() > 1 {
            "compare".to_string()
        } else {
            "compute".to_string()
        };
        (files, operation)
    };
    let req = ContextMenuRequest {
        operation,
        algorithm: parsed.algorithm,
        paths,
    };
    *state.context_request.lock().unwrap() = Some(req.clone());
    // 首次启动 / 右键模式时隐藏主窗口；若主窗口已被用户打开（复用场景）则不隐藏。
    if !state.main_revealed.load(Ordering::SeqCst) {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
    }
    let report_window = match app.get_webview_window("report") {
        Some(w) => {
            let _ = w.show();
            let _ = w.set_focus();
            let _ = w.center();
            w
        }
        None => {
            // 按当前主题设置窗口底色，避免 WebView 冷启动期间出现白屏闪烁。
            let bg = match get_config(app.clone()) {
                Ok(c) if c.theme == "dark" => tauri::window::Color(24, 24, 26, 255),
                _ => tauri::window::Color(247, 247, 248, 255),
            };
            let w = tauri::WebviewWindowBuilder::new(
                app,
                "report",
                tauri::WebviewUrl::App("/".into()),
            )
            .title("ErgeHash")
            .inner_size(480.0, 360.0)
            .min_inner_size(360.0, 240.0)
            .resizable(true)
            .decorations(false)
            .background_color(bg)
            .initialization_script(&anti_fouc_script(app))
            .visible(false)
            .build();
            match w {
                Ok(built) => {
                    // 必须 show() 之后再 center()：Windows 上隐藏窗体（visible(false)）由 WebView2
                    // 创建，show() 前窗口尚未被 WM 真正放置，此时 center() 计算的监视器/尺寸不可靠，
                    // show() 后会被 WM 强制放到 (0,0) 左上，center() 等于失效。
                    // 窗口已设 background_color 主题色，show() 不会出现白闪。
                    let _ = built.show();
                    let _ = built.center();
                    built
                }
                Err(_) => return,
            }
        }
    };
    // 通知报告窗重新读取请求：覆盖「主窗口已打开、报告窗被复用」场景下 useEffect 不重跑、
    // 继续显示上一次右键旧数据的问题。首次创建时 React 可能尚未挂载监听，挂载时的
    // get_context_request 仍会兜底加载；本次为重复使用时刷新。
    let _ = report_window.emit("context-updated", req);
}

/// 把一次右键请求加入 pending 队列；若尚未启动累积定时器则启动 400ms 延时，
/// 到期后由 `dispatch_accumulated` 统一派发。setup 中的首次启动与单实例回调共用此逻辑，
/// 保证多选文件时所有进程启动的参数都能被合并到一个 compare/verify 请求里。
fn accumulate_context_menu(app: &AppHandle, parsed: ParsedContext) {
    if parsed.paths.is_empty() {
        return;
    }
    let state = app.state::<AppState>();
    *state.pending_algorithm.lock().unwrap() = parsed.algorithm;
    if parsed.verify {
        *state.pending_verify.lock().unwrap() = true;
    }
    if parsed.compare {
        *state.pending_compare.lock().unwrap() = true;
    }
    state.pending_paths.lock().unwrap().extend(parsed.paths);
    if !state.dispatch_timer.swap(true, Ordering::SeqCst) {
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            dispatch_accumulated(&handle);
        });
    }
}

/// 累积窗口到期后派发：把 pending 状态合并后交给 `dispatch_context_menu`。
fn dispatch_accumulated(app: &AppHandle) {
    let state = app.state::<AppState>();
    // 先解除定时器占用：避免「take 之后、store 之前」的竞态窗口内新到的右键路径被漏派发。
    // 放到最前可保证——若窗口期内再到达右键，swap 会新起定时线程接管该路径，绝不丢失。
    state.dispatch_timer.store(false, Ordering::SeqCst);
    let raw_paths = std::mem::take(&mut *state.pending_paths.lock().unwrap());
    let algorithm = *state.pending_algorithm.lock().unwrap();
    // 读取后立刻重置，避免 --verify 标志泄漏到后续普通右键请求：pending_paths 用 take 清空，
    // 但 pending_verify 是只置位不清除，不清零会导致之后所有右键都走 verify 分支。
    let verify = {
        let mut g = state.pending_verify.lock().unwrap();
        let v = *g;
        *g = false;
        v
    };
    let compare = {
        let mut g = state.pending_compare.lock().unwrap();
        let c = *g;
        *g = false;
        c
    };
    if raw_paths.is_empty() {
        return;
    }
    dispatch_context_menu(
        app,
        ParsedContext {
            algorithm,
            paths: raw_paths,
            verify,
            compare,
        },
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 注意：单实例插件的回调只在检测到「第二个实例」时触发，
            // 首个实例启动时不会执行。因此首次启动的逻辑必须在 setup 中处理。
            let parsed = extract_context(&args);
            if parsed.paths.is_empty() {
                // 普通启动（无文件参数）：聚焦主窗口
                reveal_main(app);
                return;
            }
            // 右键模式：累积路径，短延时后统一派发（解决多选启动多进程问题）
            accumulate_context_menu(app, parsed);
        }))
        .manage(AppState {
            pause_flag: Arc::new(AtomicBool::new(false)),
            cancel_flag: Arc::new(AtomicBool::new(false)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
            context_request: Arc::new(Mutex::new(None)),
            main_revealed: Arc::new(AtomicBool::new(false)),
            pending_paths: Arc::new(Mutex::new(Vec::new())),
            pending_algorithm: Arc::new(Mutex::new(HashAlgorithm::SHA256)),
            pending_verify: Arc::new(Mutex::new(false)),
            pending_compare: Arc::new(Mutex::new(false)),
            dispatch_timer: Arc::new(AtomicBool::new(false)),
        })
        .setup(|app| {
            // 首个实例启动时单实例回调不会触发，因此这里必须主动读取命令行参数决定：
            // - 普通启动（无文件参数）：显示主窗口；
            // - 右键启动（有文件参数）：与后续实例一样走累积机制，400ms 后统一派发报告窗。
            //   多选文件时 Windows 会为每个文件启动一个进程，只有统一累积才能保证 compare
            //   拿到全部文件而不是只显示第一个。
            let args: Vec<String> = std::env::args().collect();
            let parsed = extract_context(&args);
            let handle = app.app_handle();
            if parsed.paths.is_empty() {
                reveal_main(&handle);
            } else {
                accumulate_context_menu(&handle, parsed);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 报告窗销毁且主窗口从未被用户打开时，整个进程已无意义，主动退出。
            // 主窗口已打开时仅关闭报告窗，保持进程运行。
            if matches!(event, tauri::WindowEvent::Destroyed) && window.label() == "report" {
                let state = window.state::<AppState>();
                if !state.main_revealed.load(Ordering::Relaxed) {
                    let _ = window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // 哈希计算
            calculate_hash,
            quick_calculate_hash,
            compute_hashes,
            verify_checksum_file,
            pause_hash_calculation,
            resume_hash_calculation,
            cancel_hash_calculation,
            // 右键菜单报告窗
            get_context_request,
            reveal_main_window,
            maybe_exit,
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
            export_verification_files,
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
            context_request: Arc::new(Mutex::new(None)),
            main_revealed: Arc::new(AtomicBool::new(false)),
            pending_paths: Arc::new(Mutex::new(Vec::new())),
            pending_algorithm: Arc::new(Mutex::new(HashAlgorithm::SHA256)),
            pending_verify: Arc::new(Mutex::new(false)),
            pending_compare: Arc::new(Mutex::new(false)),
            dispatch_timer: Arc::new(AtomicBool::new(false)),
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
            context_request: Arc::new(Mutex::new(None)),
            main_revealed: Arc::new(AtomicBool::new(false)),
            pending_paths: Arc::new(Mutex::new(Vec::new())),
            pending_algorithm: Arc::new(Mutex::new(HashAlgorithm::SHA256)),
            pending_verify: Arc::new(Mutex::new(false)),
            pending_compare: Arc::new(Mutex::new(false)),
            dispatch_timer: Arc::new(AtomicBool::new(false)),
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
            context_request: Arc::new(Mutex::new(None)),
            main_revealed: Arc::new(AtomicBool::new(false)),
            pending_paths: Arc::new(Mutex::new(Vec::new())),
            pending_algorithm: Arc::new(Mutex::new(HashAlgorithm::SHA256)),
            pending_verify: Arc::new(Mutex::new(false)),
            pending_compare: Arc::new(Mutex::new(false)),
            dispatch_timer: Arc::new(AtomicBool::new(false)),
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
