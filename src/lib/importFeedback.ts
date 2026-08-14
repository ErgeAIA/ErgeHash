import type { TFunction } from "i18next";
import type { ToastType } from "@/store/toastStore";
import type { VerificationParseReport } from "@/services/types";

interface ImportFeedbackDeps {
  setImportedEntries: (report: VerificationParseReport) => void;
  addToast: (type: ToastType, message: string) => void;
  setStatusMessage: (message: string) => void;
  t: TFunction;
}

/**
 * 导入校验文件后的统一反馈逻辑：菜单「导入验证文件」与文件列表区拖放共用，消除分叉。
 * - entries 为空：未识别行提示或导入失败（error）；
 * - 有条目且存在截断/告警：部分导入（warning）；
 * - 否则：导入成功（success）。
 */
export function showImportFeedback(
  report: VerificationParseReport,
  deps: ImportFeedbackDeps,
): void {
  const { setImportedEntries, addToast, setStatusMessage, t } = deps;

  if (report.entries.length === 0) {
    const msg =
      report.unrecognized.length > 0
        ? t("import_unrecognized", { count: report.unrecognized.length })
        : t("import_error");
    setStatusMessage(msg);
    addToast("error", msg);
    return;
  }

  setImportedEntries(report);

  if (report.truncated || report.warnings.length > 0) {
    const msg = t("import_partial", {
      count: report.entries.length,
      warns: report.warnings.length,
      unrecognized: report.unrecognized.length,
    });
    setStatusMessage(msg);
    addToast("warning", msg);
  } else {
    const msg = t("import_success", { count: report.entries.length });
    setStatusMessage(msg);
    addToast("success", msg);
  }
}
