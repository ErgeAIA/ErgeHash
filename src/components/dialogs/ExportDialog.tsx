import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import {
  saveFileDialog,
  exportCsv,
  exportJson,
  exportVerificationFiles,
} from "@/services/api";
import { FileDown, FileSpreadsheet, FileJson, ShieldCheck } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 导出结果对话框：CSV / JSON / 校验文件（按算法在每个源文件同目录生成同名校验文件） */
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation();
  const lastResults = useAppStore((s) => s.lastResults);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const addToast = useToastStore((s) => s.addToast);

  const hasResults = !!lastResults && lastResults.length > 0;

  /** 执行导出：CSV/JSON 需选择保存路径；校验文件直接按算法生成到源文件同目录 */
  const handleExport = async (format: "csv" | "json" | "verify") => {
    if (!lastResults || lastResults.length === 0) return;
    try {
      if (format === "verify") {
        const report = await exportVerificationFiles(lastResults);
        if (report.written.length === 0) {
          setStatusMessage(t("verify_files_none"));
          addToast("error", t("verify_files_none"));
          return;
        }
        const msg = t("verify_files_done", { count: report.written.length });
        setStatusMessage(msg);
        if (report.errors.length > 0) {
          addToast(
            "error",
            t("verify_files_partial", {
              done: report.written.length,
              failed: report.errors.length,
            }),
          );
        } else {
          addToast("success", msg);
        }
        onOpenChange(false);
        return;
      }

      const ext = format === "csv" ? "csv" : "json";
      const path = await saveFileDialog(`hashes.${ext}`);
      if (!path) return; // 用户取消

      if (format === "csv") {
        await exportCsv(lastResults, path);
      } else {
        await exportJson(lastResults, path);
      }

      setStatusMessage(`${t("export_success")} ${path}`);
      addToast("success", `${t("export_success")} ${path}`);
      onOpenChange(false);
    } catch {
      setStatusMessage(t("export_failed"));
      addToast("error", t("export_failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {t("export_results")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 space-y-2">
          {!hasResults && (
            <p className="text-sm text-muted-foreground">{t("no_results")}</p>
          )}

          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!hasResults}
            onClick={() => handleExport("csv")}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t("csv_file")}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!hasResults}
            onClick={() => handleExport("json")}
          >
            <FileJson className="mr-2 h-4 w-4" />
            {t("json_file")}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!hasResults}
            onClick={() => handleExport("verify")}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t("verify_file")}
          </Button>

          <p className="text-xs text-muted-foreground">
            {t("verify_file_hint")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
