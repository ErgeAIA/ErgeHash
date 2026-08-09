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
  generateVerificationFile,
} from "@/services/api";
import { FileDown, FileSpreadsheet, FileJson, ShieldCheck } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 导出结果对话框：CSV / JSON / 验证文件（验证文件仅支持单文件） */
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation();
  const lastResults = useAppStore((s) => s.lastResults);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const hasResults = !!lastResults && lastResults.length > 0;
  const canVerification = lastResults?.length === 1;

  /** 执行导出：选择保存路径后调用对应命令 */
  const handleExport = async (format: "csv" | "json" | "verify") => {
    if (!lastResults || lastResults.length === 0) return;
    try {
      if (format === "verify" && lastResults.length !== 1) {
        setStatusMessage(t("verification_file_single"));
        return;
      }

      const ext = format === "csv" ? "csv" : format === "json" ? "json" : "txt";
      const path = await saveFileDialog(`hashes.${ext}`);
      if (!path) return; // 用户取消

      if (format === "csv") {
        await exportCsv(lastResults, path);
      } else if (format === "json") {
        await exportJson(lastResults, path);
      } else {
        const r = lastResults[0];
        await generateVerificationFile(
          r.filePath,
          r.algorithm,
          r.hashValue,
          path,
        );
      }

      setStatusMessage(`${t("export_success")} ${path}`);
      onOpenChange(false);
    } catch {
      setStatusMessage(t("export_failed"));
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
            disabled={!hasResults || !canVerification}
            onClick={() => handleExport("verify")}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t("verify_file")}
          </Button>

          {lastResults && lastResults.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("verification_file_single")}
            </p>
          )}
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
