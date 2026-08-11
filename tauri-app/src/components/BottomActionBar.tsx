import { useTranslation } from "react-i18next";
import { Play, Trash2, FileDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

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

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent("export-results"));
  };

  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-center gap-4 px-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => startValidation()}
        disabled={!hasFiles || isCalculating}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {t("start_verify")}
      </button>

      <button
        type="button"
        onClick={clearFiles}
        disabled={!hasFiles}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {t("clear_list_pending")}
      </button>

      <button
        type="button"
        onClick={handleExport}
        disabled={!hasFiles}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileDown className="h-4 w-4" />
        {t("export")}
      </button>
    </div>
  );
}
