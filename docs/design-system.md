# ErgeHash 设计系统规范（Design System）

> 适用范围：基于 Tauri 2 + React + TS + Tailwind 的桌面端应用主窗口。
> 目标：沉淀可复用的布局、配色、组件层级与交互约束，使新项目可快速复现，减少重复劳动。
> 本规范以**暗色模式**为默认与重点（亮色为可选变体），所有取值均来自 `src/styles/index.css` 与组件实现。

---

## 一、总体架构

主窗口为无系统边框的自绘窗口（`tauri.conf.json` 中 `decorations: false`），所有标题栏与窗口控制按钮由前端绘制。整体采用 **纵向三段 + 下方横向双栏** 结构：

```
┌──────────────────────────────────────────────┐
│ TitleBar（自绘顶栏，横跨整窗顶部，h-40px）      │
├────────────┬─────────────────────────────────┤
│            │  bg-sidebar（与 L 形框架同色）    │
│  NavRail   │  ┌───────────────────────────┐  │
│  (侧栏)    │  │  右侧内容区（圆角容器）      │  │
│  bg-sidebar│  │  rounded-2xl bg-panel      │  │
│            │  └───────────────────────────┘  │
└────────────┴─────────────────────────────────┘
```

- 顶栏与左侧导航栏**共用同一底色**（`--sidebar-bg`），形成一体的「L 形浅黑区」，二者之间**无分隔线**。
- 右侧区域父容器同样使用 `bg-sidebar`，与 L 形框架同色；内部再用 `rounded-2xl bg-panel` 圆角容器承载内容，彻底消除 `m-2`/`p-2` 间隙在亮色下形成的"残留直角块"。
- 右侧内容区使用 `bg-panel`，暗色 `--panel:#0d0d0d` 比 L 形区 `--sidebar-bg:#18181A` 更深，亮色 `--panel:#FFFFFF` 比框架色 `#F3F3F5` 略亮，均形成"内容浮于框架"层级。
- 主窗口禁止整体滚动（`body { overflow: hidden }`），所有滚动发生在内部卡片。

---

## 二、配色系统（Color Tokens）

全部以 CSS 变量定义，亮/暗通过 `.dark` 类在 `<html>` 上切换。组件**只允许引用变量**，禁止硬编码色值，包括但不限于：
- 文字：`text-foreground` / `text-muted-foreground` / `text-primary-foreground` 等功能前景变量，禁止 `text-white`、`text-gray-*`、`style={{ color: "#e5e7eb" }}` 等。
- 背景与强调：`bg-primary`、`bg-secondary`、`bg-destructive`、`bg-warning`、`bg-muted`、`bg-card`、`bg-background`、`bg-panel`、`bg-sidebar-bg`、`bg-scrim`。
- 线框/分隔：`border-border`。
- 半透明 hover/遮罩：统一使用 `bg-foreground/20`、`bg-scrim`，禁止 `bg-black/50`、`bg-neutral-900`、`bg-black/20` 等。
- 浮动徽章按钮、状态徽标必须使用主题变量（如 `bg-secondary text-secondary-foreground`），禁止 `bg-blue-500`、`bg-emerald-500`、`text-white` 等硬编码 Tailwind 色。

> **配色来源（重要）**：本设计系统的两套默认主题**完整对齐 ThemeVault 主题系统**：
> - 暗色主题 = ThemeVault **#003**（opensquilla / dark，`themes/opensquilla/dark/palette.md`）
> - 亮色主题 = ThemeVault **#005**（opensquilla / light，`themes/opensquilla/light/palette.md`）
>
> 所有中性色、主色（accent）、状态色均取自上述两套主题的 `palette.md` 对应角色（`--accent`→`--primary`、`--bg`/`--text`/状态 fill 等）。`#005`/`#003` 是 ThemeVault 的**主题编号**，非颜色 hex。后续改动须以 ThemeVault 对应 `palette.md` 为准，不得沿用旧值（如旧 `--primary:#4CAF50`）。

### 暗色（默认，对齐 #003 / opensquilla dark）

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#18181A` | 整窗底色；顶栏/侧栏底色（L 形区） |
| `--sidebar-bg` | `#18181A` | 与 `--background` 一致，顶栏+NavRail 一体 |
| `--panel` | `#0d0d0d` | 右侧内容区圆角容器，**比 L 形区更深**（沿用既有设计语言，不取 opensquilla `--bg`） |
| `--card` | `#202022` | 下拉菜单、弹窗等浮层背景 |
| `--foreground` | `#E5E5E7` | 主文字（柔和浅灰，避免纯白刺眼） |
| `--muted` | `#28282B` | hover 背景、浅色块 |
| `--muted-foreground` | `#B0B0B6` | 次要文字、占位提示 |
| `--border` | `#303034` | 深色边框/分隔线 |
| `--primary` | `#F26A1B` | 主题主色（橙）；选中态、主按钮、进度、拖放边框 |
| `--primary-foreground` | `#160B02` | 主色之上的文字（深棕，保证橙底可读） |
| `--secondary` | `#56C2E6` | 次色（亮蓝，对应 opensquilla `--info`） |
| `--destructive` | `#FF6B6B` | 危险操作（清空、删除，对应 `--danger`） |
| `--warning` | `#E8B23A` | 警告/失败状态文字（对应 `--warn`） |
| `--success-bg` / `--mismatch-bg` / `--error-bg` / `--computed-bg` | `#39D7A2` / `#FF6B6B` / `#E8B23A` / `#56C2E6` | ~~文件状态行底色~~（已废弃：列表行不再使用整行背景色，状态改由图标+文字颜色区分） |
| `--scrim` | `rgba(0,0,0,0.7)` | 对话框遮罩 |
| `--radius` | `4px` | 全局圆角基准 |
| `--close-btn-hover-bg` | `#e81123` | 关闭按钮 hover 红底（窗口控制语义，非主题状态色，保持） |

### 亮色（可选变体，对齐 #005 / opensquilla light）

`--background:#F7F7F8`、`--sidebar-bg:#F3F3F5`、`--panel:#FFFFFF`（内容块级，与背景形成轻微层级）、`--foreground:#1D1D1F`、`--border:#E6E6E9`、`--muted-foreground:#5F6066`。主题主色 `--primary:#BA4D0F`（暖橙，对应 opensquilla `--accent`）、`--primary-foreground:#FFFFFF`、次色 `--secondary:#4353B8`、危险 `--destructive:#C2382E`、警告 `--warning:#8A6410`；状态行底色 ~~`#2E8A5F` / `#E0564A` / `#B2820B` / `#6478D9`~~（已废弃）。

### 配色约束

1. 顶栏与左侧导航栏必须使用**同一底色**，不可做"浅顶栏 + 深内容区"对比。
2. 右侧内容区必须比 L 形区**更深**，以建立"内容浮于框架"的层级感（暗色 `--panel:#0d0d0d` 深于 `--background:#18181A`）。
3. 暗色侧栏内文字使用浅色（`text-gray-100/300` 等），**禁止**使用深色文字（如 `text-gray-500`），否则不可见。
4. 状态语义色固定：成功、失败、警告、计算中对应 opensquilla 状态谱（`--ok`/`--danger`/`--warn`/`--info`），取值随主题系统更新而同步，禁止硬编码旧值。
5. 主色 `--primary` 随主题切换在 `#BA4D0F`（亮）/ `#F26A1B`（暗）间变化；NavRail 激活态、主按钮、进度条、拖放边框、成功/check 图标、radio 选中点均引用该变量。

---

## 二之一、字体与字号（Typography Tokens）

字体与字号体系**对齐 AIVault 设计系统**（`docs/design-system/tokens.md` 字体部分），确保跨项目视觉一致性。

### 字体栈

- **正文 / UI 文本**（`body` 默认）：优先 IBM Plex Sans、Noto Sans SC，回退至系统 UI 字体与中文黑体。
  ```css
  font-family: "IBM Plex Sans", "Noto Sans SC", "Segoe UI", Roboto,
    "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  ```
- **等宽文本**（哈希值、算法标识等需对齐展示者）：优先 JetBrains Mono、IBM Plex Mono，回退至系统等宽字体，统一使用 `.font-mono` 工具类。
  ```css
  font-family: "JetBrains Mono", "IBM Plex Mono", "Roboto Mono",
    "SFMono-Regular", Consolas, "Courier New", monospace;
  ```

> 字体文件自托管于 `src/assets/fonts/`（IBM Plex Sans / Noto Sans SC / JetBrains Mono 各 Regular/Medium/Bold 共 9 个 `.ttf`，与 AIVault 同源），`index.css` 中以 `@font-face` 声明引入（`font-display: swap`）。Noto Sans SC 含中文全字形，单字重约 10MB，本地自托管不依赖系统字体。

### 基准字号与行高

- 根字号 `font-size: 15px`（AIVault 基准），`line-height: 1.6`。
- 组件内文字在基准上用 Tailwind 文本尺寸微调（`text-xs`/`text-sm` 等），不脱离该基准过大偏移。
- 哈希展示使用 `.font-mono`（等宽），保证逐字符对齐、易核对。

---

## 三、UI 元素与排列规则

### 3.1 自绘顶栏（TitleBar）

- **尺寸**：`h-[40px]`，`shrink-0`，`w-full`，横跨整窗顶部。
- **底色**：`bg-sidebar`（与导航栏一体，无 `border-b`）。
- **内部结构（左 → 中 → 右）**：

  | 区域 | 内容 | 样式要点 |
  |------|------|---------|
  | 左侧 | `☰` 菜单按钮 + 折叠按钮 | 各 `w-10` 方形按钮，`hover:bg-black/20` |
  | 中间 | 拖拽区（`flex-1`，`data-tauri-drag-region`） | 用于拖动窗口，**不可放可点击元素** |
  | 右侧 | 历史 / 主题 / 语言 / `−` `□` `✕` | 历史、主题、语言为 `w-10` 图标按钮；窗口控制居最右 |

- **文字色**：顶栏按钮使用内联 `style={{ color: "#e5e7eb" }}`，不依赖 Tailwind 文字工具类（避免暗色变量未命中时不可见）。
- **关闭按钮**：常态透明底灰字，hover 红底白字（`--close-btn-hover-bg:#e81123`）。
- **拖拽规则**：仅中间区域带 `data-tauri-drag-region`；按钮区显式 `data-tauri-drag-region="false"`，防止点击穿透到拖拽。

### 3.2 三菜单结构（☰ 下拉菜单）

`☰` 展开一个分组式下拉面板（`menu-panel`，`min-w-[220px]`，`bg-card`，`border-border`，`shadow-lg`），内容分 4 组：

1. **文件（menu_file）**：打开文件、批量处理、导入校验。
2. **编辑（menu_edit）**：复制哈希、导出、清空历史。
3. **外观（menu_appearance）**：主题切换、语言切换。
4. **无标题组**：快速指南、退出。

**交互逻辑**：

- 点击 `☰` 切换显隐；面板外点击或 `Esc` 关闭。
- 菜单项 hover：仅 `text-primary`（对齐 T11 组件规范，不变底色）。
- 支持快捷键提示（`shortcut` 右对齐显示，如 `Ctrl+O`）。
- 入场动画：`menuIn` 150ms 淡入下移（不依赖 framer-motion）。
- 菜单动作通过 `window.dispatchEvent(new CustomEvent(...))` 解耦，由 `App.tsx` 统一监听打开对应对话框/执行动作。

### 3.3 折叠按钮

- **位置**：位于 `☰` 菜单右侧（顶栏左区第二个按钮）。
- **图标**：展开态 `PanelLeftClose`，折叠态 `PanelRightOpen`。
- **行为**：
  - 切换 `collapsed` 状态（`App.tsx` 中持久化到 `localStorage["hvp.ui.nav_collapsed"]`，重启保持）。
  - 侧栏宽度过渡：`220px`（展开）↔ `64px`（折叠），`transition-[width] 200ms cubic-bezier(0.22,1,0.36,1)`。
  - 折叠态侧栏仅显示图标；展开态显示图标+文字。
  - 折叠态点击导航项/分组头：先展开侧栏（不立即执行动作），避免误触。

### 3.4 窗口控制按钮（− □ ✕）

- 固定**居右对齐**，位于顶栏最右端。
- 最小化：`getCurrentWindow().minimize()`；最大化/还原：`toggleMaximize()`（图标随 `isMaximized` 在 `Square` 与 `Maximize2` 间切换）；关闭：`getCurrentWindow().close()`。
- 关闭前由 Rust 侧 `onCloseRequested` 钩子保存窗口几何信息。

### 3.5 左侧导航栏（NavRail）

- **底色**：`bg-sidebar`，与顶栏一体；无圆角、无边距、无分隔线。
- **纵向结构（上 → 下）**：

  1. **LOGO 区**（`h-12`）：主题感知 SVG logo（深色 `ergehash-logo-horizontal.svg`、亮色 `-light.svg`），折叠态显示 `app.svg`；点击触发侧栏折叠/展开。
  2. **滚动区**（`flex-1 overflow-y-auto`，滚动条隐藏）：
     - 算法选择组（SHA-256 / MD5 / SHA-1 / SHA-512 / CRC32）。
     - 工具组（记事本、导出）。
  3. **底部固定区**：设置 + 退出（`shrink-0`），折叠态竖排图标，展开态纵向文字按钮。

- **导航项选中态**（用户项目对比确认）：菜单项左侧出现**主题品牌色竖线** + 文字变为**主题品牌色** + 背景使用**半透明品牌色**。
  - 实现：左竖线通过 `before:` 伪元素 `bg-primary`；文字用 `text-primary`；背景用 `--primary-alpha`（`color-mix(in srgb, var(--primary) 10%, transparent)`），并映射为 `.bg-primary-alpha`，避免 Tailwind 的 `bg-primary/10` 在自定义变量体系下失效。
  - 未选中态：灰文字 `text-muted-foreground`，hover 仅文字变品牌色（不变底色）。
  - 主题主色随主题切换：亮 `#BA4D0F` / 暗 `#F26A1B`（对齐 ThemeVault #005/#003）。
- **分组动画**：`max-height` 方案 200ms，与宽度过渡一致。

### 3.6 右侧内容区布局

- **父容器**：`flex flex-1 flex-col gap-6 overflow-hidden bg-sidebar p-2`，与 L 形框架 `--sidebar-bg` 同色，消除 m-2/p-2 间隙在亮色下的"残留直角块"。
- **内容容器**：`flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl bg-panel px-6 py-6`。暗色 `--panel:#0d0d0d` 比 L 形区 `--sidebar-bg:#18181A` 更深，亮色 `--panel:#FFFFFF` 比框架色 `#F3F3F5` 略亮，均形成"内容浮于框架"层级。
- **内部结构（纵向，三区块，按视觉重点分配高度）**：
  1. **一区 · 文件列表区**（`FileList`，`flex-[1.2]`）：拖放/文件列表（`rounded-xl border border-border bg-card`）。高度适当减小，仅承载文件清单。
  2. **二区 · 预期哈希输入区**（`ExpectedHashSection`，`shrink-0`）：哈希输入框 + 自动识别算法提示。单独成块（从原 FileList 拆出），高度由内容撑开，不参与 flex 拉伸，避免出现空白的未使用区域。
  3. **三区 · 计算结果区**（`ResultSection`，`flex-[2]`）：过滤器 + 结果列表（`rounded-xl border border-border bg-card`）。**占比最大、视觉重点**，主用于显示结果。
  - 高度分配原则：二区按内容高度；剩余空间按 1.2 : 2 分配给文件列表区和结果区，结果区明显最大。
- **列表呈现统一**：文件列表区与计算结果区均采用无背景色的 `<ul className="divide-y divide-border">` 列表行，hover 仅用 `bg-muted/30`；状态通过图标 + 文字颜色区分（`text-primary`/`text-destructive`/`text-warning`/`text-muted-foreground`），不再给整行加 `bg-success`/`bg-mismatch`/`bg-error`/`bg-computed` 状态背景色，保持界面清爽统一。
- **内部卡片统一线框**：三个区块均为 `border-border bg-card` 的圆角卡片风格，避免亮主题下 `border-white/10` 等硬编码透明度边框不可见。
- 文件列表区与结果区内部滚动，主窗口不滚动；二区按内容高度自然撑开；区块间 `gap-4`。

### 3.7 浮动操作按钮（FAB）

- **定位**：悬浮在各自内容卡片**右下偏左**（`absolute bottom-4 right-20`，`pointer-events-none` 外层 + `pointer-events-auto` 内层），不挤压表格内容。
- **文件列表区 FAB**：开始检测（主色大圆按钮）+ 清空列表（危险色大圆按钮），**垂直堆叠**（经用户确认优于横排）。
- **结果区 FAB**：复制结果 / 导出 / 清空结果，三个圆形图标按钮，垂直堆叠。
- **清空职责边界（重要）**：三个区块各自负责清理自身内容，互不越权。
  - 「清空列表」（文件列表区 FAB）：**仅**清空文件列表（`fileList`、`currentFile`、`progress` 等运行态），**保留**预期哈希输入区与结果区内容。
  - 「清空」/「清空预期哈希」（预期哈希输入区）：仅清空该区输入框（`expectedHash`）。
  - 「清空结果」（结果区 FAB）：**仅**清空结果区（`resultText`、`lastResults` 等），保留文件列表与预期哈希。
  - 实现：`clearFiles` 不得重置 `expectedHash` 与结果区状态；预期哈希与结果清理由各自的独立 action 负责。
- **空态显隐规则**（重要 UX 约束）：
  - 对应内容区为空时，按钮**不隐藏**，改为 `disabled` + `opacity-40` 半透明灰显，提示新用户该位置存在可交互按钮。
  - 有内容时按钮恢复正常显示与交互。

### 3.8 输入框占位提示

- 预期哈希输入框的占位提示采用**空态居中覆盖层**：输入框为空且未聚焦时，提示文字在框内垂直+水平居中（与文件列表区、结果区的空态提示风格一致）；聚焦或输入后隐藏，露出可输入区。
- 原生 `textarea` 的 placeholder 无法垂直居中，因此用 `pointer-events-none` 的绝对居中层实现。

### 3.9 设置等功能性按钮位置

- 设置、退出等全局功能入口置于**左侧导航栏底部**（`NavRail` 底部固定区），而非内容区或顶栏，保持"功能导航在左、操作在右下"的分区。

---

## 四、组件层级结构（Z-Order / Tree）

```
MainLayout (h-screen w-screen, flex-col, overflow-hidden)
├── TitleBar (h-40, bg-sidebar, 无 border-b)
│   ├── 左侧：☰ 菜单按钮 → 折叠按钮
│   │   └── 菜单下拉面板 (absolute, z-50, menu-panel)
│   ├── 中间：拖拽区 (data-tauri-drag-region, flex-1)
│   └── 右侧：− □ ✕ (居右, 各 w-10)
├── 下方横向容器 (flex flex-1, overflow-hidden)
│   ├── 左侧栏容器 (bg-sidebar, width 220/64)
│   │   └── NavRail
│   │       ├── LOGO 区 (h-12)
│   │       ├── 滚动区 (算法 / 一级项 / 分组)
│   │       └── 底部固定区 (设置 / 退出)
│   └── 右侧内容区 (m-2 rounded-2xl bg-panel)
│       ├── 一区 FileList (flex-[1.2])
│       │   └── 拖放/文件表格卡片 (relative)
│       │       └── 浮动 FAB：开始检测 + 清空列表 (absolute bottom-4 right-20)
│       ├── 二区 ExpectedHashSection (shrink-0)
│       │   └── 预期哈希输入 (居中占位覆盖层) + 自动识别算法提示
│       └── 三区 ResultSection (flex-[2])
│           └── 结果卡片 (relative)
│               ├── 过滤器 + 结果列表
│               └── 浮动 FAB：复制/导出/清空 (absolute bottom-4 right-20)
└── 浮层 (z 高于主内容)
    ├── 对话框 (History / Settings / QuickGuide / Export)
    ├── ToastHost
    └── FloatingProgress (计算进度)
```

**层级要点**：

- 顶栏菜单面板 `z-50`，高于内容。
- 浮动 FAB 在卡片内 `z-10`，指针事件穿透外层、内层可点。
- 对话框使用 `--scrim` 遮罩覆盖整窗，置于最上层。

---

## 五、交互与 UX 偏好约束

1. **自绘窗口**：禁用系统边框，所有窗口控制由前端实现；窗口 show 由 Rust 侧负责，前端不调用 `show()`（避免 WebView 时序竞态）。
2. **主题切换**：通过 `<html>.dark` 类切换，由 store 持久化；CSS 变量驱动，组件不写死颜色。
3. **语言**：zh / en 由 i18next 管理，切换即时生效；所有用户可见文案必须走 i18n，禁止硬编码。
4. **状态持久化**：侧栏折叠、分组展开、窗口几何均写入 `localStorage` / 后端 config，重启保持。
5. **可发现性优先**：空态不隐藏操作入口，以半透明灰显引导新用户。
6. **紧凑布局**：移除冗余标题，说明文字内联或作为占位提示；减少中间区域空白。
7. **专业判断权**：布局/按钮方向等细节在合理范围内可由实现方主张（如 FAB 竖排优于横排），不必逐条请示；仅关键歧义或高风险才反问。
8. **拖放机制**：Tauri 2 文件拖放由 Rust 层接管，前端**不要**对 `drop`/`dragover` 全局 `preventDefault`（仅阻止非文件拖放被浏览器打开），避免与 Tauri 拖放竞态。
9. **动效体系（2026-08-12）**：框架原生 CSS（transition/@keyframes），不引入动画库。全部动效可通过设置页「启用界面动画」一键关闭（根元素挂 `.animations-off`），并遵守 `prefers-reduced-motion`。
   - **主卡 hover**（仅 FileList/ResultSection 主卡）：上浮 `translateY(-2px)` + 品牌色微光阴影 + 边框提亮（`color-mix(primary 45%, border)`）+ 跑马灯边框（`@property --angle` 驱动 conic-gradient 旋转，2.6s linear infinite，mask 保留 1.5px 环）。拖拽态（`.main-card--dragging`）禁用上浮与跑马灯。
   - **主 CTA 呼吸**：开始校验圆钮 `.animate-breathe`（box-shadow 光环 2.6s ease-in-out infinite），仅在 `hasFiles && !isCalculating` 时启用。
   - **列表错落入场**（仅首次）：`.list-item-enter`，300ms fade+up，按行号 stagger（父级 40ms/子级 25ms，上限 240/400ms），由组件 `hasEntered` state + 800ms timer 控制在应用生命周期内只播放一次。
   - **选中指示条滑入**：NavRail 选中态左竖条 `.nav-active-indicator::before` 从 scaleY(0) 展开（250ms）。
   - **图标微转**：圆图标操作按钮 `.btn-icon-rotate:hover svg` 旋转 -8deg（250ms）。
   - **全局按压**：`button:not(:disabled):not([role="switch"]):active` 缩放 0.97；顶栏（`.titlebar-no-press`）与 switch 排除。
   - **焦点环**：全局 `:focus-visible` 用 `var(--ring)` outline 2px。
10. **无障碍/可见性**：暗色侧栏文字必须用浅色工具类；图标按钮必须带 `title`/`aria-label`；动效遵守 `prefers-reduced-motion`。

---

## 六、复现清单（新项目速查）

1. 配置 `tauri.conf.json`：`decorations:false`、`visible:false`、`dragDropEnabled:true`。
2. 建立 CSS 变量（亮/暗两套），组件只引用变量。
3. 搭建 `MainLayout`（纵向）→ `TitleBar` + 下方横向 `NavRail | 内容区`。
4. 顶栏：`☰` + 折叠 + 拖拽区 + `− □ ✕`；按钮内联浅色文字。
5. 侧栏：LOGO / 算法 / 一级项 / 可折叠分组 / 底部设置退出；与顶栏同色无分隔。
6. 内容区：`m-2 rounded-2xl bg-panel`，比 L 形区更深。
7. FAB：`absolute bottom-4 right-20` 浮动、竖排、空态半透明灰显。
8. 主题/语言/折叠/几何均持久化；文案全 i18n。
9. 动效只用语义化 CSS 过渡，不引重型动画库。
