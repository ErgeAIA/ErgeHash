import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  HashAlgorithm,
  HashResult,
  HashProgress,
  BatchResult,
  HistoryEntry,
  AppConfig,
  VerificationEntry,
  FileItem,
} from "./types";

/** 计算单个文件哈希值 */
export async function calculateHash(
  filePath: string,
  algorithm: HashAlgorithm,
): Promise<HashResult> {
  return invoke<HashResult>("calculate_hash", { filePath, algorithm });
}

/** 快速计算文件哈希值（大文件只读部分） */
export async function quickCalculateHash(
  filePath: string,
  algorithm: HashAlgorithm,
): Promise<HashResult> {
  return invoke<HashResult>("quick_calculate_hash", { filePath, algorithm });
}

/** 暂停哈希计算 */
export async function pauseHashCalculation(): Promise<void> {
  return invoke("pause_hash_calculation");
}

/** 恢复哈希计算 */
export async function resumeHashCalculation(): Promise<void> {
  return invoke("resume_hash_calculation");
}

/** 取消哈希计算 */
export async function cancelHashCalculation(): Promise<void> {
  return invoke("cancel_hash_calculation");
}

/** 开始批量校验 */
export async function startBatchValidation(
  filePaths: string[],
  algorithm: HashAlgorithm,
): Promise<BatchResult> {
  return invoke<BatchResult>("start_batch_validation", { filePaths, algorithm });
}

/** 获取应用配置 */
export async function getConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_config");
}

/** 设置应用配置项 */
export async function setConfig(key: string, value: unknown): Promise<void> {
  return invoke("set_config", { key, value });
}

/** 获取历史记录 */
export async function getHistory(limit?: number): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("get_history", { limit });
}

/** 添加历史记录 */
export async function addHistory(entry: HistoryEntry): Promise<void> {
  return invoke("add_history", { entry });
}

/** 清空历史记录 */
export async function clearHistory(): Promise<void> {
  return invoke("clear_history");
}

/** 导出为 CSV */
export async function exportCsv(
  data: HashResult[],
  filePath: string,
): Promise<void> {
  return invoke("export_csv", { data, filePath });
}

/** 导出为 JSON */
export async function exportJson(
  data: HashResult[],
  filePath: string,
): Promise<void> {
  return invoke("export_json", { data, filePath });
}

/** 生成验证文件 */
export async function generateVerificationFile(
  filePath: string,
  algorithm: HashAlgorithm,
  hashValue: string,
  outputPath: string,
): Promise<void> {
  return invoke("generate_verification_file", {
    filePath,
    algorithm,
    hashValue,
    outputPath,
  });
}

/** 导入验证文件 */
export async function importVerificationFile(
  filePath: string,
): Promise<VerificationEntry[]> {
  return invoke<VerificationEntry[]>("import_verification_file", { filePath });
}

/** 扫描目录获取文件列表 */
export async function scanDirectory(dirPath: string): Promise<string[]> {
  return invoke<string[]>("scan_directory", { dirPath });
}

/** 获取文件元数据（路径、大小） */
export async function getFileMetadata(
  filePath: string,
): Promise<{ path: string; size: number }> {
  return invoke<{ path: string; size: number }>("get_file_metadata", { filePath });
}

/** 批量获取文件大小，返回 path -> size 映射 */
export async function getFileSizes(
  paths: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const meta = await getFileMetadata(path);
        return [path, meta.size] as const;
      } catch {
        return [path, 0] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** 在 store 中批量设置文件大小 */
export function applyFileSizes(
  items: FileItem[],
  sizes: Record<string, number>,
): void {
  items.forEach((item) => {
    if (item.size === undefined && sizes[item.path] !== undefined) {
      item.size = sizes[item.path] as number;
    }
  });
}

/** 打开系统记事本 */
export async function openNotepad(): Promise<void> {
  return invoke("open_notepad");
}

/** 打开文件选择对话框 */
export async function openFileDialog(): Promise<string[] | null> {
  return invoke<string[] | null>("open_file_dialog");
}

/** 打开文件夹选择对话框 */
export async function openFolderDialog(): Promise<string | null> {
  return invoke<string | null>("open_folder_dialog");
}

/** 打开保存文件对话框 */
export async function saveFileDialog(defaultName: string): Promise<string | null> {
  return invoke<string | null>("save_file_dialog", { defaultName });
}

/** 监听哈希计算进度事件 */
export async function onHashProgress(
  callback: (progress: HashProgress) => void,
): Promise<UnlistenFn> {
  return listen<HashProgress>("hash-progress", (event) => {
    callback(event.payload);
  });
}

/** 监听批量校验进度事件 */
export async function onBatchProgress(
  callback: (progress: { done: number; total: number }) => void,
): Promise<UnlistenFn> {
  return listen<{ done: number; total: number }>("batch-progress", (event) => {
    callback(event.payload);
  });
}

/** 监听批量校验单文件完成事件 */
export async function onBatchFileComplete(
  callback: (result: HashResult) => void,
): Promise<UnlistenFn> {
  return listen<HashResult>("batch-file-complete", (event) => {
    callback(event.payload);
  });
}

/** 监听批量校验全部完成事件 */
export async function onBatchComplete(
  callback: (result: BatchResult) => void,
): Promise<UnlistenFn> {
  return listen<BatchResult>("batch-complete", (event) => {
    callback(event.payload);
  });
}
