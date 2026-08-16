import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { QuickGuideContent } from "./QuickGuideContent";

interface QuickGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 快速指南对话框 */
export function QuickGuideDialog({ open, onOpenChange }: QuickGuideDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t("menu_guide")}
          </DialogTitle>
        </DialogHeader>

        {/* 指南内容区域（React 组件渲染，跟随主题） */}
        <div className="flex-1 overflow-auto px-6 min-h-0">
          <QuickGuideContent />
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
