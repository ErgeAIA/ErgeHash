import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  HashAlgorithm,
  HashResult,
  HashProgress,
  BatchResult,
  BatchStatistics,
  HistoryEntry,
  AppConfig,
  VerificationEntry,
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

/** 获取批量校验统计信息 */
export async function getBatchStatistics(): Promise<BatchStatistics> {
  return invoke<BatchStatistics>("get_batch_statistics");
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
): Promise<boolean> {
  return invoke<boolean>("export_csv", { data, filePath });
}

/** 导出为 JSON */
export async function exportJson(
  data: HashResult[],
  filePath: string,
): Promise<boolean> {
  return invoke<boolean>("export_json", { data, filePath });
}

/** 生成验证文件 */
export async function generateVerificationFile(
  filePath: string,
  algorithm: HashAlgorithm,
  hashValue: string,
  outputPath: string,
): Promise<boolean> {
  return invoke<boolean>("generate_verification_file", {
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
