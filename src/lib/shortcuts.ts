/**
 * 全局快捷键体系（单一数据源）
 *
 * 设计目标：
 * 1. 命令的「显示文案」与「实际绑定」来自同一张表，杜绝菜单提示与实际触发不一致
 *    （此前 batch_process 显示 Ctrl+B，而 Ctrl+B 实际触发折叠侧栏，即为该问题）。
 * 2. 修饰键组合避开系统与浏览器高危默认键：
 *    - 禁用：Ctrl+R(刷新)/Ctrl+L(地址栏)/Ctrl+T(新标签)/Ctrl+N/W/P/S/F5/F11/F12。
 *    - 谨慎：Ctrl+H(浏览器历史)、Ctrl+Shift+Delete(清除数据) 经 preventDefault 兜底，
 *      但本项目改为更安全的 Ctrl+Alt+H / Ctrl+Shift+Backspace 规避。
 * 3. 预留扩展结构：新增功能只需在 SHORTCUT_BINDINGS 增加一项并登记 actionMap。
 */

/** 快捷键组合（修饰键 + 主键）。主键用小写字母或 KeyEvent.key 原值（如 enter/f1/delete/backspace/,）。 */
export interface ShortcutCombo {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** 主键：字母用小写；功能键用 key 原值（enter/f1/delete/backspace 等）；逗号用 "," */
  key: string;
}

/** 命令标识（与菜单项 id 及 actionMap 一一对应） */
export type CommandId =
  | "open_file"
  | "batch_process"
  | "import_verify"
  | "copy_hash"
  | "export_results"
  | "show_history"
  | "clear_history"
  | "toggle_theme"
  | "toggle_language"
  | "guide"
  | "quit"
  | "toggle_sidebar"
  | "show_settings"
  | "start_verify"
  | "clear_list";

/** 全部快捷键绑定（单一数据源） */
export const SHORTCUT_BINDINGS: Record<CommandId, ShortcutCombo> = {
  open_file: { ctrl: true, key: "o" },
  batch_process: { ctrl: true, shift: true, key: "o" },
  import_verify: { ctrl: true, key: "i" },
  copy_hash: { ctrl: true, alt: true, key: "c" },
  export_results: { ctrl: true, key: "e" },
  show_history: { ctrl: true, key: "h" },
  clear_history: { ctrl: true, alt: true, key: "h" },
  toggle_theme: { ctrl: true, alt: true, key: "t" },
  toggle_language: { ctrl: true, alt: true, key: "l" },
  guide: { ctrl: true, key: "/" },
  quit: { ctrl: true, key: "q" },
  toggle_sidebar: { ctrl: true, key: "b" },
  show_settings: { ctrl: true, key: "," },
  start_verify: { ctrl: true, key: "enter" },
  clear_list: { ctrl: true, shift: true, key: "backspace" },
};

/** 是否 macOS（用于显示 ⌘ 而非 Ctrl） */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

/** 将 ShortcutCombo 格式化为用户可见文案（如 "Ctrl+Shift+O"） */
export function formatShortcut(combo: ShortcutCombo): string {
  const isMacPlatform = isMac();
  const parts: string[] = [];
  if (combo.ctrl) parts.push(isMacPlatform ? "⌘" : "Ctrl");
  if (combo.alt) parts.push(isMacPlatform ? "⌥" : "Alt");
  if (combo.shift) parts.push(isMacPlatform ? "⇧" : "Shift");
  parts.push(formatKey(combo.key, isMacPlatform));
  return parts.join("+");
}

/** 主键显示名（大小写与符号处理） */
function formatKey(key: string, isMacPlatform: boolean): string {
  const lower = key.toLowerCase();
  switch (lower) {
    case "enter":
      return isMacPlatform ? "↵" : "Enter";
    case "backspace":
      return isMacPlatform ? "⌫" : "Backspace";
    case "delete":
      return "Del";
    case "f1":
      return "F1";
    case ",":
      return ",";
    default:
      // 单字母统一大写，其余保留原样
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** 判断键盘事件是否匹配某组合（metaKey 在 mac 上等价于 ctrl 修饰） */
export function matchShortcut(e: KeyboardEvent, combo: ShortcutCombo): boolean {
  const ctrlOk = combo.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
  const altOk = combo.alt ? e.altKey : !e.altKey;
  const shiftOk = combo.shift ? e.shiftKey : !e.shiftKey;
  if (!ctrlOk || !altOk || !shiftOk) return false;
  const pressed = e.key.toLowerCase();
  const target = combo.key.toLowerCase();
  return pressed === target;
}
