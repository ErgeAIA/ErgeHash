import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { openFileDialog, openFolderDialog, scanDirectory } from "@/services/api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  SHORTCUT_BINDINGS,
  matchShortcut,
  type CommandId,
  type ShortcutCombo,
} from "@/lib/shortcuts";

/**
 * 全局快捷键 hook：基于 SHORTCUT_BINDINGS 单一数据源统一注册与派发。
 *
 * 执行策略：
 * - 打开文件 / 添加文件夹需直接调文件对话框，在此处理；
 * - 复制结果需 toast 反馈，在此处理；
 * - 其余命令通过 window CustomEvent 解耦，由 App 统一监听（与菜单点击共用路径）；
 *   少数纯 store 动作（主题/语言/折叠/开始校验/清空列表）直接调用 store。
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const addFiles = useAppStore.getState().addFiles;
    const addToast = useToastStore.getState().addToast;

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
      const ok = await useAppStore.getState().copyResult();
      addToast(ok ? "success" : "error", ok ? "copied_to_clipboard" : "clipboard_error");
    };

    /** 命令 → 执行函数 */
    const actionMap: Record<CommandId, () => void> = {
      open_file: () => void openFile(),
      batch_process: () => void openFolder(),
      import_verify: () => window.dispatchEvent(new CustomEvent("import-verification")),
      copy_hash: () => void copyHash(),
      export_results: () => window.dispatchEvent(new CustomEvent("export-results")),
      show_history: () => window.dispatchEvent(new CustomEvent("show-history")),
      clear_history: () => window.dispatchEvent(new CustomEvent("clear-history")),
      toggle_theme: () => useAppStore.getState().toggleTheme(),
      toggle_language: () => useAppStore.getState().toggleLanguage(),
      guide: () => window.dispatchEvent(new CustomEvent("show-quick-guide")),
      quit: () => void getCurrentWindow().close(),
      toggle_sidebar: () => window.dispatchEvent(new CustomEvent("toggle-sidebar")),
      show_settings: () => window.dispatchEvent(new CustomEvent("show-settings")),
      start_verify: () => void useAppStore.getState().startValidation(),
      clear_list: () => useAppStore.getState().clearFiles(),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 输入框/文本域/可编辑元素内不拦截（避免影响正常输入，如预期哈希框）
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const entries = Object.entries(SHORTCUT_BINDINGS) as [CommandId, ShortcutCombo][];
      for (const [id, combo] of entries) {
        if (matchShortcut(e, combo)) {
          e.preventDefault();
          actionMap[id]();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
