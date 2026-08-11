# HashValidatorPlus 设计系统规范（Design System）

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

全部以 CSS 变量定义，亮/暗通过 `.dark` 类在 `<html>` 上切换。组件**只允许引用变量**，禁止硬编码色值（包括顶栏与 NavRail 文字，统一使用 `text-foreground`/`text-muted-foreground`）。

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
| `--foreground` | `#F5F5F7` | 主文字 |
| `--muted` | `#28282B` | hover 背景、浅色块 |
| `--muted-foreground` | `#B0B0B6` | 次要文字、占位提示 |
| `--border` | `#303034` | 深色边框/分隔线 |
| `--primary` | `#F26A1B` | 主题主色（橙）；选中态、主按钮、进度、拖放边框 |
| `--primary-foreground` | `#160B02` | 主色之上的文字（深棕，保证橙底可读） |
| `--secondary` | `#56C2E6` | 次色（亮蓝，对应 opensquilla `--info`） |
| `--destructive` | `#FF6B6B` | 危险操作（清空、删除，对应 `--danger`） |
| `--warning` | `#E8B23A` | 警告/失败状态文字（对应 `--warn`） |
| `--success-bg` / `--mismatch-bg` / `--error-bg` / `--computed-bg` | `#39D7A2` / `#FF6B6B` / `#E8B23A` / `#56C2E6` | 文件状态行底色（对应 opensquilla ok/danger/warn/info） |
| `--scrim` | `rgba(0,0,0,0.7)` | 对话框遮罩 |
| `--radius` | `4px` | 全局圆角基准 |
| `--close-btn-hover-bg` | `#e81123` | 关闭按钮 hover 红底（窗口控制语义，非主题状态色，保持） |

### 亮色（可选变体，对齐 #005 / opensquilla light）

`--background:#F7F7F8`、`--sidebar-bg:#F3F3F5`、`--panel:#FFFFFF`（内容块级，与背景形成轻微层级）、`--foreground:#1D1D1F`、`--border:#E6E6E9`、`--muted-foreground:#5F6066`。主题主色 `--primary:#BA4D0F`（暖橙，对应 opensquilla `--accent`）、`--primary-foreground:#FFFFFF`、次色 `--secondary:#4353B8`、危险 `--destructive:#C2382E`、警告 `--warning:#8A6410`；状态行底色 `#2E8A5F` / `#E0564A` / `#B2820B` / `#6478D9`。

### 配色约束

1. 顶栏与左侧导航栏必须使用**同一底色**，不可做"浅顶栏 + 深内容区"对比。
2. 右侧内容区必须比 L 形区**更深**，以建立"内容浮于框架"的层级感（暗色 `--panel:#0d0d0d` 深于 `--background:#18181A`）。
3. 暗色侧栏内文字使用浅色（`text-gray-100/300` 等），**禁止**使用深色文字（如 `text-gray-500`），否则不可见。
4. 状态语义色固定：成功、失败、警告、计算中对应 opensquilla 状态谱（`--ok`/`--danger`/`--warn`/`--info`），取值随主题系统更新而同步，禁止硬编码旧值。
5. 主色 `--primary` 随主题切换在 `#BA4D0F`（亮）/ `#F26A1B`（暗）间变化；NavRail 激活态、主按钮、进度条、拖放边框、成功/check 图标、radio 选中点均引用该变量。

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
  | 右侧 | 最小化 `−` / 最大化 `□` / 关闭 `✕` | 各 `w-10` 方形按钮，居右对齐，hover 变深 |

- **文字色**：顶栏按钮使用内联 `style={{ color: "#e5e7eb" }}`，不依赖 Tailwind 文字工具类（避免暗色变量未命中时不可见）。
- **关闭按钮**：常态透明底灰字，hover 红底白字（`--close-btn-hover-bg:#e81123`）。
- **拖拽规则**：仅中间区域带 `data-tauri-drag-region`；按钮区显式 `data-tauri-drag-region="false"`，防止点击穿透到拖拽。

### 3.2 三菜单结构（☰ 下拉菜单）

`☰` 展开一个分组式下拉面板（`menu-panel`，`min-w-[220px]`，`bg-card`，`border-border`，`shadow-lg`），内容分 4 组：

1. **文件（menu_file）**：打开文件、批量处理、导入校验、导出结果。
2. **编辑（menu_edit）**：复制哈希、查看历史。
3. **工具（menu_tools）**：记事本、清空历史、设置。
4. **无标题组**：快速指南、退出。

**交互逻辑**：

- 点击 `☰` 切换显隐；面板外点击或 `Esc` 关闭。
- 菜单项 hover：`bg-muted` + `text-primary`。
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

  1. **LOGO 区**（`h-12`）：`Hash` 图标 + 应用名 `HashValidatorPlus`（仅展示，**不触发折叠**）。
  2. **滚动区**（`flex-1 overflow-y-auto`，滚动条隐藏）：
     - 算法选择组（SHA-256 / MD5 / SHA-1 / SHA-512）。
     - 一级平级项：历史、快速指南。
     - 可折叠分组「工具」（导出、记事本）、「视图」（主题切换、语言切换）。
  3. **底部固定区**：设置 + 退出（`shrink-0`），折叠态竖排图标，展开态横向文字按钮。

- **导航项选中态**：左竖条（`before:` 伪元素，`bg-primary`）+ 主题主色文字 + `bg-primary/10` 底；未选中：灰文字，hover 仅变主题主色文字（不变底色）。主题主色随主题切换：亮 `#BA4D0F` / 暗 `#F26A1B`（对齐 ThemeVault #005/#003）。
- **分组动画**：`max-height` 方案 200ms，与宽度过渡一致。

### 3.6 右侧内容区布局

- **父容器**：`flex flex-1 flex-col gap-6 overflow-hidden bg-sidebar p-2`，与 L 形框架 `--sidebar-bg` 同色，消除 m-2/p-2 间隙在亮色下的"残留直角块"。
- **内容容器**：`flex flex-1 flex-col gap-6 overflow-hidden rounded-2xl bg-panel px-6 py-6`。暗色 `--panel:#0d0d0d` 比 L 形区 `--sidebar-bg:#18181A` 更深，亮色 `--panel:#FFFFFF` 比框架色 `#F3F3F5` 略亮，均形成"内容浮于框架"层级。
- **内部结构（纵向）**：
  1. **文件列表区**（`FileList`）：拖放/文件表格（`rounded-xl border border-border bg-card`）+ 底部预期哈希输入（输入区合并，因同属"输入"语义）。
  2. **计算结果区**（`ResultSection`）：过滤器 + 结果表格（`rounded-xl border border-border bg-card`）。
- **内部卡片统一线框**：文件列表区、预期哈希输入框、计算结果区三块均使用 `border-border bg-card` 的圆角卡片风格，避免亮主题下 `border-white/10` 等硬编码透明度边框不可见。
- 两个区块均为固定高度、内部滚动，主窗口不滚动。

### 3.7 浮动操作按钮（FAB）

- **定位**：悬浮在各自内容卡片**右下偏左**（`absolute bottom-4 right-20`，`pointer-events-none` 外层 + `pointer-events-auto` 内层），不挤压表格内容。
- **文件列表区 FAB**：开始检测（主色大圆按钮）+ 清空列表（危险色大圆按钮），**垂直堆叠**（经用户确认优于横排）。
- **结果区 FAB**：复制结果 / 导出 / 清空结果，三个圆形图标按钮，垂直堆叠。
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
│       ├── FileList
│       │   ├── 拖放/文件表格卡片 (relative)
│       │   │   └── 浮动 FAB：开始检测 + 清空列表 (absolute bottom-4 right-20)
│       │   └── 预期哈希输入 (居中占位覆盖层)
│       └── ResultSection
│           └── 结果卡片 (relative)
│               ├── 过滤器 + 结果表格
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
9. **动效**：统一轻量过渡（200ms cubic-bezier 用于宽度/分组；150ms 用于菜单淡入），不引入重型动画库。
10. **无障碍/可见性**：暗色侧栏文字必须用浅色工具类；图标按钮必须带 `title`/`aria-label`。

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
