import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/appStore";


/** 计算进度区域组件，对应原始 "计算进度" GroupBox */
export function ProgressSection() {
  const { t } = useTranslation();
  const isCalculating = useAppStore((s) => s.isCalculating);
  const isPaused = useAppStore((s) => s.isPaused);
  const progress = useAppStore((s) => s.progress);
  const currentFile = useAppStore((s) => s.currentFile);
  const statusMessage = useAppStore((s) => s.statusMessage);

  /** 获取状态标签文本 */
  const getStatusLabel = () => {
    if (isPaused) {
      return t("resume");
    }
    if (isCalculating) {
      const fileName = currentFile
        ? currentFile.split(/[/\\]/).pop()
        : "";
      return fileName
        ? `${t("calculating")} ${progress}% - ${fileName}`
        : `${t("calculating")} ${progress}%`;
    }
    if (statusMessage === "completed") {
      return t("completed");
    }
    return t("ready");
  };

  return (
    <fieldset className="rounded-default border border-border p-3">
      <legend className="px-2 text-sm font-medium text-foreground">
        {t("progress_group")}
      </legend>

      <div className="flex flex-col gap-2">
        {/* 进度条：非计算状态时隐藏 */}
        {isCalculating && (
          <Progress value={progress} />
        )}

        {/* 状态标签 */}
        <span className="text-xs text-muted-foreground">
          {getStatusLabel()}
        </span>
      </div>
    </fieldset>
  );
}
