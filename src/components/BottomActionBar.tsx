import { useTranslation } from "react-i18next";
import { Fingerprint, Trash2, FileDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { SHORTCUT_BINDINGS, formatShortcut } from "@/lib/shortcuts";

interface BottomActionBarProps {
  className?: string;
}

export function BottomActionBar({ className }: BottomActionBarProps) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const startValidation = useAppStore((s) => s.startValidation);
  const clearFiles = useAppStore((s) => s.clearFiles);

  const hasFiles = fileList.length > 0;

  const startShortcut = SHORTCUT_BINDINGS.start_verify
    ? ` (${formatShortcut(SHORTCUT_BINDINGS.start_verify)})`
    : "";
  const clearShortcut = SHORTCUT_BINDINGS.clear_list
    ? ` (${formatShortcut(SHORTCUT_BINDINGS.clear_list)})`
    : "";

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent("export-results"));
  };

  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center justify-center gap-4 px-4",
        className,
      )}
    >
      {/* 开始校验：指纹徽章，主题品牌色 */}
      <button
        type="button"
        onClick={() => startValidation()}
        disabled={!hasFiles || isCalculating}
        title={t("start_verify") + startShortcut}
        className={cn(
          "btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
          hasFiles && !isCalculating && "animate-breathe",
        )}
      >
        <Fingerprint className="h-6 w-6" />
      </button>

      {/* 清空：垃圾桶徽章，destructive 红 */}
      <button
        type="button"
        onClick={clearFiles}
        disabled={!hasFiles}
        title={t("clear_list_pending") + clearShortcut}
        className="btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-6 w-6" />
      </button>

      {/* 导出：文件导出徽章，secondary 蓝 */}
      <button
        type="button"
        onClick={handleExport}
        disabled={!hasFiles}
        title={t("export")}
        className="btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileDown className="h-6 w-6" />
      </button>
    </div>
  );
}
