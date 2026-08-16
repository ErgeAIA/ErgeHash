import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import { BookOpen } from "lucide-react";

interface QuickGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 快速指南对话框 */
export function QuickGuideDialog({ open, onOpenChange }: QuickGuideDialogProps) {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const [htmlContent, setHtmlContent] = React.useState<string>("");
  const [loadError, setLoadError] = React.useState(false);

  /* 打开时加载 quick_start.html */
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(false);

    fetch("/quick_start.html")
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.text();
      })
      .then((html) => {
        if (!cancelled) setHtmlContent(html);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setHtmlContent("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  /** 暗色模式下注入样式覆盖 */
  const processedContent = React.useMemo(() => {
    if (!htmlContent || theme !== "dark") return htmlContent;

    let content = htmlContent;

    /* 注入暗色模式内联样式覆盖 */
    content = content.replace(
      "<body>",
      '<body style="background-color: #1a1a1a; color: #ffffff;">',
    );
    content = content.replace(
      /<h1>/g,
      '<h1 style="color: #4CAF50;">',
    );
    content = content.replace(
      /<h2>/g,
      '<h2 style="color: #81C784;">',
    );
    content = content.replace(
      /<h3>/g,
      '<h3 style="color: #A5D6A7;">',
    );
    content = content.replace(
      /<p>/g,
      '<p style="color: #ffffff;">',
    );
    content = content.replace(
      /<li>/g,
      '<li style="color: #ffffff;">',
    );
    content = content.replace(
      /<a /g,
      '<a style="color: #4CAF50;" ',
    );
    // 注意：不覆盖 table/th/td/pre/code，统一交给 prose-invert 处理，
    // 避免内联样式与原 CSS 冲突导致条纹、白底等显示异常。

    return content;
  }, [htmlContent, theme]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t("menu_guide")}
          </DialogTitle>
        </DialogHeader>

        {/* 指南内容区域 */}
        <div className="flex-1 overflow-auto px-6 min-h-0">
          {loadError ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              quick_start.html not found
            </div>
          ) : htmlContent ? (
            <div
              className={`
                prose prose-sm max-w-none
                ${theme === "dark" ? "prose-invert" : ""}
              `}
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              ...
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
