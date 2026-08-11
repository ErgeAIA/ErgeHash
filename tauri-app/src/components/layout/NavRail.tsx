import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Hash,
  History,
  BookOpen,
  FileDown,
  NotepadText,
  Sun,
  Moon,
  Globe,
  Settings,
  LogOut,
  ChevronDown,
  Wrench,
  Eye,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "@/store/appStore";
import { openNotepad } from "@/services/api";
import { cn } from "@/lib/utils";
import type { HashAlgorithm } from "@/services/types";

/* 分组展开状态持久化键 */
const LS_GROUPS = "hvp.ui.nav_groups_expanded";

/* 算法选项列表 */
const ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: "sha256", label: "SHA-256" },
  { value: "md5", label: "MD5" },
  { value: "sha1", label: "SHA-1" },
  { value: "sha512", label: "SHA-512" },
];

interface NavRailProps {
  /** 是否折叠为 64px 图标栏 */
  collapsed: boolean;
  /** 切换折叠状态 */
  onToggleCollapsed: () => void;
}

/** 左侧导航栏：LOGO → 算法选择 → 导航项（一级项 + 可折叠分组）→ 底部设置/退出 */
export function NavRail({ collapsed, onToggleCollapsed }: NavRailProps) {
  const { t } = useTranslation();
  const algorithm = useAppStore((s) => s.algorithm);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);

  /* 分组展开状态（localStorage 持久化） */
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_GROUPS);
      return raw ? (JSON.parse(raw) as string[]) : ["tools", "view"];
    } catch {
      return ["tools", "view"];
    }
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = prev.includes(id)
        ? prev.filter((g) => g !== id)
        : [...prev, id];
      localStorage.setItem(LS_GROUPS, JSON.stringify(next));
      return next;
    });
  };

  /* 折叠态点击导航项：先展开侧栏，不立即执行动作（避免误触） */
  const handleItemClick = (fn: () => void) => {
    if (collapsed) {
      onToggleCollapsed();
      return;
    }
    fn();
  };

  /* 分组头点击：折叠态展开侧栏+展开该组；展开态切换分组 */
  const handleGroupClick = (id: string) => {
    if (collapsed) {
      onToggleCollapsed();
      if (!expandedGroups.includes(id)) toggleGroup(id);
      return;
    }
    toggleGroup(id);
  };

  /* 导航项 / 算法项通用样式
   * 选中态：左竖条（border-l 等价实现）+ 品牌色文字 + 品牌 tint 底
   * 未选中：灰文字，hover 只变品牌色文字（不变底色） */
  const navItemClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-[15px] font-medium transition-colors duration-100",
      collapsed && "justify-center px-0",
      active
        ? "relative text-primary bg-primary-alpha before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']"
        : "text-muted-foreground hover:text-primary",
    );

  return (
    <aside
      className="flex w-full flex-1 flex-col overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* 顶部 LOGO（折叠功能移到顶栏，此处仅展示） */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Hash className="h-5 w-5 shrink-0 text-primary" />
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-foreground">
            HashValidatorPlus
          </span>
        )}
      </div>

      {/* 滚动区：算法 + 导航项 */}
      <nav className="scrollbar-none flex-1 overflow-y-auto px-2 pb-2">
        {/* 算法选择组 */}
        <div className="mb-2">
          {collapsed ? (
            <button
              onClick={onToggleCollapsed}
              title={t("algorithms")}
              className="flex h-9 w-full items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:text-primary"
            >
              <Hash className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {t("algorithms")}
              </div>
              <div className="flex flex-col gap-0.5">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo.value}
                    onClick={() => setAlgorithm(algo.value)}
                    className={navItemClass(algorithm === algo.value)}
                  >
                    <Hash className="h-[18px] w-[18px] shrink-0 opacity-70" />
                    <span>{algo.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 一级平级项 */}
        <div className="mb-1 flex flex-col gap-0.5">
          <button
            onClick={() =>
              handleItemClick(() =>
                window.dispatchEvent(new CustomEvent("show-history")),
              )
            }
            title={collapsed ? t("history") : undefined}
            className={navItemClass(false)}
          >
            <History className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{t("history")}</span>}
          </button>
          <button
            onClick={() =>
              handleItemClick(() =>
                window.dispatchEvent(new CustomEvent("show-quick-guide")),
              )
            }
            title={collapsed ? t("quick_guide") : undefined}
            className={navItemClass(false)}
          >
            <BookOpen className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{t("quick_guide")}</span>}
          </button>
        </div>

        {/* 分组：工具 */}
        <NavGroup
          label={t("nav_tools")}
          icon={<Wrench className="h-[18px] w-[18px] shrink-0" />}
          collapsed={collapsed}
          expanded={expandedGroups.includes("tools")}
          onClick={() => handleGroupClick("tools")}
        >
          <NavSubItem
            icon={<FileDown className="h-3.5 w-3.5" />}
            label={t("export")}
            onClick={() =>
              handleItemClick(() =>
                window.dispatchEvent(new CustomEvent("export-results")),
              )
            }
          />
          <NavSubItem
            icon={<NotepadText className="h-3.5 w-3.5" />}
            label={t("notepad")}
            onClick={() => handleItemClick(() => void openNotepad())}
          />
        </NavGroup>

        {/* 分组：视图 */}
        <NavGroup
          label={t("nav_view")}
          icon={<Eye className="h-[18px] w-[18px] shrink-0" />}
          collapsed={collapsed}
          expanded={expandedGroups.includes("view")}
          onClick={() => handleGroupClick("view")}
        >
          <NavSubItem
            icon={
              theme === "light" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )
            }
            label={theme === "light" ? t("dark_mode") : t("light_mode")}
            onClick={() => handleItemClick(toggleTheme)}
          />
          <NavSubItem
            icon={<Globe className="h-3.5 w-3.5" />}
            label={language === "zh" ? "English" : "中文"}
            onClick={() => handleItemClick(toggleLanguage)}
          />
        </NavGroup>
      </nav>

      {/* 底部：设置 + 退出（折叠态竖排 / 展开态同排） */}
      <div className="shrink-0 p-2">
        {collapsed ? (
          <div className="flex flex-col gap-1">
            <button
              onClick={() =>
                handleItemClick(() =>
                  window.dispatchEvent(new CustomEvent("show-settings")),
                )
              }
              title={t("settings")}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:text-primary"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => handleItemClick(() => getCurrentWindow().close())}
              title={t("quit")}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("show-settings"))
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] px-2 py-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </button>
            <button
              onClick={() => getCurrentWindow().close()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] px-2 py-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t("quit")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ===== 内部组件 ===== */

interface NavGroupProps {
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  expanded: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 可折叠分组：分组头（图标 + 名称 + 箭头）+ 子项列表 */
function NavGroup({
  label,
  icon,
  collapsed,
  expanded,
  onClick,
  children,
}: NavGroupProps) {
  return (
    <div className="group mb-1">
      <button
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-[15px] font-medium transition-colors duration-100",
          collapsed && "justify-center px-0",
          expanded
            ? "text-foreground"
            : "text-muted-foreground hover:text-primary",
        )}
      >
        {icon}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{label}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-all duration-100",
                expanded && "rotate-180",
                !expanded && "opacity-0 group-hover:opacity-100",
              )}
            />
          </>
        )}
      </button>
      {!collapsed && (
        <div
          className={cn(
            "nav-group-children overflow-hidden",
            expanded && "nav-group-children--expanded",
          )}
        >
          <div className="relative flex flex-col gap-0.5 py-1">
            {/* 子项对齐线：激活/未激活由 bg-border 统一 */}
            <div className="absolute left-[36px] top-0 h-full w-px bg-border" />
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface NavSubItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

/** 分组子项：缩进 pl-[52px]，图标 14px opacity-70 */
function NavSubItem({ icon, label, onClick }: NavSubItemProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 rounded-[var(--radius)] py-2 pl-[52px] pr-3 text-[15px] text-muted-foreground transition-colors duration-100 hover:text-primary"
    >
      <span className="absolute left-[28px] flex h-3.5 w-3.5 items-center justify-center opacity-70">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
