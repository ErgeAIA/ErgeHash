import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { openFileDialog, openFolderDialog, scanDirectory } from "@/services/api";
import { cn } from "@/lib/utils";

/** 菜单项定义 */
interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  separator?: false;
}

interface MenuSeparator {
  separator: true;
  id?: undefined;
  label?: undefined;
  shortcut?: undefined;
}

type MenuEntry = MenuItem | MenuSeparator;

/** 菜单组定义 */
interface MenuGroup {
  label: string;
  items: MenuEntry[];
}

/** 菜单栏组件 - 匹配原版 QMenuBar */
export function MenuBar() {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const addFiles = useAppStore((s) => s.addFiles);
  const copyResult = useAppStore((s) => s.copyResult);

  // 菜单组定义
  const menuGroups: MenuGroup[] = [
    {
      label: t("menu_file"),
      items: [
        { id: "open_file", label: t("menu_open_file"), shortcut: "Ctrl+O" },
        { id: "batch_process", label: t("menu_batch_process"), shortcut: "Ctrl+B" },
        { separator: true },
        { id: "export_results", label: t("menu_export_results") },
        { separator: true },
        { id: "quit", label: t("menu_quit"), shortcut: "Ctrl+Q" },
      ],
    },
    {
      label: t("menu_edit"),
      items: [
        { id: "copy_hash", label: t("menu_copy_hash"), shortcut: "Ctrl+C" },
        { id: "view_history", label: t("menu_view_history") },
      ],
    },
    {
      label: t("menu_tools"),
      items: [
        { id: "clear_history", label: t("menu_clear_history") },
        { separator: true },
        { id: "import_verification", label: t("menu_import_verification") },
      ],
    },
    {
      label: t("menu_guide"),
      items: [],
    },
  ];

  // 处理菜单项点击
  const handleMenuClick = async (itemId: string) => {
    setOpenMenu(null);

    switch (itemId) {
      case "open_file": {
        const files = await openFileDialog();
        if (files && files.length > 0) {
          addFiles(files);
        }
        break;
      }
      case "batch_process": {
        const folder = await openFolderDialog();
        if (folder) {
          // 扫描目录下所有文件加入列表（此前误将文件夹路径当文件加入）
          const files = await scanDirectory(folder);
          if (files.length > 0) {
            addFiles(files);
          }
        }
        break;
      }
      case "export_results":
        // 导出结果由 ResultSection 处理
        window.dispatchEvent(new CustomEvent("export-results"));
        break;
      case "quit":
        window.close();
        break;
      case "copy_hash":
        copyResult();
        break;
      case "view_history":
        window.dispatchEvent(new CustomEvent("show-history"));
        break;
      case "clear_history":
        window.dispatchEvent(new CustomEvent("clear-history"));
        break;
      case "import_verification":
        window.dispatchEvent(new CustomEvent("import-verification"));
        break;
      case "guide":
        window.dispatchEvent(new CustomEvent("show-quick-guide"));
        break;
    }
  };

  return (
    <div
      className="flex items-center border-b px-1 text-sm"
      style={{
        background: "var(--sidebar-bg)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      {menuGroups.map((group) => (
        <div key={group.label} className="relative">
          <button
            className={cn(
              "rounded px-3 py-1 hover:opacity-80",
              openMenu === group.label && "opacity-80",
            )}
            onClick={() =>
              setOpenMenu(openMenu === group.label ? null : group.label)
            }
            onMouseEnter={() => openMenu && setOpenMenu(group.label)}
          >
            {group.label}
          </button>

          {/* 下拉菜单 */}
          {openMenu === group.label && (
            <>
              {/* 透明遮罩，点击关闭菜单 */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpenMenu(null)}
              />
              <div
                className="absolute left-0 top-full z-50 min-w-[200px] rounded border py-1 shadow-lg"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                {group.items.length === 0 ? (
                  /* 快速指南是顶级菜单项，点击直接触发 */
                  <button
                    className="flex w-full items-center px-4 py-1.5 text-left hover:opacity-80"
                    onClick={() => handleMenuClick("guide")}
                  >
                    {t("menu_guide")}
                  </button>
                ) : (
                  group.items.map((item, idx) => {
                    if (item.separator) {
                      return (
                        <div
                          key={`sep-${idx}`}
                          className="my-1 h-px"
                          style={{ background: "var(--border)" }}
                        />
                      );
                    }
                    return (
                      <button
                        key={item.id}
                        className="flex w-full items-center justify-between px-4 py-1.5 text-left hover:opacity-80"
                        onClick={() => handleMenuClick(item.id!)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span
                            className="ml-6 text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
