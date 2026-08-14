import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { detectHashAlgorithms, ALGO_DISPLAY_NAME } from "@/lib/hash";
import { buildFileGroups } from "@/lib/fileGroups";

export function StatusReportBar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const expectedHash = useAppStore((s) => s.expectedHash);

  // 校验文件不参与 HASH 计算，统计与分组均排除
  const sourceFiles = useMemo(
    () => fileList.filter((f) => f.role !== "verification"),
    [fileList],
  );

  const detectedAlgos = useMemo(
    () => detectHashAlgorithms(expectedHash),
    [expectedHash],
  );

  const counts = useMemo(() => {
    let match = 0;
    let mismatch = 0;
    let error = 0;
    let unverified = 0;
    for (const file of sourceFiles) {
      const status = file.status;
      if (status === "success") match++;
      else if (status === "mismatch") mismatch++;
      else if (status === "error") error++;
      else unverified++;
    }
    return { match, mismatch, error, unverified };
  }, [sourceFiles]);

  const fileGroups = useMemo(() => buildFileGroups(sourceFiles), [sourceFiles]);
  const { duplicateGroupCount, uniqueCount } = fileGroups.summary;

  // 有文件或有检测到的算法时才显示；计数始终如实展示（含 0）
  const hasContent = sourceFiles.length > 0 || detectedAlgos.length > 0;

  return (
    <div
      className={cn(
        "flex h-auto min-h-8 shrink-0 flex-col items-start justify-center gap-1 px-1 text-xs",
        className,
      )}
    >
      {hasContent && (
        <>
          {/* 上行：校验结论（状态色，左对齐） */}
          {sourceFiles.length > 0 && (
            <div className="flex items-center gap-3">
              <StatToken label={t("match")} value={counts.match} className="text-primary" />
              <StatToken label={t("mismatch")} value={counts.mismatch} className="text-destructive" />
              <StatToken label={t("error")} value={counts.error} className="text-warning" />
              <StatToken label={t("unverified")} value={counts.unverified} className="text-muted-foreground" />
            </div>
          )}

          {/* 下行：上下文 / 规模信息（中性） */}
          <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
            {detectedAlgos.length > 0 && (
              <span className="flex items-center gap-1">
                <span>{t("auto_detected")}</span>
                <span className="font-medium text-foreground">
                  {detectedAlgos.map((a) => ALGO_DISPLAY_NAME[a]).join(" · ")}
                </span>
              </span>
            )}
            {sourceFiles.length > 0 && (
              <>
                <span>{t("dup_groups", { count: duplicateGroupCount })}</span>
                <span>{t("unique_count", { count: uniqueCount })}</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatToken({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", className)}>
      <span className="opacity-80">{label}</span>
      <span>{value}</span>
    </span>
  );
}
