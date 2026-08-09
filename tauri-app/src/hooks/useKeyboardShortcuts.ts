import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { openFileDialog, openFolderDialog, scanDirectory } from "@/services/api";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** 全局快捷键 hook - 匹配原版快捷键绑定 */
export function useKeyboardShortcuts() {
  const addFiles = useAppStore((s) => s.addFiles);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+O: 打开文件
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        openFileDialog().then((files) => {
          if (files && files.length > 0) {
            addFiles(files);
          }
        });
      }

      // Ctrl+B: 批量处理（打开文件夹，扫描文件加入列表）
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        void (async () => {
          const folder = await openFolderDialog();
          if (!folder) return;
          const files = await scanDirectory(folder);
          if (files.length > 0) {
            addFiles(files);
          }
        })();
      }

      // Ctrl+Q: 退出（走 close-requested，确保窗口几何保存）
      if (e.ctrlKey && e.key === "q") {
        e.preventDefault();
        void getCurrentWindow().close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addFiles]);
}
