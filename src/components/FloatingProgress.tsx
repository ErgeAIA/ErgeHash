import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";
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

/** 从路径提取文件名 */
function getBasename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** 悬浮计算进度 toast：计算中时显示，含当前文件、进度条与暂停/取消控制 */
export function FloatingProgress() {
  const { t } = useTranslation();
  const progress = useAppStore((s) => s.progress);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const isPaused = useAppStore((s) => s.isPaused);
  const currentFile = useAppStore((s) => s.currentFile);
  const bytesRead = useAppStore((s) => s.bytesRead);
  const totalBytes = useAppStore((s) => s.totalBytes);
  const setPaused = useAppStore((s) => s.setPaused);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setProgress = useAppStore((s) => s.setProgress);
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
    setResultText((prev) => prev + `\n${t("batch_cancelled")}\n`);
  }, [isCalculating, setCalculating, setPaused, setProgress, setResultText, t]);

  if (!isCalculating) return null;

  return (
    <div className="fixed left-1/2 top-1/2 z-50 flex w-[340px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 rounded-xl bg-card/85 p-3.5 shadow-lg backdrop-blur-sm">
      {/* 当前文件 + 字节进度 */}
      {currentFile && (
        <div className="flex items-center justify-between gap-2">
          <Tooltip label={currentFile} className="flex-1 min-w-0">
            <span className="block w-full truncate text-xs text-muted-foreground">
              {getBasename(currentFile)}
            </span>
          </Tooltip>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {totalBytes > 0
              ? `${formatBytes(bytesRead)} / ${formatBytes(totalBytes)}`
              : `${progress}%`}
          </span>
        </div>
      )}

      {/* 进度条 */}
      <Progress value={progress} />

      {/* 控制按钮 */}
      <div className="flex items-center justify-end gap-2">
        <Tooltip label={isPaused ? t("resume") : t("pause")}>
          <Button
            variant="warning"
            size="sm"
            onClick={handleTogglePause}
            aria-label={isPaused ? t("resume") : t("pause")}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </Button>
        </Tooltip>
        <Tooltip label={t("stop")}>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            aria-label={t("stop")}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
