import { useTranslation } from "react-i18next";
import { NotepadText, History, Settings } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { openNotepad } from "@/services/api";
import { RadioGroup, type RadioItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { HashAlgorithm } from "@/services/types";

/* 算法选项列表 */
const ALGORITHM_ITEMS: RadioItem[] = [
  { label: "SHA-256", value: "sha256" },
  { label: "MD5", value: "md5" },
  { label: "SHA-1", value: "sha1" },
  { label: "SHA-512", value: "sha512" },
];

/* 侧边栏组件属性 */
interface SidebarProps {
  onShowHistory?: () => void;
  onShowSettings?: () => void;
}

/* 侧边栏组件 */
function Sidebar({ onShowHistory, onShowSettings }: SidebarProps) {
  const { t } = useTranslation();
  const algorithm = useAppStore((s) => s.algorithm);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);

  /* 算法选择变更处理 */
  const handleAlgorithmChange = (value: string) => {
    setAlgorithm(value as HashAlgorithm);
  };

  /* 打开 bilibili 主页 */
  const handleBilibiliClick = () => {
    window.open("https://space.bilibili.com/67221461", "_blank");
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[200px] shrink-0 flex-col border-r border-border",
      )}
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* 顶部间距 */}
      <div className="h-2.5" />

      {/* 导航按钮区域 */}
      <nav className="flex flex-col gap-0.5 px-2">
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-2.5 text-left text-sm transition-colors",
            "hover:bg-muted cursor-pointer",
          )}
          onClick={() => {
            openNotepad().catch(() => {
              /* 打开失败静默 */
            });
          }}
        >
          <NotepadText className="h-4 w-4" />
          <span>{t("notepad")}</span>
        </button>

        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-2.5 text-left text-sm transition-colors",
            "hover:bg-muted cursor-pointer",
          )}
          onClick={() => {
            onShowHistory?.();
          }}
        >
          <History className="h-4 w-4" />
          <span>{t("history")}</span>
        </button>

        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-2.5 text-left text-sm transition-colors",
            "hover:bg-muted cursor-pointer",
          )}
          onClick={() => {
            onShowSettings?.();
          }}
        >
          <Settings className="h-4 w-4" />
          <span>{t("settings")}</span>
        </button>
      </nav>

      {/* 间距 */}
      <div className="h-2.5" />

      {/* 算法选择区域 */}
      <div className="mx-2 rounded-[var(--radius)] border border-border px-2 py-2">
        <h3 className="mb-1 px-2 text-xs font-semibold text-muted-foreground">
          {t("algorithms")}
        </h3>
        <RadioGroup
          items={ALGORITHM_ITEMS}
          value={algorithm}
          onValueChange={handleAlgorithmChange}
        />
      </div>

      {/* 弹性占位，将底部内容推到最下方 */}
      <div className="flex-1" />

      {/* bilibili 图片和文字 */}
      <div className="flex flex-col items-center px-2 pb-3">
        <img
          src="/bilibili.png"
          alt="bilibili"
          className="w-full max-w-[200px] cursor-pointer rounded-[var(--radius)] transition-opacity hover:opacity-80"
          onClick={handleBilibiliClick}
          draggable={false}
        />
        <span
          className="mt-1 cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleBilibiliClick}
        >
          {t("bilibili_prompt")}
        </span>
      </div>
    </aside>
  );
}

export { Sidebar };
