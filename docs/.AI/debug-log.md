# Debug Log

> 反复调试的 bug 记录。只追加，不删除历史。

---

## BUG-005: 文件拖放（drag-drop）完全失效 — vendor 改动的 wry 删除了原版 OLE 拖放注册机制

- **日期**：2026-08-10 发现，2026-08-14 收口
- **现象**：无法将文件从资源管理器直接拖入 Tauri 无边框窗口加入哈希校验列表，只能走"打开文件"对话框。拖入时无高亮、无日志、列表无新增。
- **根因分析（最终）**：
  - 本地对 `wry 0.55.1` 做了 vendor 改动（`[patch.crates-io]` 指向 `src-tauri/vendor/wry`），删掉了 wry 原版"枚举 WebView2 子窗口注册 `IDropTarget`"的机制，替换为 container/root 注册 + 延迟重注册 + `WM_TIMER` 自愈方案。这套改动本身破坏了拖放：wry 注入的 OLE `IDropTarget` 根本没触发，JS `onDragDropEvent` 与 Rust `on_window_event(DragDrop)` 都收不到事件。
  - 同技术栈、同 wry 版本、使用 registry 原版的 AIVault 全程拖拽正常，即铁证。修复 = 移除 `[patch.crates-io]`、wry 回归 registry 原版（Cargo.lock 的 wry 段回到 `source=registry+...` + checksum）。
- **排查脉络（曾误判，均已推翻）**：根因历经四轮翻转——① 误判"全局 `preventDefault` 与 Tauri 拖放竞态 / 单消费者"；② 误判"DOM `drag*` 监听接管 WebView2 拖放链"；③ 误判"`data-tauri-drag-region` 与 wry OLE 拖放平台冲突"。三者均有同项目/同栈实证支撑，但都只是必要条件（必要非充分），最终经**同栈对照（ErgeMD/AIVault）** 收敛到 vendor wry 改动这一唯一实质差异。中间结论详见下方「拖放经验提炼」E8~E11。
- **影响**：文件拖放核心功能不可用（P1）。
- **状态**：resolved（2026-08-14 移除 vendor patch、wry 回归 registry 原版 0.55.1，`cargo check` 通过；2026-08-14 用户实测 `pnpm run tauri dev` 拖放正常）。
- **验证**：拖入文件后 `FileList.tsx` 的 `onDragDropEvent` 收到 `type=enter/over/drop`，文件进入列表；代码库无 DOM `drag*` 监听、无 `data-tauri-drag-region`。

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

## BUG-007: 自绘标题栏后窗口无法拖拽移动 — capabilities 缺少窗口操作权限

- **日期**：2026-08-10
- **现象**：适配自定义标题栏（`decorations: false` + `data-tauri-drag-region`）后，窗口能正常显示，但拖拽标题栏无法移动窗口；最小化/最大化/关闭按钮也无效。
- **根因分析**：`src-tauri/capabilities/default.json` 从未配置任何 `core:window:*` 权限。Tauri 2 的 `data-tauri-drag-region` 属性底层调用 `window.start_dragging()` IPC 命令，与最小化/最大化/关闭/setSize/setPosition 一样都需要 capabilities 显式授权。无权限时属性被静默忽略，不报错但不生效。对比 AIVault（同款自绘标题栏，能正常拖拽）的 `capabilities/default.json` 显式包含 `core:window:allow-start-dragging` 等权限。
- **影响**：窗口无法拖拽移动；TitleBar 的最小化/最大化/关闭按钮全部失效；App.tsx 恢复窗口几何的 setPosition/setSize 也被权限拦截。
- **状态**：resolved（补齐 `core:window:allow-start-dragging` / `allow-minimize` / `allow-toggle-maximize` / `allow-is-maximized` / `allow-close` / `allow-set-size` / `allow-set-position` / `allow-show` 权限）
- **教训**：Tauri 2 的 capabilities 权限模型是白名单制，HTML 属性（`data-tauri-drag-region`）和 JS API（`window.minimize()` 等）都依赖对应权限授权。新增自绘标题栏时必须同步配置窗口操作权限，否则属性/API 被静默忽略且无报错，难以定位。

---

## BUG-006: 输入框「品牌色边框」改为黑色/默认 — Tailwind v4 自定义变量体系下 `border-primary`/`ring-primary` 不自动解析

- **日期**：2026-08-11
- **现象**：`ExpectedHashSection` 的 `Textarea` 期望用主题品牌色（`--primary`）的 1px 边框替代默认深色边框，但加了 `border-primary focus-visible:ring-primary` 后界面仍是**黑色/默认边框**，品牌色未生效。
- **根因分析**：
  - 项目用 Tailwind v4 + **自定义 CSS 变量体系**（只有 `--primary`/`--ring`/`--border` 等语义变量，**没有** `--color-*` 主题映射）。
  - 在这个体系下，任意 `*-primary` / `*-ring` / `border-*` / `text-*` / `bg-*` / `ring-*` 等 utility **不会自动解析为对应 CSS 变量**。写上 `border-primary`/`ring-primary` 等于没有该规则，元素回退到浏览器默认或组件基类样式（黑边框）。
  - 此前 NavRail 修复时已踩过同类坑（`text-primary`/`bg-primary/10` 失效），当时补了 `.text-primary`/`.bg-primary-alpha` 等映射，但**漏了 `.border-primary` 和 `.ring-primary`**。本轮新的颜色 utility 直接复用旧错，未先确认 `index.css` 是否已有映射。
  - `pnpm run build` 不会报错（CSS 里压根没生成对应规则），**构建通过 ≠ 样式生效**，导致问题延迟到用户实测截图才发现。
- **影响**：输入框边框改色需求未满足，视觉与"品牌色一致"目标偏离。
- **状态**：resolved（在 `src/styles/index.css` 显式补两条映射：`.border-primary { border-color: var(--primary); }`、`.ring-primary { --tw-ring-color: var(--primary); }`；`ExpectedHashSection.tsx` 的 `Textarea` className 维持 `border-primary focus-visible:ring-1 focus-visible:ring-primary hover:border-primary`，映射补上后即生效）
- **教训**：
  1. 在自定义变量体系里引入**任意新的 `*-primary` / `*-ring` / `border-*` / `*-warning` / `*-destructive` 等 utility 前，先确认 `index.css` 是否已有对应显式映射**，没有就先补映射再写 className。已显式定义的映射见 `index.css`：`.bg-primary`、`.bg-primary-alpha`、`.text-primary`、`.text-destructive`、`.text-warning`、`.border-primary`、`.ring-ring`、`.ring-primary`、`.bg-sidebar` 等。
  2. **视觉改动不能只靠 `pnpm run build` 验证**——构建通过只说明编译无误，不代表 Tailwind 生成了对应规则。必须用户实测截图确认样式真实生效。
  3. 同理，Tailwind 的 opacity 修饰符（`bg-primary/10`、`border-primary/80`）在自定义变量下也失效，需用 `color-mix` 定义 `--xxx-alpha` + 显式类替代。

---

## 经验提炼（跨项目可复用，已蒸馏进 docs/design-system.md）

> 从以上 bug 与设计决策中沉淀的**实现约束**。详细规范见 `docs/design-system.md` 的「二之一 / 二之二 / 三.10」与交互约束条款。

### E1. Tailwind v4 + 自定义 CSS 变量体系：颜色/边框/ring 工具类不会自动解析
- 项目只有 `--primary`/`--ring`/`--border` 等语义变量，**没有 `--color-*` 映射**。直接写 `border-primary`/`ring-primary`/`text-primary` 等于无此规则，元素回退默认样式（如黑边框），**构建不报错但视觉不生效**。
- 规则：新增任意 `*-primary`/`*-ring`/`border-*`/`ring-*`/opacity 修饰符（`/N`）前，先查 `index.css` 是否已有显式映射；没有先补再写。opacity 修饰符需改用 `color-mix` 定义 `--xxx-alpha` + 显式类。
- 来源：BUG-006 + 此前 NavRail `text-primary`/`bg-primary/10` 失效。
- 规范落点：`design-system.md` §二之一。

### E2. 构建通过 ≠ 样式生效
- `pnpm run build` 仅验证编译；Tailwind 未生成对应规则时静默通过。所有视觉改动必须**用户实测截图确认**。
- 来源：BUG-006 教训 2。
- 规范落点：`design-system.md` §二之一（告警行）。

### E3. Tauri 2 capabilities 是白名单制，权限缺失会静默失效
- `data-tauri-drag-region` 与 `window.minimize()/close()/setSize()`、`onDragDropEvent` 等均需 `capabilities/default.json` 显式授权；缺失时**不报错但无效**，难定位。
- 自绘标题栏（`decorations:false`）必须配置 `core:window:allow-start-dragging` / `allow-minimize` / `allow-toggle-maximize` / `allow-is-maximized` / `allow-close` / `allow-set-size` / `allow-set-position` / `allow-show`；`core:default` 已含 drag-drop 权限。
- 来源：BUG-007（窗口移动权限，含 `data-tauri-drag-region` 底层 `start_dragging` 授权）。
- 规范落点：`design-system.md` §二之二。

### E4. Tauri 2 拖放：禁止任何 DOM drag* 监听
- 拖放数据唯一来源是 `getCurrentWebview().onDragDropEvent(payload.paths)`；**禁止**任何 DOM `drag*` 监听（含 window 级 `dragover`/`drop` 与组件根 div 的 `onDragEnter/Over/Leave/Drop`）——注册即接管 WebView2 拖放链，使 Tauri 原生事件完全失效（ErgeMD 实证）。
- 早期"全局 `preventDefault` 与拖放竞态 / 单消费者"论断已证伪；正确做法是彻底不写 DOM drag* 监听，高亮由 Tauri `enter/over/leave` 驱动。
- 完整实现指南 / 陷阱清单 / 排查 SOP 见 E8~E11（BUG-005 终章资产）。
- 来源：BUG-005（终章更正）。
- 规范落点：`design-system.md` 交互约束条款 8（已存在）。

### E5. 可视化组件不要内联手写，统一用 components/ui 抽象
- 开关（Switch）、按钮（Button）、对话框（Dialog）等有状态/主题联动的组件，必须抽成 `src/components/ui/*` 复用，禁止在业务组件里重复手写（如手写 switch 易出现圆点位置错位、深色主题圆点缺对比等问题）。
- Switch 范式：开启背景 `bg-primary`、关闭 `bg-muted`；圆点浅色 `bg-white`/深色 `dark:bg-black`，开启居右用 `translate-x-[calc(100%+3px)]`（不用固定 `translate-x-4`）。
- 来源：2026-08-12 设置页开关样式修复。
- 规范落点：`design-system.md` §三.10。

### E6. 设计细节方向可由实现方主张，不改写既有约定
- 布局/按钮方向等细节在合理范围内可直接主张（如 FAB 竖排优于横排、NavRail 底部徽章展开横排/折叠竖排），不必逐条请示；仅关键歧义或高风险（删文件、改密钥、改 DB schema、push force 等）才先反问确认。
- 来源：工作协议 + 多轮菜单/NavRail 决策。

### E7. 重大视觉重构先看 git 历史与原组件，不要无脑覆盖
- 顶栏"不见了"曾误判为新增 TitleBar 问题，实际指向历史 `Header.tsx`；视觉问题优先 `git log` + `git show <commit>:path` 反推，而非在当前错误基础上改。
- 来源：已知坑（写入 MEMORY.md）。

### E8. Tauri 2 文件拖放：同栈实现指南（BUG-005 终章资产）
> ErgeMD / AIVault 双项目实证，直接照抄。
1. **唯一事件入口**：`getCurrentWebview().onDragDropEvent`，路径来自 `event.payload.paths`（OS 绝对路径）。Rust `WindowEvent::DragDrop` 与 JS 同源派发，任选其一消费。
2. **自绘标题栏拖拽**：`onMouseDown`（仅左键）+ `getCurrentWindow().startDragging()`。**禁用** `data-tauri-drag-region`。
3. **配置**：`tauri.conf.json` 窗口 `dragDropEnabled: true`。
4. **权限**：capabilities 用 `core:default`（含 `core:webview:allow-on-drag-drop-event`）；窗口操作（start-dragging/minimize/toggle-maximize/close 等）需显式授权，否则静默失效。
5. **拖拽高亮**：由 `onDragDropEvent` 的 `enter/over/leave` 驱动，不依赖 HTML5 drag。
6. **保持底层库为 registry 原版**：禁止 vendor/patch 修改 wry / tauri-runtime-wry。

### E9. 拖放失效陷阱清单（BUG-005 终章资产）
| 陷阱 | 现象 | 规避 |
| --- | --- | --- |
| DOM `drag*` 监听（含 window 级、`onDragEnter/Over/Leave/Drop`） | `onDragDropEvent` 注册成功但 enter/over/drop 全不来 | 代码库一处不留；高亮改由 Tauri 事件驱动 |
| `data-tauri-drag-region` | Windows 下与 wry OLE 文件拖放冲突，全窗口失效 | 一律 `onMouseDown + startDragging()` |
| capabilities 权限缺失 | 属性/API 被静默忽略、无报错 | `core:default` + 显式窗口权限 |
| vendor/patch 底层库（wry） | 破坏原版"枚举子窗口注册 IDropTarget"机制，拖放全失效 | 保持 registry 原版；疑底层先做同栈对照 |
| 对 WebView2 子窗口用陈旧句柄延迟注册 | `0xC0000005` 崩溃 + CrashSender.exe | 永不缓存 WebView2 子窗口句柄（异步重建）；延迟注册必须新鲜枚举 |
| 对同一 hwnd 先 Revoke 再 Register | Windows COM DragDrop 极脆弱，可能 abort | 重注册只 `RegisterDragDrop` 不 `Revoke` |
| 依赖"降级 wry / 删 visible:false" | 均非根因，白折腾 | `visible:false` 不影响拖放（AIVault 实证） |
| 构建产物陈旧 | `pnpm run build` 后 UI 无变化 | 先查 dist 时间戳，`tauri dev` 走 vite 实时源码 |

### E10. 拖放排查 SOP（BUG-005 终章资产，按顺序执行）
1. **先分"事件没到" vs "前端没接住"**：`onDragDropEvent` 注册成功但无 `type` 日志 → 原生层（OLE/底层库）；有 `type` 但无文件 → 前端逻辑。
2. **同栈对照（最高效）**：找同机、同技术栈、同 wry 版本项目（ErgeMD/AIVault）实测拖拽是否正常。正常 → 差异必在本项目独有项（配置/前端/Rust/**vendor patch**）；也失效 → 才考虑环境级（WebView2、OS）。
3. **读源码确认派发路径**：`tauri-runtime-wry` 的 `with_drag_drop_handler`（`lib.rs` 约 4669-4704 行）经 `proxy.send_event(SynthesizedWindowEvent::DragDrop)` 同源派发 JS 与 Rust；两者都无日志 ⇒ OLE `IDropTarget` 没触发，别耗在前端/权限。
4. **排查优先级**：DOM `drag*` 监听 → `data-tauri-drag-region` → capabilities 权限 → `dragDropEnabled` → Cargo.lock 本地 patch/vendor → 最后才考虑底层库本身。
5. **每步定义"如何判断改对"**：无桌面能力时靠日志埋点（注册日志 + type 日志 + Rust 侧日志）分层，避免无验证连改多处。
6. **不要凭推断改底层库**：怀疑 wry/tauri 缺陷前，先排除项目自身全部独有差异；改 vendor 越改越坏，且污染对照基线。

### E11. 跨项目教训：对照基线 > 独立推断（BUG-005 终章资产）
1. **对照基线 > 独立推断**：拖放失效第一件事是同栈项目跑一遍，而非源码猜。AIVault"恢复拖拽"一条情报价值超过此前全部四轮源码分析。
2. **底层库改动 = 最后手段**：vendor/patch 上游 crate 破坏对照可比性；仅"原版方案被证伪"才允许动底层，且必须保留回退路径。
3. **中间结论标注置信度**：错误假设常"有源码/文档依据"但只是必要条件；单项目经验（ErgeMD 的 DOM 监听根因）不可直接外推为另一项目的根因。
4. **用户的环境情报是指路明灯**："AIVault 拖拽恢复正常"同时排除 WebView2/OS/wry 版本等环境假设，把差异收敛到本项目独有项。

---

## 拖放铁律修订版（2026-08-14 晚，替代文首 08-13 版）

- 文件拖放**唯一**允许 `getCurrentWebview().onDragDropEvent`，路径来自 `event.payload.paths`。
- **禁止**任何 DOM `drag*` 监听（组件根 div 与 window 级均禁止）；注册即接管 WebView2 拖放链（ErgeMD 实证）。
- **禁止** `data-tauri-drag-region`；标题栏用 `onMouseDown + getCurrentWindow().startDragging()`（ErgeMD/AIVault 双实证）。
- 拖拽高亮由 Tauri `enter/over/leave` 驱动，不依赖 HTML5 drag。
- **保持 wry / tauri-runtime-wry 为 registry 原版，禁止 vendor 修改**（BUG-005 终章核心教训）。
- `visible:false`、wry 版本降级均**不影响**拖放（AIVault 实证），不要再当候选修复。
- 排查时优先同栈对照（ErgeMD/AIVault），差异收敛后再考虑动项目自身代码。
