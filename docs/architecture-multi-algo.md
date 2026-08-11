# 多算法支持技术方案与架构设计

> 目标：实现"多算法选择 + 单文件拖入即多算法并发计算 + 右键菜单触发"核心能力。本方案只讨论技术架构、数据流、状态管理与交互逻辑，UI/UX 后续单独设计。

---

## 一、当前架构概览与需修改模块

### 1.1 当前架构（基于实际代码）

```
React 前端 (tauri-app/src/)
  ├── App.tsx              # 拖放入口、全局布局、监听 files-dropped / batch-* 事件
  ├── store/appStore.ts    # fileList / expectedHash / lastResults / progress / 控制命令
  ├── components/
  │    ├── FileList.tsx    # 文件列表展示（单 hashValue/status 字段）
  │    ├── ResultSection.tsx   # 结果区展示
  │    ├── ExpectedHashSection.tsx # 二区：预期哈希 / 校验文件
  │    └── FileActions.tsx     # 开始检测 / 清空列表 / 复制 / 导出 FAB
  └── services/
       ├── api.ts          # invoke 命令封装
       └── types.ts        # 前后端共享 DTO（HashResult 等）

Rust 后端 (tauri-app/src-tauri/src/)
  ├── hashing.rs           # HashSink trait + make_hasher + 缓存 key 生成
  ├── models/types.rs      # HashAlgorithm / HashResult / BatchResult / AppConfig / VerificationEntry
  ├── commands/
  │    ├── hash.rs         # calculate_hash / quick_calculate_hash / 暂停/恢复/取消
  │    ├── batch.rs        # start_batch_validation：单算法 × 多文件顺序执行
  │    ├── export.rs       # 导入/导出校验文件、csv/json
  │    └── config.rs       # get_config / set_config（JSON 持久化）
  └── lib.rs               # AppState（pause/cancel flags、hash_cache、batch_results）
```

### 1.2 当前关键约束（不是假设）

- `HashAlgorithm` 是单选枚举（`sha256|md5|sha1|sha512`）。
- `HashResult` 是 **(文件路径, 算法)** 二元组一条记录，天然支持多算法展开。
- `FileItem`（前端 store）只有单个 `hashValue` + `status`，**未按算法聚合**。
- `start_batch_validation` 接收 `algorithm: HashAlgorithm` 单算法参数，内部 `process_single_file` 也是单 hasher。
- `appStore.algorithm` 是单选字符串，绑定 NavRail 算法选择。
- 缓存 key 为 `(path, size, mtime, algorithm)`，多算法只需扩展为多个 key。

### 1.3 需修改的模块清单

| 模块 | 改动性质 | 说明 |
| --- | --- | --- |
| `models/types.rs` + `services/types.ts` | 数据模型 | `HashAlgorithm` 扩展（如需更多算法如 CRC32/BLAKE3）；新增多算法相关 DTO |
| `commands/batch.rs` | 后端命令 | 改为接收算法集合，单文件内多 hasher 并发 update；进度事件聚合 |
| `hashing.rs` | 核心引擎 | 已有 `HashSink`，新增 `make_hashers(Vec<HashAlgorithm>)` 批量构造；支持读一次多算 |
| `commands/hash.rs` | 后端命令 | `calculate_hash` 可保留单算法兼容，也可扩展为批量多算法接口 |
| `store/appStore.ts` | 前端状态 | 算法选择由单选改多选；`FileItem` 由单 hash 改 `Record<algorithm, hash>` |
| `services/types.ts` + `api.ts` | 前端类型 | 同步后端 DTO；多算法命令参数 |
| `components/FileList.tsx` | 展示层 | 多算法结果聚合展示（一行文件 + 展开/折叠各算法） |
| `components/FileActions.tsx` | 交互层 | 开始检测改为"对当前文件列表用已选算法集合计算" |
| `tauri.conf.json` / 权限 | 后端配置 | 若实现系统右键菜单需额外配置（见 §5） |

---

## 二、多算法选择状态管理设计方案

### 2.1 状态位置

放在 **前端 `appStore.ts`**，原因：
- 算法选择是用户当前会话的视图状态，与后端计算解耦。
- 多选/全选属于高频 UI 交互，放在本地 store 可避免无意义 IPC。
- 持久化可扩展：`AppConfig` 中存 `selectedAlgorithms: HashAlgorithm[]` 作为用户偏好。

### 2.2 状态结构

```typescript
// store/appStore.ts
interface AppState {
  // 替换原单选 algorithm
  selectedAlgorithms: HashAlgorithm[];

  // 辅助布尔：是否全选
  isAllAlgorithmsSelected: boolean;

  // 文件列表项：每个文件持有各算法的哈希与状态
  fileList: FileItem[];

  // 预期校验集（Flow B）：按文件名 -> 算法 -> 哈希 映射
  verificationMap: Record<string, Record<HashAlgorithm, string>>;

  // 其他已有状态...
}

interface FileItem {
  path: string;
  name: string;
  size: number;
  // 每个算法独立结果，便于"多算法并发计算"后聚合
  results: Record<HashAlgorithm, {
    hashValue: string;
    status: FileItemStatus;
    elapsedTime: number;
    fromCache: boolean;
    errorMessage?: string;
  }>;
}
```

### 2.3 多选/全选操作

- **单选切换**：`toggleAlgorithm(algo)` —— 在 `selectedAlgorithms` 中增删。
- **全选**：`selectAllAlgorithms()` —— 设为全部可用算法数组。
- **取消全选**：`clearAlgorithms()` —— 至少保留一个默认算法（如 SHA256），避免"无算法时拖入文件"空转。
- **算法可用列表**：常量 `SUPPORTED_ALGORITHMS: HashAlgorithm[]`，后续扩展算法只需改该常量和后端 `make_hasher`。

### 2.4 持久化

`AppConfig` 增加字段：
```rust
pub struct AppConfig {
    pub selected_algorithms: Vec<HashAlgorithm>,
    pub algorithm: String,            // 兼容旧单选，迁移时作为默认首选项
    // ...
}
```
启动时从 `get_config` 恢复 `selectedAlgorithms`；无配置时默认 `[SHA256]`。

---

## 三、文件拖入后批量触发多算法计算的执行流程

### 3.1 核心原则

- **读一次，多算法同算**：每个文件只从磁盘读一遍，每块数据同步 `update` 到所有已选算法的 hasher。
- **按文件串行、多文件可并发**：单个文件内部顺序读块（避免随机 IO），不同文件之间可用线程池并发。
- **缓存按算法独立**：命中缓存的算法直接返回，未命中才读盘。

### 3.2 Rust 后端计算核心改造

#### 3.2.1 `hashing.rs` 新增批量构造

```rust
pub fn make_hashers(algorithms: &[HashAlgorithm]) -> Vec<(HashAlgorithm, Box<dyn HashSink>)> {
    algorithms.iter()
        .map(|&a| (a, make_hasher(a)))
        .collect()
}
```

#### 3.2.2 `commands/batch.rs` 新命令（或改造 `start_batch_validation`）

推荐新增命令，保持旧命令兼容：

```rust
#[tauri::command]
pub async fn calculate_multi_hash(
    file_paths: Vec<String>,
    algorithms: Vec<HashAlgorithm>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatchResult, String> { /* ... */ }
```

单文件处理伪代码：

```rust
fn process_file_multi(
    file_path: &str,
    algorithms: &[HashAlgorithm],
    pause_flag: &Arc<AtomicBool>,
    cancel_flag: &Arc<AtomicBool>,
    hash_cache: &Arc<Mutex<HashCache>>,
) -> Result<Vec<HashResult>, String> {
    // 1. 检查缓存：每个算法独立查
    let mut results = Vec::with_capacity(algorithms.len());
    let mut missing_algorithms = Vec::new();

    for &algo in algorithms {
        let key = file_cache_key(file_path, file_size, algo);
        if let Some(cached) = cache.get(&key) {
            results.push(HashResult { algorithm: algo, hash_value: cached.clone(), from_cache: true, status: Success, ... });
        } else {
            missing_algorithms.push(algo);
            results.push(HashResult { algorithm: algo, hash_value: String::new(), status: Success, from_cache: false, ... }); // 占位
        }
    }

    if missing_algorithms.is_empty() {
        return Ok(results);
    }

    // 2. 读文件一次，给所有缺失算法的 hasher update
    let mut hashers = make_hashers(&missing_algorithms);
    loop {
        check_interrupted(...)?;
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 { break; }
        for (_, hasher) in hashers.iter_mut() {
            hasher.update(&buffer[..bytes_read]);
        }
        // 发送进度：以文件总体进度为准（不再区分算法）
        emit_progress(file_path, total_read, file_size);
    }

    // 3. finalize 并回填 results、写入缓存
    for (algo, hasher) in hashers {
        let hash = hasher.finalize_hex();
        cache.insert(file_cache_key(file_path, file_size, algo), hash.clone());
        results 中对应 algo 的位置回填 hash;
    }

    Ok(results)
}
```

#### 3.2.3 进度事件

当前 `HashProgress` 按文件路径发送百分比。多算法下仍以**文件维度**聚合进度（因为读盘进度对所有算法一致）：

```rust
pub struct HashProgress {
    pub file_path: String,
    pub algorithms: Vec<HashAlgorithm>,   // 新增：本次在算的算法集合
    pub progress: u8,
    pub bytes_read: u64,
    pub total_bytes: u64,
}
```

单文件完成事件 `batch-file-complete` 改为发送该文件的**算法结果数组**：

```rust
pub struct FileCompleteEvent {
    pub file_path: String,
    pub results: Vec<HashResult>,
}
```

### 3.3 前端拖入触发流程

```
用户拖入单个文件
  │
  ├─ 前端 App.tsx / FileList.tsx onDrop 解析路径
  │     └─ appStore.addFiles([path])
  │
  ├─ 自动触发条件：fileList 非空 && selectedAlgorithms 非空 && 配置 autoCalculate
  │     └─ appStore.startValidation()
  │
  ├─ 前端 api.calculateMultiHash(filePaths, selectedAlgorithms)
  │
  ├─ Rust 后端：每个文件读一次，多算法同算
  │     ├─ 缓存命中：直接返回
  │     └─ 缓存未命中：分块读 → update 到 N 个 hasher → finalize
  │
  ├─ 后端 emit 进度 / 单文件完成 / 批量完成事件
  │
  └─ 前端 store 按 filePath + algorithm 聚合结果 → FileList / ResultSection 渲染
```

### 3.4 并发策略

| 层级 | 策略 | 依据 |
| --- | --- | --- |
| 单文件内部 | 顺序读块 + 多 hasher 同时 update | 避免随机 IO，减少 syscall |
| 多文件之间 | 线程池（`spawn_blocking`）并发，数量 = CPU 核心数 或 用户配置 | 多文件场景（如模型目录）吞吐 |
| 内存背压 | 在途块上限（如单线程 1 块，线程池 × 并发数） | 当前 1MB buffer，并发 4 时峰值 4MB，可控；大文件不爆内存 |

---

## 四、算法结果的数据结构和展示方案

### 4.1 后端数据结构（改造后）

保留 `HashResult` 扁平结构，天然支持多算法：

```rust
pub struct HashResult {
    pub file_path: String,
    pub algorithm: HashAlgorithm,
    pub hash_value: String,
    pub elapsed_time: f64,
    pub status: HashStatus,       // success / mismatch / error
    pub from_cache: bool,
    pub error_message: Option<String>,
}
```

新增聚合事件 DTO：

```rust
pub struct FileCompleteEvent {
    pub file_path: String,
    pub results: Vec<HashResult>,
}
```

### 4.2 前端聚合结构

按文件聚合，便于列表展示：

```typescript
interface FileResultAggregate {
  path: string;
  name: string;
  size: number;
  // 每个算法一条结果
  results: Record<HashAlgorithm, AlgorithmResult>;
}

interface AlgorithmResult {
  hashValue: string;
  status: "success" | "mismatch" | "error" | "pending";
  elapsedTime: number;
  fromCache: boolean;
  errorMessage?: string;
}
```

### 4.3 状态判定逻辑（Flow A / Flow B / Flow C）

- **Flow A 单算法多文件**：`status = success`（计算完成即成功）。
- **Flow B 完整性比对**：对每个 `(file, algorithm)`，在 `verificationMap[filename][algorithm]` 存在时比对：
  - 相等 → `success`
  - 不等 → `mismatch`
  - 校验文件中没有该文件/该算法 → `success`（无预期就不判定）
- **Flow C 快速一致性对比**：同一算法下，对 `hashValue` 聚类，同组文件标为相同一致性组 ID（无需改 `status`，前端展示分组）。

### 4.4 展示方案（功能层面，非 UI 稿）

- **默认视图**：文件列表每行展示文件名，右侧/下方折叠/展开显示已选各算法及其哈希。
- **匹配标记**：Flow B 中 `mismatch` 的算法行标红；`success` 标绿。
- **进度指示**：文件级进度条（因为多算法共享读盘进度）。
- **结果区**：保留 `ResultSection`，展示 `(文件, 算法, 哈希, 状态)` 扁平列表，支持按算法筛选/排序。
- **复制/导出**：导出时按 `(文件, 算法)` 多行输出，格式可选 `*.sha256`（按算法分组）/ `*.sfv`。

---

## 五、右键菜单的功能定义和交互逻辑

> 注：用户明确"仅参考功能设计，UI 由我们自行设计"。以下定义功能与触发逻辑，实现方式可在应用内右键或系统级右键中任选。

### 5.1 应用内右键菜单（最低成本）

在 `FileList.tsx` 的文件行上右键，弹出菜单：

| 菜单项 | 功能 |
| --- | --- |
| 复制哈希值 | 复制当前文件所有已选算法结果（文本格式） |
| 复制文件路径 | 复制完整路径到剪贴板 |
| 重新计算 | 清除缓存并重新计算当前文件的所有选中算法 |
| 移除 | 从 fileList 移除该文件 |
| 打开文件位置 | 在资源管理器中定位文件 |

### 5.2 系统级右键菜单（参考截图 FileHash 的"FH"菜单）

在 Windows 资源管理器中右键文件/文件夹，显示 `ErgeHash` 子菜单：

| 子菜单项 | 功能 |
| --- | --- |
| 计算 MD5 | 用单算法 MD5 计算 |
| 计算 SHA1 | 用单算法 SHA1 计算 |
| 计算 SHA256 | 用单算法 SHA256 计算 |
| 计算 SHA512 | 用单算法 SHA512 计算 |
| 计算 CRC32 | 用单算法 CRC32 计算（若已支持） |
| 一键校验 | 打开应用，用当前 `selectedAlgorithms` 计算选中文件 |

实现方式（Tauri 2）：
- 选项 A：**`tauri-plugin-context-menu`** —— 仅在应用窗口内生效，实现成本低。
- 选项 B：**Windows 注册表 + Shell 扩展** —— 在资源管理器右键注册项，调用 `ergehash.exe "--hash=sha256" "path"` 或 URI scheme。需要管理员权限安装/卸载，与截图中的"添加鼠标右键菜单"/"移除鼠标右键菜单"按钮一致。
- 选项 C：**URI scheme / 自定义协议** —— `ergehash://hash?path=...&algos=...`，由应用启动时解析。

推荐分阶段：先实现选项 A（应用内右键），后续再实现选项 B（系统右键）作为高级功能。

---

## 六、实施顺序建议

1. **模型层**：扩展 `HashAlgorithm`（如需 CRC32/BLAKE3），`AppConfig` 增加 `selected_algorithms`，前后端类型同步。
2. **后端核心**：`hashing.rs` 加 `make_hashers`；`commands/batch.rs` 新增 `calculate_multi_hash`（读一次多算）。
3. **前端状态**：`appStore` 改为 `selectedAlgorithms: HashAlgorithm[]`，`FileItem.results` 改为 `Record<algorithm, ...>`。
4. **前端交互**：算法多选组件、拖入自动触发、FileList 多算法展示。
5. **Flow B 升级**：二区导入校验文件 + 按文件名逐行匹配。
6. **Flow C**：基于已算哈希的快速一致性对比视图。
7. **右键菜单**：先应用内右键，后系统右键。

---

## 七、关键决策点（已确认）

1. **扩展算法列表**：确认增加 **CRC32**（轻量、校验场景常用，`crc`/`crc32fast` 成熟）。BLAKE3/XXH3 暂不做（后续可选增强）。新增后总数 = 5（SHA-256 / MD5 / SHA-1 / SHA-512 / CRC32）。后端 `HashAlgorithm` 加 `CRC32` 变体，`make_hasher` 加分支；前端 `HashAlgorithm` 联合类型 + `NavRail.ALGORITHMS` + `SettingsDialog.ALGORITHMS` 同步加项。
2. **多文件并发**：确认多文件之间**并发**（线程池 `spawn_blocking`，并发数 = CPU 核心数或用户配置；单文件内部仍顺序读块 + 多 hasher 同算）。改造 `batch.rs` 从顺序循环改为并发 `join_all` / 有界通道。
3. **拖入自动开始**：确认新增 **`autoCalculate` 设置开关，默认关闭**（保留手动「开始检测」）。`AppConfig.auto_calculate: bool`，Store 增加 `autoCalculate` + `setAutoCalculate`；拖入 `addFiles` 后若 `autoCalculate && selectedAlgorithms 非空` 自动 `startValidation()`。开关 UI 放在「设置对话框」。
4. **系统右键菜单（跨平台说明）**：
   - **本阶段先做应用内右键菜单**（FileList 行右键，零平台依赖、跨平台一致）。
   - **系统级右键菜单作为后续高级功能，初期仅聚焦 Windows**（注册表 `*\shell` / `Directory\shell`，安装/卸载需管理员权限，对应截图"添加/移除鼠标右键菜单"按钮）。
   - **Mac / Linux 不投入三平台独立开发**：macOS 无注册表，标准做法是 Finder Services（`~/Library/Services` 或 `Info.plist` 的 `CFBundleServices`，且需用户在"系统设置→键盘→快捷键→服务"手动开启）；Linux 依赖桌面环境（Nautilus/Dolphin/Thunar 各自扩展机制）。三者实现机制完全不同、权限要求各异，成本远高于 Windows 单平台。Mac/Linux 用户以「应用内右键 + 拖入」作为等效替代。
5. **单文件多算法结果展示**：默认**折叠**，仅显示一个主算法（默认 SHA-256 或用户首个选中项），展开后显示全部已选算法哈希。详情见 §4.4 展示方案（待 UI 阶段细化）。

---

## 八、左侧导航栏与顶栏重构（布局变更，2026-08-11）

### 8.1 变更意图
将左侧导航栏简化为「仅算法模块」；把「历史记录、工具（导出/记事本）、主题切换、语言切换」从导航栏移除，上移到**顶栏最小化图标左侧**，形成紧凑、样式统一的一组状态/工具按钮。左上角 ☰ 菜单保持为导航入口（含历史/工具/设置/退出等全部入口）。

### 8.2 布局结构
```
顶栏 [☰ 折叠]  [历史][工具▾][主题][语言]     拖拽区      [─][▢][✕]
              └──────── 新增紧凑按钮组（最小化左侧，留间距） ───────┘
```
- 新增 4 项按钮：`历史记录`、`工具`（下拉：导出 / 记事本）、`主题切换`、`语言切换`。
- 与右侧 `- □ ✕` 之间保留 `gap`（如 `ml-3` / `gap-1`），不使用分隔线，靠间距与 hover 区分。
- 响应式：窄屏（移动端）下按钮图标化、隐藏文字标签、保留 tooltip；桌面端图标+文字。折叠侧栏时这组按钮仍在（属于顶栏，与侧栏折叠无关）。

### 8.3 改动文件
| 文件 | 改动 |
| --- | --- |
| `components/layout/NavRail.tsx` | 移除历史/工具分组/视图(主题+语言)分组/底部设置退出；仅保留 LOGO + 算法选择 + （退出可保留在 ☰ 菜单，故移除底部设置/退出按钮，或仅保留退出）。 |
| `components/layout/TitleBar.tsx` | 在折叠按钮右侧、拖拽区左侧插入 4 项紧凑按钮组（历史、工具下拉、主题、语言）。工具下拉复用菜单样式。 |
| `store/appStore.ts` | 增加 `autoCalculate` 状态 + `setAutoCalculate`（`setConfig("auto_calculate", bool)`）。 |
| `models/types.rs` + `services/types.ts` | `HashAlgorithm` 增加 `CRC32`；`AppConfig` 增加 `auto_calculate: bool`。 |
| `commands/config.rs` | `set_config` 支持 `auto_calculate` 键写入 `AppConfig`。 |
| `SettingsDialog.tsx` | 外观设置下增加「拖入自动开始」开关（Switch），绑定 `autoCalculate`。 |
| i18n | 新增 `auto_calculate`、顶栏按钮相关 key（如 `topbar_history` 等，复用既有 `history`/`export`/`notepad`/`dark_mode`/`light_mode` 等）。 |

