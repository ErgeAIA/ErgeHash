import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Square } from "lucide-react";
import { cn } from "@/lib/utils";
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

/** 格式化秒数为可读字符串（mm:ss 或 hh:mm:ss） */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 从路径提取文件名 */
function getBasename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** 计算速度 (bytes/s) 与预计剩余时间 (s) */
function useSpeedEta(bytesRead: number, totalBytes: number, isPaused: boolean) {
  const startRef = useRef<number>(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  return useMemo(() => {
    const elapsedMs = Date.now() - startRef.current;
    const elapsedS = Math.max(0.001, elapsedMs / 1000);
    const speed = elapsedS > 0 ? bytesRead / elapsedS : 0;
    const remaining = speed > 0 && totalBytes > bytesRead ? (totalBytes - bytesRead) / speed : 0;
    return { speed, remaining };
  }, [bytesRead, totalBytes, tick]);
}

/** 悬浮计算进度面板：计算中时居中显示，含当前文件、动画进度条、速度/ETA 与暂停/取消控制 */
export function FloatingProgress() {
  const { t } = useTranslation();
  const progress = useAppStore((s) => s.progress);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const isPaused = useAppStore((s) => s.isPaused);
  const currentFile = useAppStore((s) => s.currentFile);
  const bytesRead = useAppStore((s) => s.bytesRead);
  const totalBytes = useAppStore((s) => s.totalBytes);
  const batchProgress = useAppStore((s) => s.batchProgress);
  const setPaused = useAppStore((s) => s.setPaused);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setProgress = useAppStore((s) => s.setProgress);
  const setResultText = useAppStore((s) => s.setResultText);
  const setBatchProgress = useAppStore((s) => s.setBatchProgress);

  const { speed, remaining } = useSpeedEta(bytesRead, totalBytes, isPaused);

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
    setBatchProgress(null);
    setResultText((prev) => prev + `\n${t("batch_cancelled")}\n`);
  }, [isCalculating, setCalculating, setPaused, setProgress, setBatchProgress, setResultText, t]);

  if (!isCalculating) return null;

  const clampedProgress = Math.min(100, Math.max(0, progress));
  const batchText =
    batchProgress && batchProgress.total > 1
      ? `${batchProgress.done}/${batchProgress.total}`
      : null;

  return (
    <div className="fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card/92 p-5 shadow-2xl backdrop-blur-md">
      {/* 标题行：状态 + 百分比 + 文件计数 */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "relative flex h-2.5 w-2.5",
              isPaused && "opacity-60",
            )}
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-semibold text-foreground">
            {isPaused ? t("paused") : t("calculating")}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {batchText && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {batchText}
            </span>
          )}
          <span className="text-lg font-bold tabular-nums text-primary">
            {clampedProgress}%
          </span>
        </div>
      </div>

      {/* 文件名 + 字节进度 */}
      <div className="mb-2 space-y-1">
        <Tooltip label={currentFile || ""}>
          <div className="truncate text-sm font-medium text-foreground">
            {currentFile ? getBasename(currentFile) : t("preparing")}
          </div>
        </Tooltip>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {totalBytes > 0
              ? `${formatBytes(bytesRead)} / ${formatBytes(totalBytes)}`
              : `${formatBytes(bytesRead)}`}
          </span>
          {speed > 0 && (
            <span className="tabular-nums">
              {formatBytes(speed)}/s · {t("remaining")} {formatDuration(remaining)}
            </span>
          )}
        </div>
      </div>

      {/* 进度条（带光泽扫光动画） */}
      <div className="relative mb-4 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
        {clampedProgress > 0 && clampedProgress < 100 && !isPaused && (
          <div className="absolute inset-0 animate-progress-shine bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        )}
      </div>

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
