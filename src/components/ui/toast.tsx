import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type Toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

/** 单条 Toast 视图 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // 图标颜色用内联变量保证在自定义工具类体系下生效
  const color = {
    success: "var(--primary)",
    error: "var(--destructive)",
    info: "var(--secondary)",
    warning: "var(--warning)",
  }[toast.type];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-default border border-border bg-card px-3 py-2 text-sm shadow-lg",
      )}
    >
      {toast.type === "success" && (
        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      {toast.type === "error" && (
        <XCircle className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      {toast.type === "info" && (
        <Info className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      {toast.type === "warning" && (
        <AlertTriangle className="h-4 w-4 shrink-0" style={{ color }} />
      )}
      <span className="flex-1 text-foreground">{toast.message}</span>
      <button
        className="text-muted-foreground opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
        onClick={onClose}
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Toast 宿主：固定右下角渲染所有 toast（3 秒自动消失） */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[320px] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onClose={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}
