import { useTranslation } from "react-i18next";
import { Fingerprint, Trash2, FileDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { SHORTCUT_BINDINGS, formatShortcut } from "@/lib/shortcuts";
import { Tooltip } from "@/components/ui/Tooltip";

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
  // 校验文件不参与计算，开始校验需至少存在一个源文件
  const hasSourceFiles = fileList.some((f) => f.role !== "verification");

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
      {/* 开始校验：指纹徽章，主题品牌色；仅存在源文件时可点击 */}
      <Tooltip label={hasSourceFiles ? t("start_verify") + startShortcut : t("no_source_files")}>
        <button
          type="button"
          aria-label={hasSourceFiles ? t("start_verify") : t("no_source_files")}
          onClick={() => startValidation()}
          disabled={!hasSourceFiles || isCalculating}
          className={cn(
            "btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
            hasSourceFiles && !isCalculating && "animate-breathe",
          )}
        >
          <Fingerprint className="h-6 w-6" />
        </button>
      </Tooltip>

      {/* 清空：垃圾桶徽章，destructive 红 */}
      <Tooltip label={t("clear_list_pending") + clearShortcut}>
        <button
          type="button"
          aria-label={t("clear_list_pending")}
          onClick={clearFiles}
          disabled={!hasFiles}
          className="btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-6 w-6" />
        </button>
      </Tooltip>

      {/* 导出：文件导出徽章，secondary 蓝；仅存在源文件时可导出结果 */}
      <Tooltip label={t("export")}>
        <button
          type="button"
          aria-label={t("export")}
          onClick={handleExport}
          disabled={!hasSourceFiles}
          className="btn-icon-rotate inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileDown className="h-6 w-6" />
        </button>
      </Tooltip>
    </div>
  );
}
