# PyQt → Tauri 2 项目重构指令

> **使用方式**：将此指令直接发送给 AI，AI 会自动分析当前项目目录中的 PyQt 代码，并执行完整迁移。

---

## 任务目标

将当前项目文件夹中的 **PyQt 桌面应用** 完整重构为 **Tauri 2** 应用（Rust 后端 + Web 前端），保持功能和 UI 完全一致。

### 约束条件

1. **功能完全保留**：所有现有功能必须 100% 迁移，不得遗漏
2. **UI 视觉一致**：界面布局、交互逻辑、样式风格与原版保持一致
3. **技术栈**：Tauri 2 + Rust 后端 + React + TypeScript 前端
4. **输出语言**：代码注释和文档使用中文

---

## 执行指令

请严格按照以下 **6 个阶段** 逐步执行。每完成一个阶段，先输出该阶段的成果并等待我确认后，再进入下一阶段。

---

### 阶段一：项目分析与评估

**目标**：全面理解当前 PyQt 项目，输出分析报告。

**请执行以下步骤**：

1. **扫描当前项目目录**，列出所有文件和文件夹结构
2. **读取所有源代码文件**（`.py`、`.ui`、`.qrc`、`.qss` 等）
3. **读取 `requirements.txt`**，分析项目依赖
4. **输出项目分析报告**，包含以下内容：
   - **模块清单**：列出所有 Python 模块及其职责
   - **UI 组件清单**：列出所有窗口、对话框、控件及其层级关系
   - **业务逻辑清单**：列出所有核心业务函数及其输入/输出
   - **系统交互清单**：列出所有文件 I/O、网络请求、数据库操作、系统 API 调用
   - **信号/槽连接清单**：列出所有事件绑定关系
   - **资源文件清单**：图标、图片、样式表、配置文件等
   - **依赖分析**：哪些 Python 第三方库有直接的 Rust 替代方案，哪些需要特殊处理
   - **风险评估**：标注迁移难点和潜在风险点

**输出格式**：Markdown 表格 + 文字说明

---

### 阶段二：技术方案设计

**目标**：基于阶段一的分析，输出完整的技术迁移方案。

**请执行以下步骤**：

1. **确定前端技术栈**：React + TypeScript + Tailwind CSS + shadcn/ui
2. **设计 Rust 后端模块划分**：
   - 每个 Tauri Command 的名称、参数、返回值
   - Rust 内部模块的组织结构
   - 错误处理策略
3. **设计 IPC 通信接口**：
   - 列出所有 `invoke` 调用（前端 → 后端）
   - 列出所有 `emit` / `listen` 事件（双向实时通信）
4. **设计前端组件树**：
   - 页面路由结构
   - 组件层级关系
   - 状态管理方案（Zustand）
5. **设计数据流图**：从前端用户操作到后端处理再到数据返回的完整链路
6. **输出迁移对照表**：每个 PyQt 模块 → 对应的 Rust/前端模块映射

**输出格式**：Markdown 文档，包含架构图（Mermaid 图）

---

### 阶段三：项目初始化

**目标**：在当前目录创建 Tauri 2 项目脚手架。

**请执行以下步骤**：

1. **创建项目目录结构**：
   ```
   tauri-app/
   ├── src/              # React 前端代码
   │   ├── components/   # UI 组件
   │   ├── pages/        # 页面
   │   ├── hooks/        # 自定义 hooks
   │   ├── services/     # API 调用层
   │   ├── store/        # 状态管理
   │   └── styles/       # 样式
   ├── src-tauri/        # Rust 后端
   │   ├── src/
   │   │   ├── main.rs
   │   │   ├── lib.rs
   │   │   └── commands/ # Tauri Commands
   │   ├── Cargo.toml
   │   └── tauri.conf.json
   ├── public/           # 静态资源
   └── package.json
   ```

2. **生成基础配置文件**：
   - `tauri.conf.json`（应用名称、窗口配置、权限等）
   - `Cargo.toml`（Rust 依赖）
   - `package.json`（前端依赖）
   - `vite.config.ts`（构建配置）
   - `tsconfig.json`（TypeScript 配置）
   - `tailwind.config.js`（样式配置）
   - TypeScript 类型定义文件（IPC 接口类型）

3. **输出初始化命令**：可直接执行的安装命令

**输出格式**：完整的配置文件内容 + 命令

---

### 阶段四：逐步迁移实现

**目标**：按模块逐步将 PyQt 代码翻译为 Tauri 2 代码。

**请按以下顺序逐模块迁移，每完成一个模块输出完整代码**：

#### 第 4.1 步：Rust 后端 — 系统交互层

将以下类型的代码翻译为 Rust Tauri Commands：
- 文件读写操作 → Rust `std::fs` / `tokio::fs`
- 数据库操作 → `rusqlite` / `sqlx` / `sea-orm`
- 网络请求 → `reqwest`
- 系统 API 调用 → 对应 Rust crate

**每个 Command 的输出格式**：
```rust
// 模块：[原 Python 模块名]
// 功能：[功能描述]
// 原始函数：[原 Python 函数签名]

#[tauri::command]
async fn command_name(params: Type) -> Result<ReturnType, String> {
    // 实现
}
```

#### 第 4.2 步：Rust 后端 — 业务逻辑层

将核心业务逻辑翻译为 Rust：
- 数据处理函数
- 算法/计算逻辑
- 数据转换/序列化
- 工具函数

#### 第 4.3 步：前端 — 基础框架搭建

- 创建路由配置
- 搭建布局框架（主窗口、侧边栏、标题栏等）
- 配置状态管理（Zustand）
- 创建 IPC 调用封装层（`services/api.ts`）

#### 第 4.4 步：前端 — UI 组件迁移

按 PyQt 窗口逐个迁移，**每个窗口输出**：
- 完整的组件代码（`.tsx`）
- 对应的样式文件
- 事件处理逻辑
- Tauri IPC 调用代码

**PyQt → Web 组件映射参考**（请遵循此对照关系）：

| PyQt 控件 | Web 对应方案 |
|-----------|-------------|
| `QMainWindow` | 布局容器 + 侧边栏/标题栏组件 |
| `QTabWidget` | shadcn/ui Tabs 组件 |
| `QTableWidget` | TanStack Table |
| `QTreeWidget` | shadcn/ui Tree 组件 |
| `QListWidget` | 列表组件 |
| `QDialog` | shadcn/ui Dialog / Drawer |
| `QMenuBar` / `QToolBar` | 导航栏 / 工具栏 |
| `QStatusBar` | 底部状态栏 |
| `QSplitter` | react-resizable-panels |
| `QStackedWidget` | React Router / 条件渲染 |
| `QLabel` | 文本/图片展示 |
| `QLineEdit` / `QTextEdit` | shadcn/ui Input / Textarea |
| `QComboBox` | shadcn/ui Select |
| `QCheckBox` / `QRadioButton` | shadcn/ui Checkbox / Radio |
| `QPushButton` | shadcn/ui Button |
| `QProgressBar` | shadcn/ui Progress |
| `QSlider` | shadcn/ui Slider |
| `QSpinBox` / `QDoubleSpinBox` | shadcn/ui Input (type="number") |
| `QDateEdit` / `QTimeEdit` | shadcn/ui DatePicker |
| `QFileDialog` | Tauri Dialog API |
| `QMessageBox` | shadcn/ui AlertDialog |
| `QSystemTrayIcon` | Tauri SystemTray API |
| `QTimer` | `setInterval` / `setTimeout` |
| `QThread` | Web Worker / Rust `tokio::spawn` |
| `QClipboard` | Tauri Clipboard API |
| `QDragDrop` | HTML5 Drag and Drop API |
| `QGraphicsView` | Canvas / SVG |
| `QWebEngineView` | iframe |
| 信号/槽 (Signal/Slot) | Tauri `invoke()` + `emit()` / `listen()` |
| QSS 样式 | Tailwind CSS |
| `.ui` 文件布局 | Flex / Grid 布局 |
| `.qrc` 资源文件 | `public/` 或 `src/assets/` 目录 |

#### 第 4.5 步：前端 — 样式迁移

- 将 QSS 样式表翻译为 Tailwind CSS
- 保持颜色、字体、间距、圆角等视觉属性一致
- 处理暗色/亮色主题（如果有）

#### 第 4.6 步：资源文件迁移

- 图标/图片 → `public/` 或 `src/assets/` 目录
- 配置文件 → Tauri `appDataDir` 管理
- 多语言文件（如果有）→ 前端 i18n 方案

---

### 阶段五：联调与测试

**目标**：确保迁移后的应用功能完整、运行正常。

**请执行以下验证**：

1. **功能验证清单**：逐项检查每个功能是否正常工作
2. **UI 对比验证**：列出原 PyQt 界面与 Tauri 界面的差异点
3. **边界情况测试**：空数据、大数据量、异常输入等场景
4. **性能对比**：
   - 启动时间
   - 内存占用
   - 首次加载速度
5. **跨平台验证**：Windows/macOS/Linux 兼容性

**输出格式**：测试报告（Markdown 表格），标注通过/未通过项

---

### 阶段六：打包与部署

**目标**：生成可分发的安装包。

**请执行以下步骤**：

1. **配置打包参数**：
   - 应用图标（`.ico` / `.icns` / `.png`）
   - 安装包名称和版本号
   - 代码签名配置（如有）

2. **生成打包命令**：
   - Windows：`.msi` / `.exe`（NSIS）
   - macOS：`.dmg` / `.app`
   - Linux：`.deb` / `.AppImage`

3. **输出自动更新配置**（可选）：Tauri Updater 配置
4. **输出 CI/CD 配置**（可选）：GitHub Actions 自动构建流程

**输出格式**：完整配置文件 + 构建命令

---

## 工作方式说明

1. **逐阶段推进**：完成当前阶段 → 我确认 → 进入下一阶段
2. **代码完整性**：每个输出的代码文件必须是**完整可运行的**，不允许用 `// ...` 省略
3. **中文注释**：所有代码注释使用中文
4. **提问机制**：遇到不确定的设计决策时，先问我再继续，不要自行假设
5. **增量交付**：每个模块完成后立即输出，不要攒到最后一起给
6. **文件操作**：直接在项目中创建/修改文件，不要只输出代码块

---

## 开始

请确认你已理解以上所有指令，然后回复"**已准备就绪，我将从阶段一开始执行：扫描并分析当前项目目录。**"
