import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import {
  pauseHashCalculation,
  resumeHashCalculation,
  cancelHashCalculation,
} from "@/services/api";

/** 格式化字节大小为可读字符串 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** 计算进度区域组件 */
export function ProgressSection() {
  const { t } = useTranslation();
  const isCalculating = useAppStore((s) => s.isCalculating);
  const isPaused = useAppStore((s) => s.isPaused);
  const progress = useAppStore((s) => s.progress);
  const currentFile = useAppStore((s) => s.currentFile);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const bytesRead = useAppStore((s) => s.bytesRead);
  const totalBytes = useAppStore((s) => s.totalBytes);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setPaused = useAppStore((s) => s.setPaused);
  const setProgress = useAppStore((s) => s.setProgress);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const setResultText = useAppStore((s) => s.setResultText);

  /** 暂停/继续切换 */
  const handleTogglePause = useCallback(async () => {
    if (!isCalculating) return;

    try {
      if (isPaused) {
        await resumeHashCalculation();
        setPaused(false);
      } else {
        await pauseHashCalculation();
        setPaused(true);
      }
    } catch {
      // 暂停/恢复失败，忽略
    }
  }, [isCalculating, isPaused, setPaused]);

  /** 取消计算 */
  const handleCancel = useCallback(async () => {
    if (!isCalculating) return;

    try {
      await cancelHashCalculation();
    } catch {
      // 取消失败，忽略
    }

    setCalculating(false);
    setPaused(false);
    setProgress(0);
    setStatusMessage("ready");
    setResultText((prev) => prev + `\n${t("batch_cancelled")}\n`);
  }, [isCalculating, setCalculating, setPaused, setProgress, setStatusMessage, setResultText, t]);

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

  // 非计算且非完成状态：折叠为单行
  if (!isCalculating && statusMessage !== "completed") {
    return null;
  }

  return (
    <fieldset className="rounded-default border border-border p-3">
      <legend className="px-2 text-sm font-medium text-foreground">
        {t("progress_group")}
      </legend>

      <div className="flex flex-col gap-2">
        {/* 进度条 */}
        {isCalculating && (
          <Progress value={progress} />
        )}

        {/* 状态 + 字节信息 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {getStatusLabel()}
          </span>
          {isCalculating && totalBytes > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatBytes(bytesRead)} / {formatBytes(totalBytes)}
            </span>
          )}
        </div>

        {/* 控制按钮 */}
        {isCalculating && (
          <div className="flex items-center gap-2">
            <Button variant="warning" size="sm" onClick={handleTogglePause}>
              {isPaused ? (
                <>
                  <Play className="mr-1 h-4 w-4" />
                  {t("resume")}
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-4 w-4" />
                  {t("pause")}
                </>
              )}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <Square className="mr-1 h-4 w-4" />
              {t("stop")}
            </Button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
