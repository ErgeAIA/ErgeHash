import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/appStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Settings, Sun, Moon, Info, ExternalLink } from "lucide-react";
import { APP_VERSION, APP_EMAIL, APP_BILIBILI_URL } from "@/lib/constants";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 设置对话框（含「关于」整合区块） */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const autoCalculate = useAppStore((s) => s.autoCalculate);
  const setAutoCalculate = useAppStore((s) => s.setAutoCalculate);
  const animations = useAppStore((s) => s.animations);
  const setAnimations = useAppStore((s) => s.setAnimations);

  /** 打开外部链接 */
  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      // 忽略打开链接失败
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[520px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("settings_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 space-y-4 min-h-0">
          {/* 外观设置 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Sun className="h-4 w-4" />
              {t("appearance_settings")}
            </h3>
            <div className="flex items-center justify-between rounded-[var(--radius)] border border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span>
                  {t("current_theme")}{" "}
                  {theme === "dark" ? t("dark_mode") : t("light_mode")}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {t("toggle_theme")}
              </Button>
            </div>
            {/* 拖入自动开始 */}
            <div className="mt-2 flex items-center justify-between rounded-[var(--radius)] border border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span>{t("auto_calculate")}</span>
              </div>
              <Switch
                checked={autoCalculate}
                onCheckedChange={setAutoCalculate}
              />
            </div>
            {/* 界面动画开关 */}
            <div className="mt-2 flex items-center justify-between rounded-[var(--radius)] border border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span>{t("enable_animations")}</span>
              </div>
              <Switch
                checked={animations}
                onCheckedChange={setAnimations}
              />
            </div>
          </section>

          {/* 关于（整合区块） */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Info className="h-4 w-4" />
              {t("about_title")}
            </h3>
            <div className="rounded-[var(--radius)] border border-border px-4 py-3 space-y-1.5">
              <p className="text-sm font-medium">
                {t("about_app_name")} v{APP_VERSION}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("about_tagline")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("about_author")}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => handleOpenLink(APP_BILIBILI_URL)}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("bilibili_prompt")}
                </button>
                <a
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  href={`mailto:${APP_EMAIL}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {APP_EMAIL}
                </a>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
