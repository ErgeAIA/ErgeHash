import { TFunction } from "i18next";

/**
 * 后端错误码 → i18n key 的映射。
 *
 * 后端（Rust）只回传结构化错误码（error_code）与可选动态参数（error_detail），
 * 不回传任何本地化文案。本表把错误码映射到 i18n key，由 t() 按当前语言翻译，
 * 从而实现错误信息随界面语言切换（方案 A）。
 *
 * 带 {{detail}} 插值的文案：error_detail 通常是文件路径、系统错误等不可枚举内容。
 */
const ERROR_I18N_KEY: Record<string, string> = {
  // 文件 / 路径
  FILE_NOT_FOUND: "err_file_not_found",
  PATH_TRAVERSAL: "err_path_traversal",
  DIR_NOT_FOUND: "err_dir_not_found",
  PATH_NOT_DIR: "err_path_not_dir",
  READ_FILE_FAILED: "err_read_file_failed",
  UNSUPPORTED_ALGORITHM: "err_unsupported_algorithm",
  // 计算流程
  COMPUTE_CANCELLED: "err_compute_cancelled",
  BATCH_THREAD_PANIC: "err_batch_thread_panic",
  // 记事本
  OPEN_NOTEPAD_FAILED: "err_open_notepad_failed",
  NOTEPAD_WINDOWS_ONLY: "err_notepad_windows_only",
  // 校验文件导出
  EXPORT_DIR_UNRESOLVABLE: "err_export_dir_unresolvable",
  EXPORT_ILLEGAL_FILENAME: "err_export_illegal_filename",
  EXPORT_FILENAME_NEWLINE: "err_export_filename_newline",
  EXPORT_WRITE_FAILED: "err_export_write_failed",
  WRITE_CSV_FAILED: "err_write_csv_failed",
  SERIALIZE_JSON_FAILED: "err_serialize_json_failed",
  WRITE_JSON_FAILED: "err_write_json_failed",
  // 校验文件导入解析
  VERIFY_FILE_NOT_FOUND: "err_verify_file_not_found",
  VERIFY_FILE_READ_FAILED: "err_verify_file_read_failed",
  // 窗口 / 命令
  MAIN_WINDOW_MISSING: "err_main_window_missing",
  // 配置 / 历史读写
  CONFIG_DIR_CREATE_FAILED: "err_config_dir_create_failed",
  CONFIG_SERIALIZE_FAILED: "err_config_serialize_failed",
  CONFIG_WRITE_FAILED: "err_config_write_failed",
  CONFIG_READ_FAILED: "err_config_read_failed",
  CONFIG_PARSE_FAILED: "err_config_parse_failed",
  HISTORY_DIR_CREATE_FAILED: "err_history_dir_create_failed",
  HISTORY_SERIALIZE_FAILED: "err_history_serialize_failed",
  HISTORY_WRITE_FAILED: "err_history_write_failed",
  HISTORY_CLEAR_FAILED: "err_history_clear_failed",
  APP_DATA_DIR_FAILED: "err_app_data_dir_failed",
};

/**
 * 将后端错误码翻译为当前语言的用户文案。
 * @param code 后端回传的结构化错误码
 * @param detail 可选动态参数（文件路径 / 系统错误等）
 * @param t i18next 翻译函数
 * @param fallback 当 code 无映射时使用（通常是后端兜底 errorMessage 或原始 code）
 */
export function translateErrorCode(
  code: string | null | undefined,
  detail: string | null | undefined,
  t: TFunction,
  fallback?: string | null,
): string {
  if (!code) {
    return fallback ?? t("err_unknown");
  }
  const key = ERROR_I18N_KEY[code];
  if (!key) {
    return fallback ?? code;
  }
  // 带 detail 的文案统一提供 {{detail}} 插值；i18n 缺失时退化为 code
  return t(key, { detail: detail ?? "", defaultValue: code });
}

/**
 * 解析 Tauri 命令错误字符串（格式 `CODE|detail` 或纯 CODE）。
 * 返回 { code, detail }。
 */
export function parseTauriError(err: unknown): { code: string; detail?: string } {
  const raw = typeof err === "string" ? err : String(err ?? "");
  const idx = raw.indexOf("|");
  if (idx === -1) {
    return { code: raw };
  }
  return { code: raw.slice(0, idx), detail: raw.slice(idx + 1) || undefined };
}
