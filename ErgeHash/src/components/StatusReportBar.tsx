import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { detectHashAlgorithm, ALGO_DISPLAY_NAME } from "@/lib/hash";
import type { FileItemStatus, FileResult } from "@/services/types";

interface StatusChip {
  key: Exclude<FileItemStatus, "success"> | "success";
  label: string;
  count: number;
  className: string;
}

/** 统计不同文件之间是否存在相同哈希值，返回重复组数 */
function countDuplicateHashGroups(fileList: { path: string; results: FileResult[] }[]): number {
  const groups = new Map<string, Set<string>>();

  for (const file of fileList) {
    for (const r of file.results) {
      if (!r.hashValue || r.status === "error") continue;
      const key = `${r.algorithm}:${r.hashValue.toLowerCase()}`;
      const paths = groups.get(key) ?? new Set<string>();
      paths.add(file.path);
      groups.set(key, paths);
    }
  }

  let duplicates = 0;
  for (const paths of groups.values()) {
    if (paths.size > 1) duplicates++;
  }
  return duplicates;
}

export function StatusReportBar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const expectedHash = useAppStore((s) => s.expectedHash);

  const detectedAlgo = useMemo(
    () => detectHashAlgorithm(expectedHash),
    [expectedHash],
  );

  const summary = useMemo(() => {
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

  const duplicateGroups = useMemo(
    () => countDuplicateHashGroups(fileList),
    [fileList],
  );

  const hasSummary = summary.some((s) => s.count > 0);
  const hasContent = detectedAlgo || hasSummary || duplicateGroups > 0;

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
            {detectedAlgo ? (
              <span className="text-muted-foreground">
                {t("auto_detected")}: {" "}
                <span className="font-medium text-primary">
                  {ALGO_DISPLAY_NAME[detectedAlgo]}
                </span>
              </span>
            ) : null}
            {duplicateGroups > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-secondary"
                title={t("duplicate_hash_files", { count: duplicateGroups })}
              >
                <span className="opacity-80">{t("file_compare")}</span>
                <span>{duplicateGroups}</span>
              </span>
            ) : null}
          </div>

          {hasSummary && (
            <div className="flex items-center gap-3">
              {summary.map((s) =>
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
