# Project Progress

> 记录当前任务状态、分支和最近进展。每次会话更新。

---

## 当前状态

- **当前分支**：`master`（仓库尚无任何 commit；工作区同时包含遗留 PyQt 代码与 Tauri 2 迁移代码）
- **最后更新**：2026-08-09
- **当前阶段**：PyQt → Tauri 2 迁移（进行中）

### 迁移阶段概览（依据 `docs/PyQt_to_Tauri2_迁移指令.md` 六阶段）

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1 项目分析 | 扫描 PyQt 代码、输出模块/组件/逻辑/信号清单 | ✅ 已完成（旧架构描述见 `docs/AGENTS.md` 与 `.github/copilot-instructions.md`） |
| 2 技术方案设计 | React+TS+Tailwind+Zustand、Rust Command 划分、IPC 设计 | ✅ 已完成（`tauri-app/` 结构按此搭建） |
| 3 项目初始化 | tauri-app 脚手架 + 配置（tauri.conf / Cargo.toml / vite） | ✅ 已完成 |
| 4 逐步迁移 | Rust 后端 commands + 前端组件 | 🔶 大部分完成（见下） |
| 5 联调与测试 | 功能验证 / UI 对比 / 边界测试 / 性能 | ⬜ 未开始 |
| 6 打包与部署 | NSIS 安装包、签名 | ⬜ 未开始（`tauri.conf.json` 已配 nsis target） |

### 已迁移内容（`tauri-app/`）

- **Rust 后端**（`src-tauri/src/commands/`）：
  - `hash.rs`：`calculate_hash`（8KB 分块读 + 逐块 emit `hash-progress`）、`quick_calculate_hash`（>10MB 只读前 10MB）、暂停/恢复/取消命令。
  - `batch.rs`：`start_batch_validation`（单 command 内顺序处理，逐文件 emit `batch-file-complete`，结束 emit `batch-complete`）。
  - `config.rs`：`config.json` / `history.json`（存 app data 目录，历史 50 条、同路径同算法去重）。
  - `export.rs`：CSV（UTF-8 BOM）/ JSON / 验证文件生成与导入。
  - `filesystem.rs`：`scan_directory`（walkdir 递归）、文件/文件夹/保存对话框。
  - `AppState`：`pause_flag` / `cancel_flag`（AtomicBool）、`hash_cache`（键 `(file_size, algorithm)`）、`batch_results`。
- **前端**（`src/`）：`App.tsx`（配置加载 + 事件监听）、`store/appStore.ts`（Zustand）、`services/api.ts`（invoke 唯一封装）、布局组件（Header / MenuBar / Sidebar / StatusBar）、功能区（FileList / HashVerification / ProgressSection / ResultSection）、对话框（History / Settings / QuickGuide）、i18n（zh/en）、快捷键 hook。
- **构建**：`tauri-app/dist/` 存在前端构建产物；本会话未实际运行 `tauri dev` / `tauri build` 验证。

### 已核查的缺口 / 问题（详见 `debug-log.md`）

- BUG-001：暂停/恢复无效——`pause_flag` 在哈希计算循环中从未被轮询。
- BUG-002：前端 `types.ts`（camelCase）与 Rust serde 字段（snake_case）不一致，事件负载字段读取为 undefined。
- BUG-003：`services/api.ts` 调用的 `get_batch_statistics` 命令未在 `lib.rs` 注册。
- BUG-004：哈希缓存键 `(file_size, algorithm)`，同大小不同文件会误命中。

### 遗留代码（仅迁移参考，默认不修改）

- `src/`：PyQt5 模块（app / main / hash_worker / batch_manager / config / file_list / exporter）
- `scripts/`：build_exe / diagnose / rebuild（PyInstaller 打包/诊断）

### 文档地图

- `docs/AGENTS.md`：PyQt 版架构描述（**已过时**，勿据此判断当前代码结构）
- `docs/PyQt_to_Tauri2_迁移指令.md`：迁移规格（权威参考）
- `docs/README.md` / `docs/QUICK_START.md` / `quick_start.html`：PyQt 版用户文档（已过时）
- `CLAUDE.md`：仓库指引（活跃代码 = `tauri-app/`）
- `docs/.AI/`：本过程文档（进度 / 决策 / 犯错记录）

## 待办

- 阶段 5 联调：逐功能验证、UI 对比、边界测试（需先明确验收口径，见讨论）
- 阶段 6 打包：`npm run tauri build` 验证 NSIS 产物
- 修复 BUG-001~004（涉及功能可用性，优先级待定）
- git 首次提交基线（当前 master 无 commit）
