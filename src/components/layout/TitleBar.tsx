import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  Minus,
  Square,
  Maximize2,
  X,
  FilePlus,
  FolderOpen,
  FileDown,
  FileCheck2,
  Copy,
  History,
  Trash2,
  BookOpen,
  LogOut,
  PanelLeftClose,
  PanelRightOpen,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { openFileDialog, openFolderDialog, scanDirectory } from "@/services/api";
import { cn } from "@/lib/utils";

/** 自绘顶栏：横跨整个窗口顶部，与左侧 NavRail 同色一体
 *
 * 左侧：☰ 菜单 → 折叠按钮
 * 中间：窗口拖拽区
 * 右侧：最小化 / 最大化 / 关闭
 *
 * 无 border-b，与 NavRail 共享 bg-sidebar 形成浅黑 L 形区。
 */
interface TitleBarProps {
  /** 侧栏是否折叠（控制折叠按钮图标） */
  collapsed: boolean;
  /** 切换折叠 */
  onToggleCollapsed: () => void;
}

export function TitleBar({ collapsed, onToggleCollapsed }: TitleBarProps) {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const addFiles = useAppStore((s) => s.addFiles);
  const copyResult = useAppStore((s) => s.copyResult);
  const addToast = useToastStore((s) => s.addToast);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);

  /* 最大化状态跟踪：getCurrentWindow 在 effect 内局部获取，避免渲染期依赖 Tauri 注入时序 */
  useEffect(() => {
    let mounted = true;
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then((v) => {
      if (mounted) setMaximized(v);
    });
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then((v) => {
        if (mounted) setMaximized(v);
      });
    });
    return () => {
      mounted = false;
      unlisten.then((fn) => fn());
    };
  }, []);

  /* 外部点击 / Esc 关闭菜单 */
  useEffect(() => {
    if (!showMenu) return;
    const handleDocClick = (e: MouseEvent) => {
      if (
        menuWrapperRef.current &&
        !menuWrapperRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenu(false);
    };
    document.addEventListener("mousedown", handleDocClick);
    window.addEventListener("keydown", handleEsc);
    // 菜单打开后聚焦面板，使 Tab/失去焦点时能够自动关闭
    requestAnimationFrame(() => menuPanelRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [showMenu]);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  /** 执行菜单项动作并关闭菜单 */
  const runAction = async (action: () => unknown) => {
    setShowMenu(false);
    try {
      await action();
    } catch {
      /* 忽略 */
    }
  };

  /* 菜单动作 */
  const openFile = async () => {
    const files = await openFileDialog();
    if (files && files.length > 0) addFiles(files);
  };
  const openFolder = async () => {
    const folder = await openFolderDialog();
    if (!folder) return;
    const files = await scanDirectory(folder);
    if (files.length > 0) addFiles(files);
  };
  const copyHash = async () => {
    const ok = await copyResult();
    if (ok) addToast("success", t("copied_to_clipboard"));
    else addToast("error", t("clipboard_error"));
  };

  /* 菜单分组定义 */
  const menuGroups: {
    title?: string;
    items: {
      id: string;
      label: string;
      icon: React.ReactNode;
      shortcut?: string;
      onClick: () => unknown;
    }[];
  }[] = [
    {
      title: t("menu_file"),
      items: [
        { id: "open_file", label: t("menu_open"), icon: <FilePlus size={14} />, shortcut: "Ctrl+O", onClick: openFile },
        { id: "batch_process", label: t("menu_batch"), icon: <FolderOpen size={14} />, shortcut: "Ctrl+B", onClick: openFolder },
        { id: "import_verify", label: t("menu_import_verify"), icon: <FileCheck2 size={14} />, onClick: () => window.dispatchEvent(new CustomEvent("import-verification")) },
      ],
    },
    {
      title: t("menu_edit"),
      items: [
        { id: "copy_hash", label: t("menu_copy"), icon: <Copy size={14} />, onClick: copyHash },
        { id: "export_results", label: t("menu_export"), icon: <FileDown size={14} />, onClick: () => window.dispatchEvent(new CustomEvent("export-results")) },
        { id: "clear_history", label: t("menu_clear_history"), icon: <Trash2 size={14} />, onClick: () => window.dispatchEvent(new CustomEvent("clear-history")) },
      ],
    },
    {
      title: t("menu_appearance"),
      items: [
        { id: "toggle_theme", label: theme === "light" ? t("dark_mode") : t("light_mode"), icon: theme === "light" ? <Moon size={14} /> : <Sun size={14} />, onClick: toggleTheme },
        { id: "toggle_language", label: t("language"), icon: <Globe size={14} />, onClick: toggleLanguage },
      ],
    },
    {
      items: [
        { id: "guide", label: t("menu_guide"), icon: <BookOpen size={14} />, onClick: () => window.dispatchEvent(new CustomEvent("show-quick-guide")) },
        { id: "quit", label: t("menu_exit"), icon: <LogOut size={14} />, shortcut: "Ctrl+Q", onClick: () => getCurrentWindow().close() },
      ],
    },
  ];

  return (
    <div
      data-testid="title-bar"
      className="titlebar-no-press flex h-[40px] w-full shrink-0 select-none items-center bg-sidebar text-foreground"
    >
      {/* 左侧：菜单按钮 + 折叠按钮 */}
      <div className="flex h-full items-center" data-tauri-drag-region="false">
        <div className="relative h-full" ref={menuWrapperRef}>
          <button
            type="button"
            title={t("menu_file")}
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
          >
            <Menu size={18} />
          </button>
          {showMenu && (
            <div
              ref={menuPanelRef}
              tabIndex={-1}
              data-tauri-drag-region="false"
              className="menu-panel absolute left-2 top-full z-50 mt-1 min-w-[220px] rounded-[var(--radius)] border border-border bg-card p-1 shadow-lg outline-none"
              onBlur={(e) => {
                if (!menuWrapperRef.current?.contains(e.relatedTarget as Node)) {
                  setShowMenu(false);
                }
              }}
            >
              {menuGroups.map((group, gi) => (
                <div key={gi}>
                  {group.title && (
                    <div className="mt-1 border-t border-border px-3 pb-0.5 pt-1.5 text-[12px] text-muted-foreground first:mt-0 first:border-0 first:pt-0.5">
                      {group.title}
                    </div>
                  )}
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void runAction(item.onClick)}
                      className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-left text-[14px] text-muted-foreground transition-colors hover:text-primary"
                    >
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="ml-6 text-xs text-muted-foreground/70">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 折叠侧栏按钮：在 ☰ 菜单右侧 */}
        <button
          type="button"
          title={collapsed ? t("expand_sidebar") : t("collapse_sidebar")}
          onClick={onToggleCollapsed}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          {collapsed ? <PanelRightOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

      </div>

      {/* 中间：窗口拖拽区 */}
      <div className="h-full flex-1" data-tauri-drag-region />

      {/* 右侧：历史 / 主题 / 语言（仅图标） + 窗口控制 */}
      <div
        className="flex h-full items-center"
        data-tauri-drag-region="false"
      >
        <button
          type="button"
          title={t("history")}
          onClick={() => window.dispatchEvent(new CustomEvent("show-history"))}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          <History size={16} />
        </button>

        {/* 主题切换 */}
        <button
          type="button"
          title={theme === "light" ? t("dark_mode") : t("light_mode")}
          onClick={toggleTheme}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* 语言切换 */}
        <button
          type="button"
          title={t("language")}
          onClick={toggleLanguage}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          <Globe size={16} />
        </button>

        {/* 窗口控制 */}
        <div className="ml-1 flex h-full items-center">
        <button
          type="button"
          title={t("minimize")}
          onClick={handleMinimize}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          title={maximized ? t("restore") : t("maximize")}
          onClick={handleToggleMaximize}
          className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/20"
        >
          {maximized ? <Maximize2 size={14} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          title={t("close")}
          onClick={handleClose}
          className={cn(
            "close-btn flex h-full w-10 items-center justify-center transition-colors",
          )}
        >
          <X size={16} />
        </button>
        </div>
      </div>
    </div>
  );
}
