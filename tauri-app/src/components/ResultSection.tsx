import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Square, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/appStore";
import {
  startBatchValidation,
  pauseHashCalculation,
  resumeHashCalculation,
  cancelHashCalculation,
} from "@/services/api";


/** 计算结果区域组件，对应原始 "计算结果" GroupBox */
export function ResultSection() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const algorithm = useAppStore((s) => s.algorithm);
  const isCalculating = useAppStore((s) => s.isCalculating);
  const isPaused = useAppStore((s) => s.isPaused);
  const resultText = useAppStore((s) => s.resultText);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setPaused = useAppStore((s) => s.setPaused);
  const setResultText = useAppStore((s) => s.setResultText);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const copyResult = useAppStore((s) => s.copyResult);

  /** 开始批量校验 */
  const handleStartBatch = useCallback(async () => {
    if (isCalculating || fileList.length === 0) return;

    const paths = fileList.map((f) => f.path);

    // 重置状态
    setCalculating(true);
    setPaused(false);
    setProgress(0);
    setCurrentFile(null);
    setResultText("");
    setStatusMessage("calculating");

    try {
      // 调用后端批量校验（异步，通过事件回调更新进度）
      await startBatchValidation(paths, algorithm);
    } catch (err) {
      setResultText((prev) => prev + `\n✗ ${String(err)}\n`);
      setCalculating(false);
      setStatusMessage("ready");
    }
  }, [
    isCalculating,
    fileList,
    algorithm,
    setCalculating,
    setPaused,
    setProgress,
    setCurrentFile,
    setResultText,
    setStatusMessage,
  ]);

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
    setStatusMessage("ready");
    setResultText((prev) => prev + `\n${t("batch_cancelled")}\n`);
  }, [isCalculating, setCalculating, setPaused, setStatusMessage, setResultText, t]);

  return (
    <fieldset className="rounded-default border border-border p-3">
      <legend className="px-2 text-sm font-medium text-foreground">
        {t("result_group")}
      </legend>

      <div className="flex flex-col gap-2">
        {/* 结果文本区域 */}
        <Textarea
          value={resultText}
          readOnly
          placeholder={t("result_placeholder")}
          className="min-h-[100px] resize-none"
        />

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 开始批量校验 */}
          <Button
            variant="default"
            size="sm"
            onClick={handleStartBatch}
            disabled={isCalculating || fileList.length === 0}
          >
            <Play className="mr-1 h-4 w-4" />
            {t("start_batch")}
          </Button>

          {/* 暂停/继续 */}
          <Button
            variant="warning"
            size="sm"
            onClick={handleTogglePause}
            disabled={!isCalculating}
          >
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

          {/* 取消 */}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={!isCalculating}
          >
            <Square className="mr-1 h-4 w-4" />
            {t("stop")}
          </Button>

          <div className="flex-1" />

          {/* 复制结果 */}
          <Button
            variant="secondary"
            size="sm"
            onClick={copyResult}
            disabled={!resultText}
          >
            <Copy className="mr-1 h-4 w-4" />
            {t("copy_result")}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
