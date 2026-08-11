import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Copy, FileDown, Trash2, Check, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";
import type { FileItemStatus } from "@/services/types";

/** 过滤器类型 */
type FilterType = "all" | "success" | "mismatch" | "error" | "computed";

/** 计算结果区域组件：结构化表格替代纯文本 */
export function ResultSection() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const copyResult = useAppStore((s) => s.copyResult);
  const clearResults = useAppStore((s) => s.clearResults);
  const addToast = useToastStore((s) => s.addToast);

  const [filter, setFilter] = useState<FilterType>("all");

  /** 从路径提取文件名 */
  const getBasename = (path: string) => {
    return path.split(/[/\\]/).pop() ?? path;
  };

  /** 统计各状态数量 */
  const stats = useMemo(() => {
    let success = 0, mismatch = 0, error = 0, computed = 0;
    for (const f of fileList) {
      switch (f.status) {
        case "success": success++; break;
        case "mismatch": mismatch++; break;
        case "error": error++; break;
        case "computed": computed++; break;
      }
    }
    return { total: fileList.length, success, mismatch, error, computed };
  }, [fileList]);

  /** 过滤后的文件列表 */
  const filteredList = useMemo(() => {
    if (filter === "all") return fileList;
    return fileList.filter((f) => f.status === filter);
  }, [fileList, filter]);

  /** 复制结果到剪贴板 */
  const handleCopyResult = useCallback(async () => {
    const ok = await copyResult();
    if (ok) {
      addToast("success", t("copied_to_clipboard"));
    } else {
      addToast("error", t("clipboard_error"));
    }
  }, [copyResult, addToast, t]);

  /** 复制单行哈希值 */
  const handleCopyHash = useCallback(async (hashValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await writeText(hashValue);
      addToast("success", t("copied_to_clipboard"));
    } catch {
      addToast("error", t("clipboard_error"));
    }
  }, [addToast, t]);

  /** 导出结果 */
  const handleExport = useCallback(() => {
    window.dispatchEvent(new CustomEvent("export-results"));
  }, []);

  /** 清空计算结果（保留文件列表与预期哈希值） */
  const handleClearResults = useCallback(() => {
    clearResults();
    setFilter("all");
  }, [clearResults]);

  /** 获取状态图标与颜色 */
  const getStatusDisplay = (status?: FileItemStatus) => {
    switch (status) {
      case "success":
        return { icon: <CheckCircle2 className="h-4 w-4 text-primary" />, label: t("match"), color: "text-primary" };
      case "mismatch":
        return { icon: <X className="h-4 w-4 text-destructive" />, label: t("mismatch"), color: "text-destructive" };
      case "error":
        return { icon: <AlertTriangle className="h-4 w-4 text-warning" />, label: t("error"), color: "text-warning" };
      case "computed":
        return { icon: <Check className="h-4 w-4 text-muted-foreground" />, label: t("computed"), color: "text-muted-foreground" };
      default:
        return { icon: null, label: "-", color: "text-muted-foreground" };
    }
  };

  /** 过滤按钮配置 */
  const filterButtons: { value: FilterType; label: string; count: number }[] = [
    { value: "all", label: t("filter_all"), count: stats.total },
    { value: "success", label: t("filter_matched"), count: stats.success },
    { value: "mismatch", label: t("filter_mismatched"), count: stats.mismatch },
    { value: "error", label: t("filter_errors"), count: stats.error },
    { value: "computed", label: t("filter_computed"), count: stats.computed },
  ];

  /** 是否有可显示的结果 */
  const hasResults = fileList.some((f) => f.hashValue || f.status);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      {/* 二级标题 */}
      <h2 className="shrink-0 text-lg font-semibold text-foreground">
        {t("result_group")}
      </h2>

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-card p-3">
        {/* 无结果时的空状态 */}
        {!hasResults ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("no_results_yet")}
          </div>
        ) : (
          <>
            {/* 过滤器 + 摘要 */}
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
              {filterButtons.map((btn) => (
                <button
                  key={btn.value}
                  className={cn(
                    "rounded-[var(--radius)] px-2 py-1 text-xs transition-colors",
                    filter === btn.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  onClick={() => setFilter(btn.value)}
                >
                  {btn.label} ({btn.count})
                </button>
              ))}
            </div>

            {/* 结果表格 */}
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("path")}</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("status")}</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("algorithm")}</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hash</th>
                    <th className="w-8 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredList.map((file, index) => {
                    const statusDisplay = getStatusDisplay(file.status);
                    return (
                      <tr
                        key={`${file.path}-${index}`}
                        className="hover:bg-muted/30"
                      >
                        {/* 文件名 */}
                        <td
                          className="max-w-[200px] truncate px-3 py-1.5"
                          title={file.path}
                        >
                          {getBasename(file.path)}
                        </td>

                        {/* 状态 */}
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-1">
                            {statusDisplay.icon}
                            <span className={cn("text-xs", statusDisplay.color)}>
                              {statusDisplay.label}
                            </span>
                          </span>
                        </td>

                        {/* 算法 */}
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {file.status ? file.hashValue ? `${(file.hashValue.length === 32 ? "MD5" : file.hashValue.length === 40 ? "SHA1" : file.hashValue.length === 64 ? "SHA256" : file.hashValue.length === 128 ? "SHA512" : "?")}` : "-" : "-"}
                        </td>

                        {/* 哈希值 */}
                        <td className="max-w-[200px] truncate px-3 py-1.5 text-xs text-muted-foreground" title={file.hashValue ?? ""}>
                          {file.hashValue ? `${file.hashValue.slice(0, 16)}...${file.hashValue.slice(-8)}` : "-"}
                        </td>

                        {/* 复制按钮 */}
                        <td className="px-3 py-1.5">
                          {file.hashValue && (
                            <button
                              className="rounded p-1 text-muted-foreground hover:text-primary"
                              onClick={(e) => handleCopyHash(file.hashValue!, e)}
                              title={t("menu_copy")}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        )}

        {/* 浮动操作按钮：复制/导出/清空结果，悬浮在结果区右下偏左；空态时仍可见（半透明灰显） */}
        <div className="pointer-events-none absolute bottom-4 right-20 z-10">
          <div className="pointer-events-auto flex flex-col items-center gap-3">
            <IconActionButton
              icon={<Copy className="h-6 w-6" />}
              label={t("copy_result")}
              onClick={handleCopyResult}
              disabled={!hasResults}
              theme="blue"
            />
            <IconActionButton
              icon={<FileDown className="h-6 w-6" />}
              label={t("export")}
              onClick={handleExport}
              disabled={!hasResults}
              theme="emerald"
            />
            <IconActionButton
              icon={<Trash2 className="h-6 w-6" />}
              label={t("clear_results")}
              onClick={handleClearResults}
              disabled={!hasResults}
              theme="destructive"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** 大圆形图标操作按钮：与「开始校验」按钮保持一致的视觉语言 */
function IconActionButton({
  icon,
  label,
  onClick,
  disabled,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  theme: "blue" | "emerald" | "destructive";
}) {
  const themeClasses = {
    blue: "bg-blue-500 shadow-blue-500/30 hover:bg-blue-400",
    emerald: "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400",
    destructive: "bg-destructive shadow-destructive/30 hover:bg-destructive/90",
  };

  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all",
          "hover:scale-105 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100",
          themeClasses[theme],
        )}
      >
        {icon}
      </button>
      <span
        className={cn(
          "pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 shadow-md",
          "transition-all duration-200",
          "group-hover:opacity-100",
        )}
      >
        {label}
      </span>
    </div>
  );
}
