import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getHistory, clearHistory as apiClearHistory } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import type { HashAlgorithm, HistoryEntry } from "@/services/types";
import { History, FileText, Trash2 } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 历史记录对话框 */
export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { t } = useTranslation();
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const setSelectedAlgorithms = useAppStore((s) => s.setSelectedAlgorithms);
  const addToast = useToastStore((s) => s.addToast);

  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const [loading, setLoading] = React.useState(false);

  /* 打开时加载历史记录 */
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getHistory(20)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setSelectedIndex(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  /** 使用选中的历史记录项：填充预期哈希值并关闭 */
  const handleUseSelected = React.useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= history.length) return;
    const entry = history[selectedIndex];
    setExpectedHash(entry.hashValue);
    setSelectedAlgorithms([entry.algorithm as HashAlgorithm]);
    onOpenChange(false);
  }, [selectedIndex, history, setExpectedHash, setSelectedAlgorithms, onOpenChange]);

  /** 清空历史记录 */
  const handleClearHistory = React.useCallback(async () => {
    const ok = await ask(t("clear_history_confirm"), { title: t("warning") });
    if (!ok) return;
    try {
      await apiClearHistory();
      setHistory([]);
      setSelectedIndex(-1);
      addToast("success", t("history_cleared"));
    } catch {
      addToast("error", t("clear_history_failed"));
    }
  }, [t, addToast]);

  /** 双击使用历史记录项 */
  const handleDoubleClick = React.useCallback(
    (index: number) => {
      const entry = history[index];
      setExpectedHash(entry.hashValue);
      setSelectedAlgorithms([entry.algorithm as HashAlgorithm]);
      onOpenChange(false);
    },
    [history, setExpectedHash, setSelectedAlgorithms, onOpenChange],
  );

  /** 从路径中提取文件名 */
  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() ?? path;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("history_title")}
          </DialogTitle>
          <DialogDescription>{t("history_double_click")}</DialogDescription>
        </DialogHeader>

        {/* 历史记录列表 */}
        <div className="flex-1 overflow-auto px-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              ...
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {t("history_empty")}
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((entry, index) => (
                <div
                  key={`${entry.filePath}-${entry.timestamp}-${index}`}
                  className={`
                    flex items-start gap-3 rounded-[var(--radius)] px-3 py-2 cursor-pointer transition-colors
                    ${
                      selectedIndex === index
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted"
                    }
                  `}
                  onClick={() => setSelectedIndex(index)}
                  onDoubleClick={() => handleDoubleClick(index)}
                >
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {getFileName(entry.filePath)}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {entry.algorithm.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {entry.hashValue}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {entry.timestamp.slice(0, 19)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearHistory}
            disabled={history.length === 0}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {t("clear_history")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
          <Button
            onClick={handleUseSelected}
            disabled={selectedIndex < 0 || selectedIndex >= history.length}
          >
            {t("use_selected")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
