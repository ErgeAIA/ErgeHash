import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  上下文：管理打开/关闭状态                                           */
/* ------------------------------------------------------------------ */

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
});

/* ------------------------------------------------------------------ */
/*  Dialog（根组件）                                                    */
/* ------------------------------------------------------------------ */

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/** 对话框根组件，管理打开/关闭状态 */
function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const handleOpenChange = React.useCallback((next: boolean) => {
    setInternalOpen(next);
    onOpenChangeRef.current?.(next);
  }, []);

  const ctx = React.useMemo(
    () => ({ open, onOpenChange: handleOpenChange }),
    [open, handleOpenChange],
  );

  return (
    <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  DialogTrigger                                                       */
/* ------------------------------------------------------------------ */

interface DialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

/** 触发对话框打开的按钮 */
function DialogTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: DialogTriggerProps) {
  const { onOpenChange } = React.useContext(DialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DialogContent（含遮罩层 + 面板）                                     */
/* ------------------------------------------------------------------ */

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否在点击遮罩层时关闭，默认 true */
  onBackdropClick?: () => void;
}

/** 对话框内容区域，包含遮罩层和面板 */
function DialogContent({
  className,
  children,
  onBackdropClick,
  ...props
}: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const panelRef = React.useRef<HTMLDivElement>(null);

  /* Escape 关闭 */
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  /* 打开时禁止 body 滚动 */
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  /* 遮罩层点击 */
  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onBackdropClick?.();
        onOpenChange(false);
      }
    },
    [onOpenChange, onBackdropClick],
  );

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "animate-in fade-in duration-200",
      )}
      onClick={handleBackdropClick}
    >
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />

      {/* 面板 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-50 w-full max-w-lg rounded-lg border border-border bg-card text-card-foreground shadow-lg",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        {/* 右上角关闭按钮 */}
        <button
          className="absolute right-3 top-3 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  DialogHeader                                                        */
/* ------------------------------------------------------------------ */

/** 对话框头部区域 */
function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 px-6 py-4 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  DialogTitle                                                         */
/* ------------------------------------------------------------------ */

/** 对话框标题 */
function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  DialogDescription                                                   */
/* ------------------------------------------------------------------ */

/** 对话框描述文字 */
function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  DialogFooter                                                        */
/* ------------------------------------------------------------------ */

/** 对话框底部按钮区域 */
function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  DialogClose                                                         */
/* ------------------------------------------------------------------ */

interface DialogCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/** 关闭对话框按钮 */
function DialogClose({ onClick, ...props }: DialogCloseProps) {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <button
      onClick={(e) => {
        onOpenChange(false);
        onClick?.(e);
      }}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
