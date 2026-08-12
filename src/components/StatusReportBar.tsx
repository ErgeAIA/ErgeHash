import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { detectHashAlgorithms, ALGO_DISPLAY_NAME } from "@/lib/hash";
import { buildFileGroups } from "@/lib/fileGroups";
import type { FileItemStatus } from "@/services/types";

interface StatusChip {
  key: Exclude<FileItemStatus, "success"> | "success";
  label: string;
  count: number;
  className: string;
}

export function StatusReportBar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const expectedHash = useAppStore((s) => s.expectedHash);

  const detectedAlgos = useMemo(
    () => detectHashAlgorithms(expectedHash),
    [expectedHash],
  );

  const statusChips = useMemo(() => {
    let match = 0;
    let mismatch = 0;
    let error = 0;
    let unverified = 0;

    for (const file of fileList) {
      const status = file.status;
      if (status === "success") match++;
      else if (status === "mismatch") mismatch++;
      else if (status === "error") error++;
      else unverified++;
    }

    return [
      { key: "success" as const, label: t("match"), count: match, className: "text-primary" },
      { key: "mismatch" as const, label: t("mismatch"), count: mismatch, className: "text-destructive" },
      { key: "error" as const, label: t("error"), count: error, className: "text-warning" },
      { key: "computed" as const, label: t("unverified"), count: unverified, className: "text-muted-foreground" },
    ] as StatusChip[];
  }, [fileList, t]);

  const fileGroups = useMemo(() => buildFileGroups(fileList), [fileList]);
  const { duplicateGroupCount, uniqueCount, verifiedCount } = fileGroups.summary;

  const hasStatusChips = statusChips.some((s) => s.count > 0);
  const hasComparison = verifiedCount > 0;
  const hasContent = detectedAlgos.length > 0 || hasComparison || hasStatusChips;

  const comparisonTitle = useMemo(() => {
    const parts: string[] = [];
    if (duplicateGroupCount > 0) {
      parts.push(t("duplicate_hash_files", { count: duplicateGroupCount }));
    }
    if (uniqueCount > 0) {
      parts.push(t("unique_files", { count: uniqueCount }));
    }
    return parts.join(" · ");
  }, [duplicateGroupCount, uniqueCount, t]);

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-4 px-1 text-xs",
        className,
      )}
    >
      {hasContent && (
        <>
          <div className="flex items-center gap-2">
            {detectedAlgos.length > 0 ? (
              <span className="text-muted-foreground">
                {t("auto_detected")}: {" "}
                <span className="font-medium text-primary">
                  {detectedAlgos.map((a) => ALGO_DISPLAY_NAME[a]).join(", ")}
                </span>
              </span>
            ) : null}
            {hasComparison && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-medium text-secondary"
                title={comparisonTitle}
              >
                {comparisonTitle}
              </span>
            )}
          </div>

          {hasStatusChips && (
            <div className="flex items-center gap-3">
              {statusChips.map((s) =>
                s.count > 0 ? (
                  <span
                    key={s.key}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                      s.className,
                    )}
                  >
                    <span className="opacity-80">{s.label}</span>
                    <span>{s.count}</span>
                  </span>
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
