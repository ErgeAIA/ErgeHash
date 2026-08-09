# 迁移实施计划：PyQt → Tauri 2 功能补齐

> 目标：对照 `docs/.AI/feature-checklist.md` 将 `tauri-app/` 补齐到与 PyQt 原版**功能对等**（UI 按新设计，不追溯 PyQt 视觉）。已决策：BUG-004 缓存键修正正确性；每包完成后单独 git commit。

## P0 核心链路修复（后端 Rust + 前后端契约）

| # | 事项 | 涉及 | 验证 |
|---|------|------|------|
| P0-1 | **统一前后端数据契约**（BUG-002）：Rust 结构加 `#[serde(rename_all = "camelCase")]`（HashResult/HashProgress/BatchResult/HistoryEntry/AppConfig/VerificationEntry）；`BatchResult` 改扁平（results + total/success/error/mismatch/totalTime）；`HashResult` 增 `from_cache` 标记（缓存命中路径置 true）；`types.ts` 与 `App.tsx` 同步对齐 | `models/types.rs`、`commands/batch.rs`、`commands/hash.rs`、`services/types.ts`、`App.tsx` | `cargo check` + `npm run build`（tsc） |
| P0-2 | **修复暂停/恢复**（BUG-001）：`hash.rs` 分块循环轮询 `pause_flag`（暂停时短眠直到清除/取消）；`batch.rs` 同理 | `commands/hash.rs`、`commands/batch.rs` | 桌面验证暂停/继续生效 |
| P0-3 | **批量取消内层响应**：`batch.rs` `process_single_file` 内层循环检查 `cancel_flag` | `commands/batch.rs` | 大文件批量取消立即停止 |
| P0-4 | **缓存键修正**（BUG-004）：`(file_size, algorithm)` → `(file_size, modified, algorithm)`（mtime 参与，消除同大小误命中） | `commands/hash.rs`、`commands/batch.rs`、`lib.rs` AppState | 同大小不同内容文件分别命中 |
| P0-5 | **`get_batch_statistics` 注册**（BUG-003）：`lib.rs` 注册命令（返回 `batch_results` 统计，与 PyQt `get_statistics` 对应）或删除 api.ts 封装（二选一，倾向注册） | `lib.rs`、`services/api.ts` | invoke 不报 command not found |

## P1 补齐缺失功能

| # | 事项 | 涉及 | 验证 |
|---|------|------|------|
| P1-1 | **导出结果**：前端加导出按钮 + 菜单接线（`export-results` 事件已有 dispatch，补 App.tsx 监听）；save 对话框 + export_csv/json/generate_verification_file | `App.tsx`、`ResultSection.tsx`（或新 ExportDialog）、`services/api.ts` | 导出 CSV/JSON/验证文件内容正确 |
| P1-2 | **导入验证文件**：菜单 `import-verification` 补监听；open 对话框 + import_verification_file，解析结果填入预期哈希区 | `App.tsx`、`HashVerification.tsx` | 导入 .txt/.sha/.md5 正确解析 |
| P1-3 | **历史记录写入**：批量完成 / 单文件计算后调 `addHistory`（当前从未调用，历史恒空） | `ResultSection.tsx`、`App.tsx` | 计算后历史有记录 |
| P1-4 | **批量处理文件夹**（Ctrl+B）：修正 MenuBar `batch_process` —— `openFolderDialog` → `scanDirectory` → `addFiles`（当前把文件夹路径当文件加列表，损坏）；PyQt 的独立确认+结果弹窗流程按新 UI 简化 | `MenuBar.tsx` | 选文件夹后列表为文件 |
| P1-5 | **记事本**：新增 Tauri command（`open_notepad`，spawn notepad.exe）或前端经 opener 打开；Sidebar onClick 接线 | `commands/`、`lib.rs`、`Sidebar.tsx`、`services/api.ts` | 点击打开系统记事本 |
| P1-6 | **拖放修复**：改用 Tauri 2 `getCurrentWebview().onDragDropEvent`（`tauri://drag-drop` 事件取真实路径），替换失效的 `File.path` | `FileList.tsx` | 拖放文件/文件夹进列表 |

## P2 配置持久化

| # | 事项 | 涉及 | 验证 |
|---|------|------|------|
| P2-1 | 主题切换 → `setConfig("theme", ...)` | `appStore.ts` 或 Header/Settings | 重启后主题保持 |
| P2-2 | 语言切换 → `setConfig("language", ...)` | 同上 | 重启后语言保持 |
| P2-3 | 算法选择 → `setConfig("algorithm", ...)` | `Sidebar.tsx` | 重启后算法保持 |
| P2-4 | 窗口几何保存/恢复（可选） | `App.tsx` | 重启后窗口位置保持 |

## P3 行为对齐与收尾

| # | 事项 | 决策 |
|---|------|------|
| P3-1 | 快速比较对齐 PyQt 语义：>1GB 只读前 5MB，≤1GB 全读（当前固定前 10MB，小文件误判） | 对齐（`commands/hash.rs`） |
| P3-2 | 复制结果格式：仅复制哈希行（批量=`文件名: 哈希`多行），非整个 resultText | 对齐（`appStore.copyResult`） |
| P3-3 | Ctrl+C 复制哈希：**不实现**——webview 原生 Ctrl+C 复制选中文本，全局劫持不友好（偏离 PyQt，理由充分） | 记录偏离 |
| P3-4 | 清空列表 / 清空历史加确认（`dialog:ask`） | 补齐 |
| P3-5 | Settings 里 GitHub 占位假链接：改为真实仓库地址（待用户提供） | 待用户输入 |
| P3-6 | 批量统计中 mismatch 字段展示 | 随 P0-1 契约对齐 |

## P4 验收

1. `cargo check` + `cargo test`（后端）
2. `npm run build`（tsc + vite，前端类型）
3. `npm run tauri dev` 桌面逐项验收，对照 `feature-checklist.md` 标记 ✅/❌
4. `npm run tauri build` 验证 NSIS 打包产物

## 执行顺序与提交

- P0 → P1 → P2 → P3 → P4，每包完成后单独 commit（描述含 DEC/BUG 编号）。
- 遇到 bug 先 `systematic-debugging` 定位根因再改；每轮结束跑 ruff / cargo / npm 验证。
- 遗留 PyQt 代码在迁移完成后删除（用户已确认，项目收尾时执行）。
