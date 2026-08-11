import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { ask } from "@tauri-apps/plugin-dialog";

/** 文件列表底部的全局操作按钮：开始校验 + 清空列表 */
export function FileActions() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const clearFiles = useAppStore((s) => s.clearFiles);
  const addToast = useToastStore((s) => s.addToast);

  const hasFiles = fileList.length > 0;

  /** 开始校验：委托 store.startValidation（单一来源，自动/手动共用） */
  const handleStartVerify = useCallback(async () => {
    if (isCalculating) return;
    if (fileList.length === 0) {
      addToast("error", t("please_add_files"));
      return;
    }
    await useAppStore.getState().startValidation();
  }, [isCalculating, fileList.length, addToast, t]);

  /** 点击清空列表按钮（带确认） */
  const handleClearClick = useCallback(async () => {
    const ok = await ask(t("confirm_clear_files"), { title: t("warning") });
    if (ok) {
      clearFiles();
    }
  }, [clearFiles, t]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleStartVerify();
        }}
        disabled={isCalculating || !hasFiles}
        title={hasFiles ? t("start_verify") : t("please_add_files")}
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleClearClick();
        }}
        disabled={!hasFiles}
        title={t("clear_list")}
        aria-label={t("clear_list")}
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-all",
          "hover:scale-105 hover:bg-destructive/90 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
        )}
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}
