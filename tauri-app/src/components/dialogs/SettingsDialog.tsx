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
import { openUrl } from "@tauri-apps/plugin-opener";
import { Settings, Sun, Moon, Hash, Info, ExternalLink } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 支持的算法列表 */
const ALGORITHMS = [
  { name: "SHA-256", desc: { zh: "安全哈希算法 256 位，最常用的哈希算法", en: "Secure Hash Algorithm 256-bit, most commonly used" } },
  { name: "MD5", desc: { zh: "消息摘要算法 5，速度快但已不推荐用于安全场景", en: "Message Digest Algorithm 5, fast but not recommended for security" } },
  { name: "SHA-1", desc: { zh: "安全哈希算法 1，已被发现碰撞漏洞", en: "Secure Hash Algorithm 1, collision vulnerabilities found" } },
  { name: "SHA-512", desc: { zh: "安全哈希算法 512 位，提供更高安全性", en: "Secure Hash Algorithm 512-bit, provides higher security" } },
] as const;

/** 设置对话框 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  const currentLang = i18n.language as "zh" | "en";

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
      <DialogContent className="max-w-[500px] max-h-[400px] flex flex-col">
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
          </section>

          {/* 支持的算法 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Hash className="h-4 w-4" />
              {t("supported_algorithms")}
            </h3>
            <div className="space-y-1.5">
              {ALGORITHMS.map((algo) => (
                <div
                  key={algo.name}
                  className="flex items-start gap-2 rounded-[var(--radius)] border border-border px-4 py-2"
                >
                  <span className="text-sm font-medium shrink-0">
                    {algo.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {algo.desc[currentLang]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 关于 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Info className="h-4 w-4" />
              {t("about_title")}
            </h3>
            <div className="rounded-[var(--radius)] border border-border px-4 py-3 space-y-2">
              <p className="text-sm font-medium">HashValidatorPlus v0.3.0</p>
              <div className="flex items-center gap-4">
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() =>
                    handleOpenLink("https://space.bilibili.com/67221461")
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("bilibili_prompt")}
                </button>
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
