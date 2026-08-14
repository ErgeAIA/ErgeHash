import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";

/** 文件列表底部的全局操作按钮：开始校验 + 清空列表 */
export function FileActions() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const addToast = useToastStore((s) => s.addToast);
  const clearAll = useAppStore((s) => s.clearAll);
  const hasFiles = fileList.length > 0;
  // 校验文件不参与计算，开始校验需至少存在一个源文件
  const hasSourceFiles = fileList.some((f) => f.role !== "verification");
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** 开始校验：委托 store.startValidation（单一来源，自动/手动共用） */
  const handleStartVerify = useCallback(async () => {
    if (isCalculating) return;
    if (!hasSourceFiles) {
      addToast("error", t("no_source_files"));
      return;
    }
    await useAppStore.getState().startValidation();
  }, [isCalculating, hasSourceFiles, addToast, t]);

  /** 点击清空列表按钮：弹出主题自适应确认对话框 */
  const handleClearClick = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    clearAll();
  }, [clearAll]);

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("warning")}
        description={t("confirm_clear_files")}
        variant="destructive"
        onConfirm={handleConfirmClear}
      />
      <div className="flex flex-col items-center gap-3">
      <Tooltip label={hasSourceFiles ? t("start_verify") : t("no_source_files")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleStartVerify();
          }}
          disabled={isCalculating || !hasSourceFiles}
          aria-label={t("start_verify")}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all",
            "hover:scale-105 hover:bg-primary/90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
          )}
        >
          {isCalculating ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
          ) : (
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          )}
        </button>
      </Tooltip>
      <Tooltip label={t("clear_list_pending")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleClearClick();
          }}
          disabled={!hasFiles}
          aria-label={t("clear_list_pending")}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-all",
            "hover:scale-105 hover:bg-destructive/90 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
          )}
        >
          <X className="h-6 w-6" />
        </button>
      </Tooltip>
    </div>
  </>
  );
}
