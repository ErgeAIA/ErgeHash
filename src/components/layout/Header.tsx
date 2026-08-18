import { useTranslation } from "react-i18next";
import { Sun, Moon, Globe } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

/* 头部栏组件 */
function Header() {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);

  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center justify-between border-b border-border px-4",
      )}
    >
      {/* 左侧标题 */}
      <h1 className="text-base font-bold text-foreground">
        {t("app_title")}
      </h1>

      {/* 右侧工具按钮 */}
      <div className="flex items-center gap-1">
        {/* 语言切换按钮 */}
        <button
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-sm transition-colors",
            "hover:bg-muted cursor-pointer",
          )}
          onClick={toggleLanguage}
          aria-label={language === "zh" ? t("switch_to_en") : t("switch_to_zh")}
        >
          <Globe className="h-4 w-4" />
        </button>

        {/* 主题切换按钮 */}
        <button
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-sm transition-colors",
            "hover:bg-muted cursor-pointer",
          )}
          onClick={toggleTheme}
          aria-label={theme === "light" ? t("dark_mode") : t("light_mode")}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}

export { Header };
