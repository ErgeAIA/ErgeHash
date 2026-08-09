# Decision Log

> 偏离 PRD 或做出重要技术选择时在此追加记录。只追加，不删除或改写历史。

---

## DEC-007: 迁移收尾（清理 PyQt + tauri-app 上移根目录）暂缓至桌面验收完成

- **日期**：2026-08-10
- **背景**：迁移功能与打包已完成，考虑收尾——清理 PyQt 遗留、将 `tauri-app/` 上移为标准 Tauri 项目结构。
- **决策**：
  1. **暂缓收尾**，条件 = 桌面验收完成（`npm run tauri dev` 对照 `feature-checklist.md` 逐项通过运行期行为：拖放/暂停/导出/导入/历史/记事本/窗口几何）。
  2. **PyQt `src/*.py` 验收前保留**作行为对照参考；验收通过即过期可删。
  3. **已过期可直接删**：`scripts/`、`pyproject.toml`、`requirements.txt`、`uv.lock`、`HashValidatorPlus.spec`、`resources/`（打包件，Tauri 有替代）。
  4. **上移前提**：`tauri-app/src/`（React）与根目录 `src/`（PyQt）重名，必须先清 PyQt 再 `git mv` 上移；前端 `src/ public/ index.html vite.config.ts tsconfig*.json package*.json pnpm-lock.yaml` + `src-tauri/` + `BUILD*.md`。
  5. 收尾后同步：`CLAUDE.md` 路径、根 `.gitignore`（合并 node_modules/target/dist）、删除/归档 PyQt 版文档（docs/README、QUICK_START、AGENTS、迁移指令）。
- **影响**：当前工作区保持"PyQt + Tauri 共存"直至验收；`ruff` 检查继续生效（pyproject 存在）。
- **状态**：active（待桌面验收后触发执行）

---

## DEC-006: P0-P3 实施决策（契约 / 缓存 / 历史 / 收敛）

- **日期**：2026-08-10
- **背景**：按 `migration-plan.md` 实施 P0-P3，执行中对关键设计点做了第一性原理决策。
- **决策**：
  1. **HashAlgorithm serde 改 lowercase**：前端传小写算法名，此前 UPPERCASE 使所有带算法命令运行期反序列化失败（比 BUG-002 更严重的隐藏缺陷）。
  2. **删除 getBatchStatistics 死代码而非注册命令**（BUG-003）：无任何调用点，注册即制造死命令。
  3. **缓存键 `(path, size, mtime_nanos, algorithm)`**（BUG-004）：路径保证同文件正确、mtime 检测内容改动，消除跨文件误命中（放弃 PyQt 的跨文件同内容去重——那是错误源头）。
  4. **历史记录写入**（P1-3）：PyQt 原版 `add_history` 从未被调用（历史恒空）。本次在 batch-complete 顺序 await 写入使其可用，避免并发读写竞态。
  5. **Ctrl+C 复制哈希不实现**（P3-3）：webview 原生 Ctrl+C 复制选中文本，全局劫持不友好，记录偏离。
  6. **移除 Settings 假 GitHub 占位链接**（P3-5）：无真实仓库地址，不发布假链接。
- **影响**：见各阶段提交（`6bb0a83`/`4415131`/`11ff78a`/`ab66e75`/`642cec9`）。
- **状态**：active

---

## DEC-005: git 基线提交 + .gitignore 调整（docs/ 与 resources/icons/ 纳入跟踪）

- **日期**：2026-08-09
- **背景**：master 零 commit，无法回滚迁移改动。经用户批准提交全量基线，并纳入项目文档与图标。
- **决策**：
  1. 首次提交基线 `1aa9681`（93 文件）：遗留 PyQt（`src/`、`scripts/`）+ Tauri 2 应用（`tauri-app/`）+ 项目文档（`docs/` 含 `.AI/` 过程文档）。
  2. 仓库 `.gitignore` 取消 `docs/` 忽略（项目文档应受版本管理）；新增 `!resources/icons/` 放行图标（被全局 `Icon?` 规则误伤，打包需要）。
  3. 全局 `C:/Users/GigaByte/.gitignore_global` 删除 `.ai/` 规则（`docs/.AI/` 目录名与之冲突；仅删此条，`.aiignore`/`AGENTS.md` 保留）。
- **影响**：迁移改动可回滚；docs 与图标受版本管理。`docs/AGENTS.md` 与 `CLAUDE.md` 仍被全局规则忽略（尊重全局，不进库）。
- **状态**：active

---

## DEC-001: PyQt5 → Tauri 2 全量重构

- **日期**：2026-08-09
- **背景**：原应用基于 PyQt5（Python + Qt）。用户决定改用 Tauri 2 重构（Rust 后端 + Web 前端），要求功能保留、UI 一致。
- **决策**：
  1. 技术栈：Tauri 2 + Rust 后端 + React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + i18next。
  2. 后端按领域划分 Command：hash / batch / config / export / filesystem；`AppState` 持有暂停/取消标志、哈希缓存、批量结果。
  3. 前端 `services/api.ts` 作为 invoke 唯一封装；进度与结果经事件驱动（`hash-progress` / `batch-file-complete` / `batch-complete`）。
  4. 迁移规格见 `docs/PyQt_to_Tauri2_迁移指令.md`（6 阶段）。
- **影响**：`tauri-app/` 成为活跃代码；旧 PyQt 代码保留于 `src/`、`scripts/`。
- **状态**：active

---

## DEC-002: 遗留 PyQt 代码保留为只读参考

- **日期**：2026-08-09
- **背景**：迁移期间需对照原实现。
- **决策**：`src/`、`scripts/` 下 PyQt 代码仅作参考，默认不修改；除非用户明确要求。
- **影响**：迁移任务聚焦 `tauri-app/`。
- **状态**：active

---

## DEC-003: 建立 docs/.AI 项目过程文档（进度 / 决策 / 犯错）

- **日期**：2026-08-09
- **背景**：参照 AIVault 项目实践，建立项目过程记录作为迁移事实源。
- **决策**：在 `docs/.AI/` 建立 `project-progress.md` / `decision-log.md` / `debug-log.md`，格式对齐 AIVault 样板（只追加、不改写历史；DEC-xxx / BUG-xxx 编号）。
- **影响**：后续迁移决策与 bug 在此落盘。
- **状态**：active

---

## DEC-004: 遗留 Python 代码 lint 清理（不改变行为）

- **日期**：2026-08-09
- **背景**：全局 Stop hook 的 `ruff check .` 在 4 处遗留 PyQt 代码失败，阻断任务收尾。
- **决策**：经用户确认，修复 4 处静态问题（未使用导入 / 未使用变量 / 裸 except），不改变任何行为。
- **影响**：`src/app.py`、`src/main.py`、`scripts/rebuild.py` 共 4 处清理；`ruff check .` 通过。
- **状态**：active
