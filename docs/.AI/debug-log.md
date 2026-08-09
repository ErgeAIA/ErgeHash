# Debug Log

> 反复调试的 bug 记录。只追加，不删除历史。

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
