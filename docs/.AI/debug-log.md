# Debug Log

> 反复调试的 bug 记录。只追加，不删除历史。

---

## BUG-005: 文件拖放（drag-drop）完全失效 — Tauri 2 拖放事件与全局 preventDefault 竞态

- **日期**：2026-08-10
- **现象**：文件只能通过点击窗口弹出文件选择对话框添加，无法把文件直接拖入窗口加载。
- **根因分析**：
  - Tauri 2 的拖放由 **Rust 层接管**（`getCurrentWebview().onDragDropEvent` / `WindowEvent::DragDrop`），与浏览器原生 `drag`/`drop` 事件是两套独立机制。前端 `onDragDropEvent` 注册成功后，Rust 侧 `WindowEvent::DragDrop` 不再派发（**单消费者**）。因此整条拖放链路唯一依赖 `FileList.tsx` 的 `onDragDropEvent` 成功，App.tsx 中监听的 `files-dropped`（Rust 兜底）在前端注册成功后**不会触发**——`.catch` 里"依赖 Rust 兜底"的注释是误导性的。
  - `App.tsx` 第 77-90 行的 `useEffect` 在**整个 window** 上注册了原生 `dragover`/`drop` 的 `preventDefault`（注释误以为"WebView2 只有 preventDefault 才触发 onDragDropEvent"）。这与 Tauri 拖放机制**竞态**：在 WebView2 下会干扰页面原生 drag 事件，使 `FileList` 基于 `e.dataTransfer.types.includes("Files")` 的 HTML5 拖拽高亮不稳定，并制造两套机制同时处理同一拖放的竞态，导致拖放实际无效。
  - 修复：移除全局 `preventDefault`，改为仅阻止"非文件拖放"（拖入图片/链接）被浏览器直接打开；明确 Tauri 拖放数据来自 `onDragDropEvent(payload.paths)`。
- **影响**：拖放功能不可用，只能走文件选择对话框。
- **状态**：resolved（移除冲突的全局 preventDefault；capabilities 中 `core:default` 已含 `core:webview:allow-on-drag-drop-event`，权限充足；`onDragDropEvent` 链路 `paths → processPaths → addFiles` 完整可用）
- **验证建议**：`tauri dev` 运行后拖入文件，观察 `FileList.tsx` 第 95 行 `[drag-drop]` 日志；若仍无日志，检查 webview 构建是否带 drag-drop 支持（`tauri.conf.json` 中 `app.windows[].dragDropEnabled` 必须为 true，当前已为 true）。

---

## BUG-001: 暂停/恢复功能无效 — pause_flag 在哈希计算循环中从未被轮询

- **日期**：2026-08-09
- **现象**：前端可调用 `pause_hash_calculation` / `resume_hash_calculation`，但哈希计算照常执行，界面无暂停效果（单文件与批量均如此）。
- **根因分析**：
  - `commands/hash.rs` 的 `do_calculate_hash` 分块读取循环只检查 `state.cancel_flag.load(...)`，从未读取 `state.pause_flag`。`pause_hash_calculation` 仅把 flag 置 true，没有消费方 → no-op。
  - `commands/batch.rs` 的批量循环只在「文件之间」检查 `cancel_flag`，`process_single_file` 内层循环完全不检查任何 flag，更不检查 pause。
- **影响**：暂停/恢复按钮无实际作用（迁移自 PyQt 原版的暂停/继续功能丢失）。
- **状态**：resolved（P0-2/3/4 修复：分块循环逐块调用 `AppState::check_interrupted` 轮询 pause_flag）

---

## BUG-002: 前端 types.ts 字段名与 Rust serde 不一致 — 事件负载读取 undefined

- **日期**：2026-08-09
- **现象**：`App.tsx` 在 `batch-file-complete` / `batch-complete` / `hash-progress` 事件中读取 `payload.path` / `payload.hash` / `payload.elapsed` / `payload.fromCache` / `payload.filePath`（camelCase）；`services/types.ts` 定义同款 camelCase 类型。
- **根因分析**：Rust `models/types.rs` 序列化为 snake_case 字段（`file_path` / `hash_value` / `elapsed_time` / `status`），Tauri 事件负载按 serde 原样下发，不做 camelCase 转换（仅 command 参数名会转 camelCase，事件负载不会）。且 `HashResult` 无 `fromCache` 字段、`HashProgress` 为 `file_path`（TS 写成 `filePath`）。
- **影响**：批量/进度事件中文件名、哈希、耗时可能显示 undefined；缓存标记逻辑缺失。
- **状态**：resolved（P0-1 统一契约：Rust DTO `rename_all=camelCase` + `HashAlgorithm` lowercase + `BatchResult` 扁平 + `fromCache`）

---

## BUG-003: api.ts 调用未注册的 Tauri command `get_batch_statistics`

- **日期**：2026-08-09
- **现象**：`services/api.ts` 的 `getBatchStatistics()` 执行 `invoke("get_batch_statistics")`。
- **根因分析**：`lib.rs` 的 `invoke_handler` 注册了 18 个命令，其中**没有** `get_batch_statistics`。调用会返回 command not found。
- **影响**：批量统计获取接口不可用（是否有前端调用点需确认）。
- **状态**：resolved（P0-1：该封装无任何调用点，属死代码，直接删除而非注册无用命令）

---

## BUG-004: 哈希缓存键 (file_size, algorithm) — 同大小不同文件误命中

- **日期**：2026-08-09
- **现象**：缓存命中条件为「文件大小 + 算法」二元组。
- **根因分析**：两个大小完全相同的不同文件命中同一缓存条目，返回错误的哈希值。该设计沿袭自 PyQt 原版（`batch_manager.py` 的 `hash_cache[(file_size, algorithm)]`），迁移时原样保留。
- **影响**：同大小文件批量校验时可能得到错误哈希（正确性风险）。
- **状态**：resolved（P0-4：缓存键改为 `(文件路径, 文件大小, 修改时间纳秒, 算法)`，路径保证同文件、mtime 检测改动）

---

## BUG-005: 自绘标题栏后窗口无法拖拽移动 — capabilities 缺少窗口操作权限

- **日期**：2026-08-10
- **现象**：适配自定义标题栏（`decorations: false` + `data-tauri-drag-region`）后，窗口能正常显示，但拖拽标题栏无法移动窗口；最小化/最大化/关闭按钮也无效。
- **根因分析**：`src-tauri/capabilities/default.json` 从未配置任何 `core:window:*` 权限。Tauri 2 的 `data-tauri-drag-region` 属性底层调用 `window.start_dragging()` IPC 命令，与最小化/最大化/关闭/setSize/setPosition 一样都需要 capabilities 显式授权。无权限时属性被静默忽略，不报错但不生效。对比 AIVault（同款自绘标题栏，能正常拖拽）的 `capabilities/default.json` 显式包含 `core:window:allow-start-dragging` 等权限。
- **影响**：窗口无法拖拽移动；TitleBar 的最小化/最大化/关闭按钮全部失效；App.tsx 恢复窗口几何的 setPosition/setSize 也被权限拦截。
- **状态**：resolved（补齐 `core:window:allow-start-dragging` / `allow-minimize` / `allow-toggle-maximize` / `allow-is-maximized` / `allow-close` / `allow-set-size` / `allow-set-position` / `allow-show` 权限）
- **教训**：Tauri 2 的 capabilities 权限模型是白名单制，HTML 属性（`data-tauri-drag-region`）和 JS API（`window.minimize()` 等）都依赖对应权限授权。新增自绘标题栏时必须同步配置窗口操作权限，否则属性/API 被静默忽略且无报错，难以定位。
