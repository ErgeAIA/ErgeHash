# 优化阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成桌面验收后的三项优化——建立 Rust 哈希正确性测试安全网、把批量校验的阻塞 I/O 移出 async worker 并增大读取缓冲、补齐前端即时反馈（toast + 比较结果回填列表状态）。

**Architecture:** 三部分互不耦合、各自独立可提交：A) 在 `hashing.rs`/`lib.rs` 补 `#[cfg(test)]` 单元测试作为回归安全网（哈希标准向量 + 取消/暂停中断检查）；B) 把 `check_interrupted` 抽为不依赖 `AppState` 的自由函数、定义 `HashCache` 类型别名与 `CHUNK_SIZE=1MB` 常量，`start_batch_validation` 整体移入 `tauri::async_runtime::spawn_blocking`（不占 async worker），单文件处理改为接收克隆出的 `Arc` 字段；C) 新建 Zustand `toastStore` + `ToastHost` 组件挂载到 `App`，接入复制/导出/清历史/导入反馈点，并让 `HashVerification` 比较后通过 `updateFileByPath` 回填 success/mismatch 到文件列表。

**Tech Stack:** Rust (sha2/md-5/sha1, tokio, Tauri 2 `async_runtime::spawn_blocking`)；前端 React 19 + Zustand + Tailwind CSS v4（自定义工具类体系）+ i18next。

---

## 背景事实（执行前必读）

- 活跃代码在 `tauri-app/`；Rust 命令注册见 `src-tauri/src/lib.rs` 的 `invoke_handler`。
- 当前 `start_batch_validation`（`commands/batch.rs`）在 `async fn` 内直接串行执行阻塞文件 I/O，读取缓冲 `[0u8; 8192]`。整批移入 `spawn_blocking` 后，暂停/恢复/取消、`batch-file-complete`/`batch-progress`/`batch-complete` 事件顺序与前端契约**全部保持不变**。
- `AppState` 由 Tauri `manage()`，其字段均为 `Arc`（`pause_flag`/`cancel_flag`/`hash_cache`/`batch_results`），可在 command 内 clone 后 move 进 `'static` 闭包；`State<'_, AppState>` 借用本身不能 move。
- 前端无测试框架（无 vitest/jest），前端验证 = `npm run build`（含 `tsc` 严格类型检查）+ `npm run tauri dev` 手动验收。**不引入新测试依赖**。
- 现有 i18n 键已足够 toast 使用：`copied_to_clipboard`、`history_cleared`、`export_success`、`export_failed`、`import_success`（带 `{{count}}`）。**无需新增键**。
- Tailwind 自定义工具类（`styles/index.css`）已有 `bg-card`/`border-border`/`bg-success`/`bg-mismatch`/`bg-error` 等；`text-primary` 等无对应工具类，toast 图标颜色一律用内联 `style={{ color: "var(--...) }}` 保证生效。

---

## Part A：Rust 测试安全网

### Task 1: 哈希标准向量测试（hashing.rs）

**Files:**
- Modify: `tauri-app/src-tauri/src/hashing.rs`（文件末尾追加 `#[cfg(test)] mod tests`）

- [ ] **Step 1: 在 `hashing.rs` 末尾追加测试模块**

在文件最后（`file_cache_key` 函数之后）追加：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::HashAlgorithm;

    /// 用已知标准测试向量验证各算法哈希正确性（回归基线）
    #[test]
    fn hash_vectors_match_known_values() {
        let cases: &[(HashAlgorithm, &str, &str)] = &[
            (
                HashAlgorithm::SHA256,
                "abc",
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            ),
            (
                HashAlgorithm::SHA256,
                "",
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ),
            (
                HashAlgorithm::MD5,
                "abc",
                "900150983cd24fb0d6963f7d28e17f72",
            ),
            (
                HashAlgorithm::MD5,
                "",
                "d41d8cd98f00b204e9800998ecf8427e",
            ),
            (
                HashAlgorithm::SHA1,
                "abc",
                "a9993e364706816aba3e25717850c26c9cd0d89d",
            ),
            (
                HashAlgorithm::SHA1,
                "",
                "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            ),
            (
                HashAlgorithm::SHA512,
                "abc",
                "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
            ),
            (
                HashAlgorithm::SHA512,
                "",
                "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
            ),
        ];

        for &(algorithm, input, expected) in cases {
            let mut hasher = make_hasher(algorithm);
            hasher.update(input.as_bytes());
            assert_eq!(hasher.finalize_hex(), expected, "算法 {:?} 向量不符", algorithm);
        }
    }

    /// make_hasher 对不同算法返回不同哈希（防串算法）
    #[test]
    fn make_hasher_distinguishes_algorithms() {
        let mut sha = make_hasher(HashAlgorithm::SHA256);
        sha.update(b"abc");
        let mut md5 = make_hasher(HashAlgorithm::MD5);
        md5.update(b"abc");
        assert_ne!(sha.finalize_hex(), md5.finalize_hex());
    }

    /// 缓存键：路径或算法不同 → key 不同
    #[test]
    fn cache_key_differs_by_path_and_algorithm() {
        let k1 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        let k2 = file_cache_key("/tmp/b.bin", 100, HashAlgorithm::SHA256);
        let k3 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::MD5);
        assert_ne!(k1, k2);
        assert_ne!(k1, k3);
    }

    /// 缓存键：同路径同大小同算法，两次调用结果一致（mtime 取不到时为 0，稳定）
    #[test]
    fn cache_key_is_stable() {
        let k1 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        let k2 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        assert_eq!(k1, k2);
    }
}
```

- [ ] **Step 2: 运行测试确认通过（回归基线）**

Run: `cd tauri-app/src-tauri && cargo test`
Expected: `test hashing::tests::hash_vectors_match_known_values ... ok`、`test hashing::tests::make_hasher_distinguishes_algorithms ... ok`、`test hashing::tests::cache_key_differs_by_path_and_algorithm ... ok`、`test hashing::tests::cache_key_is_stable ... ok`，`test result: ok`。

- [ ] **Step 3: 提交**

```bash
git add tauri-app/src-tauri/src/hashing.rs
git commit -m "test: 添加哈希标准向量与缓存键单元测试"
```

---

### Task 2: 取消/暂停中断检查测试（lib.rs）

**Files:**
- Modify: `tauri-app/src-tauri/src/lib.rs`（文件末尾追加 `#[cfg(test)] mod tests`）

- [ ] **Step 1: 在 `lib.rs` 末尾追加测试模块**

在文件最后（`run()` 函数之后）追加：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    /// 已取消 → 立即返回错误
    #[test]
    fn check_interrupted_cancel_returns_error() {
        let state = AppState {
            pause_flag: Arc::new(AtomicBool::new(false)),
            cancel_flag: Arc::new(AtomicBool::new(true)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        };
        assert!(state.check_interrupted().is_err());
    }

    /// 暂停中阻塞等待；恢复后返回 Ok（轮询间隔 50ms，200ms 后恢复）
    #[test]
    fn check_interrupted_pause_blocks_until_resume() {
        let state = AppState {
            pause_flag: Arc::new(AtomicBool::new(true)),
            cancel_flag: Arc::new(AtomicBool::new(false)),
            hash_cache: Arc::new(Mutex::new(HashMap::new())),
            batch_results: Arc::new(Mutex::new(Vec::new())),
        };
        // 200ms 后在另一个线程恢复
        let resume_flag = state.pause_flag.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(200));
            resume_flag.store(false, Ordering::Relaxed);
        });

        let start = Instant::now();
        assert!(state.check_interrupted().is_ok());
        assert!(
            start.elapsed() >= Duration::from_millis(150),
            "暂停应在恢复前阻塞至少约 200ms"
        );
    }
}
```

注：`Arc`/`Mutex`/`HashMap`/`AtomicBool`/`Ordering`/`Duration` 已由 `lib.rs` 顶部 `use` 引入，`use super::*` 会带入；`Instant` 在测试模块内显式引入。

- [ ] **Step 2: 运行测试确认通过**

Run: `cd tauri-app/src-tauri && cargo test`
Expected: `test tests::check_interrupted_cancel_returns_error ... ok`、`test tests::check_interrupted_pause_blocks_until_resume ... ok`，`test result: ok`。

- [ ] **Step 3: 提交**

```bash
git add tauri-app/src-tauri/src/lib.rs
git commit -m "test: 添加取消/暂停中断检查单元测试"
```

---

## Part B：批量校验性能优化

### Task 3: 抽公共中断检查 + 类型别名 + 读取缓冲常量（hashing.rs / lib.rs）

**Files:**
- Modify: `tauri-app/src-tauri/src/hashing.rs`
- Modify: `tauri-app/src-tauri/src/lib.rs`

- [ ] **Step 1: `hashing.rs` 增加 imports 与三个公共项**

把 `hashing.rs` 顶部（`use crate::models::HashAlgorithm;` 之前）改为：

```rust
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, UNIX_EPOCH};

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};

use crate::models::HashAlgorithm;
```

在 `make_hasher` 函数之后、`file_cache_key` 之前插入：

```rust
/// 哈希读取块大小：1MB，减少系统调用次数（相对 8KB 显著降低 syscall 开销）
pub const CHUNK_SIZE: usize = 1024 * 1024;

/// 哈希缓存类型别名：键 (路径, 大小, mtime纳秒, 算法) → 哈希值
pub type HashCache = HashMap<(String, u64, u128, HashAlgorithm), String>;

/// 中断检查：已取消返回错误；已暂停阻塞等待（期间仍检查取消）。
/// 独立于 AppState，供 blocking 线程中的批量处理使用。
pub fn check_interrupted(pause_flag: &AtomicBool, cancel_flag: &AtomicBool) -> Result<(), String> {
    if cancel_flag.load(Ordering::Relaxed) {
        return Err("计算已取消".into());
    }
    while pause_flag.load(Ordering::Relaxed) {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("计算已取消".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}
```

- [ ] **Step 2: `lib.rs` 让 `AppState::check_interrupted` 委托给自由函数，缓存字段改用别名**

把 `lib.rs` 的 `use` 区改为（在现有 `use commands::hash::...` 之后追加）：

```rust
use crate::hashing::{check_interrupted, HashCache};
```

把 `AppState` 的 `hash_cache` 字段声明改为：

```rust
    /// 哈希缓存：(文件路径, 文件大小, 修改时间纳秒, 算法) -> 哈希值
    pub hash_cache: Arc<Mutex<HashCache>>,
```

把 `impl AppState` 块整体替换为：

```rust
impl AppState {
    /// 中断检查：已取消则返回错误；已暂停则阻塞等待恢复（期间仍检查取消）。
    /// 供哈希计算分块循环逐块调用。实现委托给 hashing::check_interrupted。
    pub fn check_interrupted(&self) -> Result<(), String> {
        check_interrupted(self.pause_flag.as_ref(), self.cancel_flag.as_ref())
    }
}
```

- [ ] **Step 3: 运行测试确认仍通过（重构未破坏行为）**

Run: `cd tauri-app/src-tauri && cargo test`
Expected: `test result: ok`，包含 Task 1 的 4 个哈希测试与 Task 2 的 2 个中断测试。

- [ ] **Step 4: 提交**

```bash
git add tauri-app/src-tauri/src/hashing.rs tauri-app/src-tauri/src/lib.rs
git commit -m "refactor: 抽公共中断检查与缓存类型别名，哈希读取缓冲提升至 1MB"
```

---

### Task 4: 批量校验移入 spawn_blocking（batch.rs）

**Files:**
- Modify: `tauri-app/src-tauri/src/commands/batch.rs`（整体重写）

- [ ] **Step 1: 重写 `batch.rs` 为阻塞线程执行版本**

完整新文件内容：

```rust
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::hashing::{check_interrupted, file_cache_key, make_hasher, HashCache, CHUNK_SIZE};
use crate::models::{BatchProgress, BatchResult, HashAlgorithm, HashResult, HashStatus};
use crate::AppState;

/// 开始批量校验（整批在 blocking 线程中顺序执行，不占用异步 worker；
/// 暂停/恢复/取消、进度事件顺序与前端契约保持不变）
#[tauri::command]
pub async fn start_batch_validation(
    file_paths: Vec<String>,
    algorithm: HashAlgorithm,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatchResult, String> {
    // 提取可跨线程的 Arc（State 借用不能 move 进 'static blocking 闭包）
    let pause_flag = state.pause_flag.clone();
    let cancel_flag = state.cancel_flag.clone();
    let hash_cache = state.hash_cache.clone();
    let batch_results = state.batch_results.clone();

    // 重置状态
    cancel_flag.store(false, Ordering::Relaxed);
    pause_flag.store(false, Ordering::Relaxed);

    let inner = tauri::async_runtime::spawn_blocking(move || {
        let start_time = Instant::now();
        let total_files = file_paths.len();
        let mut results = Vec::with_capacity(total_files);
        let mut success_count = 0;
        let mut error_count = 0;

        for file_path in file_paths {
            // 检查是否取消（文件之间）
            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let file_start = Instant::now();
            let result = process_single_file(
                &file_path,
                algorithm,
                &pause_flag,
                &cancel_flag,
                &hash_cache,
            );

            match result {
                Ok(mut hash_result) => {
                    hash_result.elapsed_time = file_start.elapsed().as_secs_f64();
                    results.push(hash_result.clone());
                    success_count += 1;

                    // 发送单文件完成事件
                    let _ = app.emit("batch-file-complete", hash_result);
                }
                Err(e) => {
                    let error_result = HashResult {
                        file_path: file_path.clone(),
                        algorithm,
                        hash_value: String::new(),
                        elapsed_time: file_start.elapsed().as_secs_f64(),
                        status: HashStatus::Error,
                        from_cache: false,
                        error_message: Some(e),
                    };
                    results.push(error_result.clone());
                    error_count += 1;

                    let _ = app.emit("batch-file-complete", error_result);
                }
            }

            // 发送批量进度
            let _ = app.emit(
                "batch-progress",
                BatchProgress {
                    done: results.len(),
                    total: total_files,
                },
            );
        }

        let total_time = start_time.elapsed().as_secs_f64();

        let batch_result = BatchResult {
            results: results.clone(),
            total: results.len(),
            success: success_count,
            error: error_count,
            mismatch: 0,
            total_time,
        };

        // 存储结果
        *batch_results.lock().unwrap() = results;

        // 发送批量完成事件
        let _ = app.emit("batch-complete", batch_result.clone());

        Ok::<BatchResult, String>(batch_result)
    })
    .await
    .map_err(|e| format!("批量校验线程异常: {}", e))?;

    Ok(inner)
}

/// 处理单个文件：检查缓存，未命中则分块计算（逐块检查取消/暂停）。
/// 通过克隆出的 Arc 标志与缓存访问，可在 blocking 线程中使用。
fn process_single_file(
    file_path: &str,
    algorithm: HashAlgorithm,
    pause_flag: &Arc<AtomicBool>,
    cancel_flag: &Arc<AtomicBool>,
    hash_cache: &Arc<Mutex<HashCache>>,
) -> Result<HashResult, String> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let file_size = path.metadata().map_err(|e| e.to_string())?.len();

    // 检查缓存
    let cache_key = file_cache_key(file_path, file_size, algorithm);
    {
        let cache = hash_cache.lock().unwrap();
        if let Some(cached_hash) = cache.get(&cache_key) {
            return Ok(HashResult {
                file_path: file_path.to_string(),
                algorithm,
                hash_value: cached_hash.clone(),
                elapsed_time: 0.0,
                status: HashStatus::Success,
                from_cache: true,
                error_message: None,
            });
        }
    }

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; CHUNK_SIZE];

    let mut hasher = make_hasher(algorithm);
    loop {
        check_interrupted(pause_flag.as_ref(), cancel_flag.as_ref())?;

        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    let hash_value = hasher.finalize_hex();

    // 缓存结果
    let mut cache = hash_cache.lock().unwrap();
    cache.insert(
        file_cache_key(file_path, file_size, algorithm),
        hash_value.clone(),
    );

    Ok(HashResult {
        file_path: file_path.to_string(),
        algorithm,
        hash_value,
        elapsed_time: 0.0,
        status: HashStatus::Success,
        from_cache: false,
        error_message: None,
    })
}
```

- [ ] **Step 2: 编译 + 测试**

Run: `cd tauri-app/src-tauri && cargo check`
Expected: 无警告无错误（若 Tauri 宏有警告可忽略，但不能有 error）。

Run: `cd tauri-app/src-tauri && cargo test`
Expected: `test result: ok`（6 个测试全部通过）。

- [ ] **Step 3: 提交**

```bash
git add tauri-app/src-tauri/src/commands/batch.rs
git commit -m "perf: 批量校验移入 spawn_blocking，读取缓冲提升至 1MB"
```

---

### Task 5: 单文件哈希命令统一使用 CHUNK_SIZE（hash.rs）

**Files:**
- Modify: `tauri-app/src-tauri/src/commands/hash.rs`

- [ ] **Step 1: 修改 import 并替换两处 8KB 缓冲**

把 `hash.rs` 顶部 import 改为：

```rust
use crate::hashing::{file_cache_key, make_hasher, CHUNK_SIZE};
```

把 `quick_calculate_hash` 中的：

```rust
    let mut buffer = [0u8; 8192];
```

替换为：

```rust
    let mut buffer = vec![0u8; CHUNK_SIZE];
```

把 `do_calculate_hash` 中的：

```rust
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = [0u8; 8192];
    let mut total_read = 0u64;
```

替换为：

```rust
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut total_read = 0u64;
```

注：`quick_calculate_hash` 中 `let want = std::cmp::min(buffer.len() as u64, read_limit - total_read) as usize;` 对 `Vec` 同样成立，无需改动。

- [ ] **Step 2: 编译 + 测试**

Run: `cd tauri-app/src-tauri && cargo check`
Expected: 无 error。

Run: `cd tauri-app/src-tauri && cargo test`
Expected: `test result: ok`。

- [ ] **Step 3: 提交**

```bash
git add tauri-app/src-tauri/src/commands/hash.rs
git commit -m "perf: 单文件哈希统一使用 1MB 读取缓冲"
```

---

## Part C：前端反馈体验

### Task 6: toast 基础设施（toastStore + ToastHost）

**Files:**
- Create: `tauri-app/src/store/toastStore.ts`
- Create: `tauri-app/src/components/ui/toast.tsx`
- Modify: `tauri-app/src/App.tsx`

- [ ] **Step 1: 新建 `toastStore.ts`**

完整新文件内容：

```ts
import { create } from "zustand";

/** Toast 类型 */
export type ToastType = "success" | "error" | "info";

/** Toast 消息 */
export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: number) => void;
}

let nextId = 1;

/** Toast 状态：3 秒后自动消失 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
```

- [ ] **Step 2: 新建 `components/ui/toast.tsx`**

完整新文件内容：

```tsx
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type Toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

/** 单条 Toast 视图 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // 图标颜色用内联变量保证在自定义工具类体系下生效
  const color = {
    success: "var(--primary)",
    error: "var(--destructive)",
    info: "var(--secondary)",
  }[toast.type];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-default border border-border bg-card px-3 py-2 text-sm shadow-lg",
      )}
    >
      {toast.type === "success" && (
        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      {toast.type === "error" && (
        <XCircle className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      {toast.type === "info" && (
        <Info className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      <span className="flex-1 text-foreground">{toast.message}</span>
      <button
        className="text-muted-foreground hover:text-foreground"
        onClick={onClose}
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Toast 宿主：固定右下角渲染所有 toast（3 秒自动消失） */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[320px] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onClose={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `App.tsx` 挂载 `ToastHost`**

在 `App.tsx` 的 import 区追加：

```ts
import { useToastStore } from "./store/toastStore";
import { ToastHost } from "./components/ui/toast";
```

在组件函数体内（`useKeyboardShortcuts();` 附近）追加：

```ts
  const addToast = useToastStore((s) => s.addToast);
```

把 `<MainLayout>` 的 children 末尾（`<ExportDialog .../>` 之后、`</MainLayout>` 之前）追加：

```tsx
      <ToastHost />
```

- [ ] **Step 4: 构建验证**

Run: `cd tauri-app && npm run build`
Expected: `tsc` 无错误，`vite build` 成功，输出 `dist/` 产物。

- [ ] **Step 5: 提交**

```bash
git add tauri-app/src/store/toastStore.ts tauri-app/src/components/ui/toast.tsx tauri-app/src/App.tsx
git commit -m "feat: 新增 toast 反馈系统并挂载到主界面"
```

---

### Task 7: 复制反馈接入（appStore / ResultSection / MenuBar）

**Files:**
- Modify: `tauri-app/src/store/appStore.ts`
- Modify: `tauri-app/src/components/ResultSection.tsx`
- Modify: `tauri-app/src/components/layout/MenuBar.tsx`

- [ ] **Step 1: `appStore.ts` 让 `copyResult` 返回是否成功**

把接口声明改为：

```ts
  /** 复制结果到剪贴板，返回是否成功 */
  copyResult: () => Promise<boolean>;
```

把 `create<AppState>((set) => ({` 改为 `create<AppState>((set, get) => ({`。

把 `copyResult` 实现替换为：

```ts
  copyResult: async () => {
    // 优先复制结构化哈希行（文件名: 哈希），对齐 PyQt 语义；无结果时回退复制整个结果区
    const { lastResults, resultText } = get();
    let text = "";
    if (lastResults && lastResults.length > 0) {
      text = lastResults
        .filter((r) => r.hashValue)
        .map(
          (r) =>
            `${r.filePath.split(/[/\\]/).pop() ?? r.filePath}: ${r.hashValue}`,
        )
        .join("\n");
    } else if (resultText) {
      text = resultText;
    }
    if (!text) return false;
    try {
      await writeText(text);
      return true;
    } catch {
      // 剪贴板写入失败
      return false;
    }
  },
```

- [ ] **Step 2: `ResultSection.tsx` 复制成功后弹 toast**

在 import 区追加：

```ts
import { useToastStore } from "@/store/toastStore";
```

在组件函数体内追加：

```ts
  const addToast = useToastStore((s) => s.addToast);
  const handleCopyResult = useCallback(async () => {
    const ok = await copyResult();
    if (ok) addToast("success", t("copied_to_clipboard"));
  }, [copyResult, addToast, t]);
```

把复制按钮的 `onClick={copyResult}` 改为 `onClick={handleCopyResult}`，并把依赖数组末尾追加 `handleCopyResult`（即 `[isCalculating, fileList, algorithm, setCalculating, setPaused, setProgress, setCurrentFile, setResultText, setStatusMessage, handleCopyResult]`）。

- [ ] **Step 3: `MenuBar.tsx` 菜单「复制哈希值」成功后弹 toast**

在 import 区追加：

```ts
import { useToastStore } from "@/store/toastStore";
```

在组件函数体内追加：

```ts
  const addToast = useToastStore((s) => s.addToast);
```

把 `handleMenuClick` 的 `copy_hash` 分支改为：

```ts
      case "copy_hash":
        if (await copyResult()) {
          addToast("success", t("copied_to_clipboard"));
        }
        break;
```

- [ ] **Step 4: 构建验证**

Run: `cd tauri-app && npm run build`
Expected: `tsc` 无错误，构建成功。

- [ ] **Step 5: 提交**

```bash
git add tauri-app/src/store/appStore.ts tauri-app/src/components/ResultSection.tsx tauri-app/src/components/layout/MenuBar.tsx
git commit -m "feat: 复制哈希成功时弹出 toast 反馈"
```

---

### Task 8: 导出 / 清空历史 / 导入反馈接入（ExportDialog / App）

**Files:**
- Modify: `tauri-app/src/components/dialogs/ExportDialog.tsx`
- Modify: `tauri-app/src/App.tsx`

- [ ] **Step 1: `ExportDialog.tsx` 导出成功/失败弹 toast**

在 import 区追加：

```ts
import { useToastStore } from "@/store/toastStore";
```

在组件函数体内追加：

```ts
  const addToast = useToastStore((s) => s.addToast);
```

把 `handleExport` 的成功分支改为：

```ts
      setStatusMessage(`${t("export_success")} ${path}`);
      addToast("success", `${t("export_success")} ${path}`);
      onOpenChange(false);
```

把 `catch` 分支改为：

```ts
    } catch {
      setStatusMessage(t("export_failed"));
      addToast("error", t("export_failed"));
    }
```

- [ ] **Step 2: `App.tsx` 清空历史 / 导入验证文件弹 toast**

把 `onClearHistory` 改为：

```ts
    const onClearHistory = async () => {
      const ok = await ask(t("clear_history_confirm"), { title: t("warning") });
      if (ok) {
        await apiClearHistory();
        addToast("success", t("history_cleared"));
      }
    };
```

把 `onImportVerification` 的成功分支改为：

```ts
        setExpectedHash(entries.map((e) => e.hashValue).join("\n"));
        setStatusMessage(`${t("import_success")} ${entries.length}`);
        addToast("success", t("import_success", { count: entries.length }));
```

把最后一个自定义事件监听 `useEffect` 的依赖数组 `[t, setStatusMessage, setExpectedHash]` 改为：

```ts
  }, [t, setStatusMessage, setExpectedHash, addToast]);
```

- [ ] **Step 3: 构建验证**

Run: `cd tauri-app && npm run build`
Expected: `tsc` 无错误，构建成功。

- [ ] **Step 4: 提交**

```bash
git add tauri-app/src/components/dialogs/ExportDialog.tsx tauri-app/src/App.tsx
git commit -m "feat: 导出、清空历史、导入验证文件弹 toast 反馈"
```

---

### Task 9: 比较哈希后回填列表状态（HashVerification）

**Files:**
- Modify: `tauri-app/src/components/HashVerification.tsx`

- [ ] **Step 1: 引入 `updateFileByPath` 并在比较后回填**

在组件函数体内追加：

```ts
  const updateFileByPath = useAppStore((s) => s.updateFileByPath);
```

把 `handleCompareHash` 的单行预期比较循环整体替换为：

```ts
      for (const item of calculatedResults) {
        const fileName = item.path.split(/[/\\]/).pop() ?? item.path;
        const calculatedClean = item.hash.toLowerCase().replace(/\s/g, "");
        const isMatch = calculatedClean === expectedClean;

        // 回填列表状态，供状态色与后续操作使用
        updateFileByPath(item.path, item.hash, isMatch ? "success" : "mismatch");

        if (isMatch) {
          resultText += `✓ ${fileName} ${t("match")}\n`;
          matchCount++;
        } else {
          resultText += `✗ ${fileName} ${t("mismatch")}\n`;
          mismatchCount++;
        }
      }
```

把 `handleCompareHash` 的多行预期比较循环整体替换为：

```ts
      for (let i = 0; i < expectedLines.length; i++) {
        const expectedClean = expectedLines[i].toLowerCase().replace(/\s/g, "");
        const fileName =
          calculatedResults[i].path.split(/[/\\]/).pop() ??
          calculatedResults[i].path;
        const calculatedClean = calculatedResults[i].hash
          .toLowerCase()
          .replace(/\s/g, "");

        // 验证格式
        if (!/^[0-9a-f]+$/i.test(expectedClean)) {
          resultText += `${i + 1}. ✗ ${t("format_error")}\n`;
          mismatchCount++;
          updateFileByPath(
            calculatedResults[i].path,
            calculatedResults[i].hash,
            "mismatch",
          );
          continue;
        }

        const isMatch = calculatedClean === expectedClean;
        updateFileByPath(
          calculatedResults[i].path,
          calculatedResults[i].hash,
          isMatch ? "success" : "mismatch",
        );

        if (isMatch) {
          resultText += `${i + 1}. ✓ ${fileName} ${t("match")}\n`;
          matchCount++;
        } else {
          resultText += `${i + 1}. ✗ ${fileName} ${t("mismatch")}\n`;
          mismatchCount++;
        }
      }
```

把 `handleCompareHash` 的依赖数组 `[expectedHash, fileList, setResultText, t]` 改为：

```ts
  }, [expectedHash, fileList, setResultText, updateFileByPath, t]);
```

- [ ] **Step 2: 构建验证**

Run: `cd tauri-app && npm run build`
Expected: `tsc` 无错误，构建成功。

- [ ] **Step 3: 提交**

```bash
git add tauri-app/src/components/HashVerification.tsx
git commit -m "feat: 哈希比较后回填文件列表匹配/不匹配状态"
```

---

## Task 10: 手动验收（tauri dev）

**Files:** 无（验证任务）

- [ ] **Step 1: 启动开发模式**

Run: `cd tauri-app && npm run tauri dev`
Expected: 窗口正常打开，无控制台报错。

- [ ] **Step 2: 批量校验 + 暂停/取消**

添加多个文件（含一个中等大小文件）→ 开始批量校验 → 校验期间点「暂停」应停住、点「继续」应恢复、点「取消」应终止并输出「批量校验已取消」。校验完成后结果逐文件出现、状态栏显示「已完成」。

- [ ] **Step 3: toast 反馈**

- 「复制结果」→ 右下角弹「已复制到剪贴板」，3 秒自动消失。
- 菜单「编辑 → 复制哈希值」→ 同样弹 toast。
- 菜单「文件 → 导出结果」→ 选 CSV/JSON 导出到文件 → 弹「结果已导出到: …」；选一个不可写路径导出 → 弹「导出失败」。
- 菜单「工具 → 清空历史记录」→ 确认后弹「历史记录已清空」。
- 菜单「工具 → 导入验证文件」→ 选合法验证文件 → 弹「成功导入 N 条记录」。

- [ ] **Step 4: 比较结果回填列表状态**

先对若干文件批量校验（列表全部变绿 success）→ 在「验证哈希值」输入框粘贴一个与文件内容不符的假哈希 → 点「比较哈希值」→ 文件列表对应行背景变为 `bg-mismatch` 并出现 ✗；粘贴正确哈希 → 比较后恢复 `bg-success`。

- [ ] **Step 5: 回归确认**

`cargo test` 全部通过、`cargo check` 无 error、`npm run build` 成功。若以上任一项失败，先修再验收。

---

## 验收标准汇总

1. `cargo test` 通过 6 个新增测试（哈希向量 ×4 + 中断检查 ×2），且重构后仍全部通过。
2. 批量校验在 `spawn_blocking` 中执行，`cargo check` 无 error，暂停/继续/取消与进度事件行为与改动前一致。
3. 复制/导出/清空历史/导入验证均有 toast 即时反馈，3 秒自动消失。
4. 哈希比较后文件列表回填 success/mismatch 状态色。

## 非目标（明确不做）

- 不做批量**并行**处理：会破坏暂停/恢复语义、进度事件顺序与缓存互斥简单性，收益有限（单文件哈希受 IO 限制），留作后续独立评估。
- 不引入前端测试框架（vitest 等）：属于新增依赖，按项目红线需另行确认；前端验证以 `tsc` + 手动验收为准。
- 不做启动速度、打包体积优化；不做 UI 视觉重构。
