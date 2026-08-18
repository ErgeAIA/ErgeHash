import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Hash, FileSearch, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { FileResult, VerificationEntry } from "@/services/types";
import { openFileDialog } from "@/services/api";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";
import { buildFileGroups } from "@/lib/fileGroups";
import { handleDroppedPaths } from "@/lib/dropHandler";
import { Tooltip } from "@/components/ui/Tooltip";
import { FloatingProgress } from "@/components/FloatingProgress";
import { SHORTCUT_BINDINGS, formatShortcut } from "@/lib/shortcuts";
import { translateErrorCode } from "@/lib/errorMessages";

/** 文件拖放列表组件，对应原始 DragDropFileListWidget */
export function FileList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const removeFile = useAppStore((s) => s.removeFile);

  /* 拖拽高亮状态 */
  const [isDragOver, setIsDragOver] = useState(false);

  /* 右键菜单状态 */
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  /* 阻止右键菜单关闭的 ref */
  const menuRef = useRef<HTMLDivElement>(null);

  /* 校验文件折叠状态：被折叠的 verification 文件 path 集合；默认全部折叠 */
  const [collapsedVfs, setCollapsedVfs] = useState<Set<string>>(() =>
    new Set(fileList.filter((f) => f.role === "verification").map((f) => f.path)),
  );

  // 新拖入的校验文件自动加入折叠集合（默认折叠）
  useEffect(() => {
    setCollapsedVfs((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const f of fileList) {
        if (f.role === "verification" && f.entries && f.entries.length > 0 && !next.has(f.path)) {
          next.add(f.path);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fileList]);

  /** 切换校验文件折叠状态 */
  const toggleVf = useCallback((path: string) => {
    setCollapsedVfs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  /* 文件列表滚动状态与滚动提示 */
  const listScrollRef = useRef<HTMLUListElement>(null);
  const [scrollState, setScrollState] = useState<{
    canScrollUp: boolean;
    canScrollDown: boolean;
  }>({ canScrollUp: false, canScrollDown: false });

  /** 计算当前滚动容器的可滚动方向 */
  const updateScrollState = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    const canUp = el.scrollTop > 1;
    const canDown = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
    setScrollState({ canScrollUp: canUp, canScrollDown: canDown });
  }, []);

  /** 平滑滚动到顶部或底部 */
  const scrollToEdge = useCallback(
    (direction: "up" | "down") => {
      const el = listScrollRef.current;
      if (!el) return;
      el.scrollTo({
        top: direction === "up" ? 0 : el.scrollHeight,
        behavior: "smooth",
      });
    },
    [],
  );

  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, fileList.length]);

  /** 右键菜单边界检测：确保不超出窗口可视区域 */
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let x = contextMenu.x;
    let y = contextMenu.y;

    if (x + rect.width + padding > window.innerWidth) {
      x = window.innerWidth - rect.width - padding;
    }
    x = Math.max(padding, x);

    if (y + rect.height + padding > window.innerHeight) {
      y = window.innerHeight - rect.height - padding;
    }
    y = Math.max(padding, y);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    // 菜单打开后自动聚焦，使失去焦点/ESC 时能够自动关闭
    menu.focus();
  }, [contextMenu]);

  /** 处理 Tauri 拖放提供的真实路径：委托给共享 handler（目录展开/分流/导入/哈希统一在此） */
  const handleDropped = useCallback(
    (paths: string[]) => {
      if (!paths || paths.length === 0) return;
      handleDroppedPaths(paths, t);
    },
    [t],
  );

  // 用 ref 持有最新 handler，使拖放监听只注册一次（避免依赖 t 变化时反复解绑/重注册导致监听竞态）
  const handleDroppedRef = useRef(handleDropped);
  useEffect(() => {
    handleDroppedRef.current = handleDropped;
  }, [handleDropped]);

  /* 注册 Tauri 拖放事件：获取真实文件路径（替代已失效的 HTML5 File.path），并驱动拖拽高亮。
     机制（已核实 Tauri 2 官方源码）：dragDropEnabled=true 时 Tauri 在 OS 层接管拖放，
     onDragDropEvent 仅订阅 tauri://drag-* 事件（无 preventDefault API），与 HTML5 drag/drop 无关。 */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const ev = event.payload;
        switch (ev.type) {
          case "enter":
          case "over":
            setIsDragOver(true);
            break;
          case "leave":
            setIsDragOver(false);
            break;
          case "drop":
            setIsDragOver(false);
            handleDroppedRef.current(ev.paths as string[]);
            break;
        }
      })
      .then((fn) => {
        // 若 cleanup 已先行（竞态），立即解绑，避免监听泄漏
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((err) => {
        // 事件监听注册失败（权限/版本问题）。需确保 capabilities 已授权
        // core:webview:allow-on-drag-drop-event，否则拖放将完全失效。
        console.error("[drag-drop] onDragDropEvent 注册失败", err);
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  /** 对话框打开状态锁：防止对话框关闭后 WebView2 重放点击导致无限弹窗 */
  const dialogOpenRef = useRef(false);

  /** 点击加载区（空态）弹出添加文件对话框 */
  const handleZoneClick = useCallback(
    async (e?: React.MouseEvent) => {
      // 忽略对话框关闭瞬间的重放点击，避免无限弹窗
      if (dialogOpenRef.current) return;
      e?.preventDefault();
      dialogOpenRef.current = true;
      try {
        const paths = await openFileDialog();
        if (paths && paths.length > 0) {
          handleDroppedPaths(paths, t);
        }
      } catch {
        // 用户取消选择，忽略
      } finally {
        // 延迟释放锁，吞掉对话框关闭后立即重放的一次点击
        setTimeout(() => {
          dialogOpenRef.current = false;
        }, 300);
      }
    },
    [t],
  );

  /** 右键菜单事件 */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, index });
    },
    [],
  );

  /** 关闭右键菜单 */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** 复制文件路径 */
  const handleCopyPath = useCallback(
    async (index: number) => {
      const file = fileList[index];
      if (file) {
        try {
          await writeText(file.path);
        } catch {
          // 剪贴板写入失败，忽略
        }
      }
      closeContextMenu();
    },
    [fileList, closeContextMenu],
  );

  /** 从路径提取文件名 */
  const getBasename = (path: string) => {
    return path.split(/[/\\]/).pop() ?? path;
  };

  /** 字节数格式化为可读大小 */
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
  };

  /** 复制单条算法哈希结果（仅 hash 值，不含文件名/算法名） */
  const handleCopyHash = useCallback(async (r: FileResult) => {
    if (!r.hashValue) return;
    try {
      await writeText(r.hashValue);
    } catch {
      // 剪贴板写入失败，忽略
    }
  }, []);

  /** 复制该文件所有算法结果 */
  const handleCopyAll = useCallback(
    async (file: { path: string; results: FileResult[] }) => {
      const lines = (file.results ?? []).map(
        (r) => `${r.algorithm}: ${r.hashValue}`,
      );
      try {
        await writeText(
          lines.length > 0
            ? `${getBasename(file.path)}\n${lines.join("\n")}`
            : getBasename(file.path),
        );
      } catch {
        // 剪贴板写入失败，忽略
      }
    },
    [],
  );

  /** 复制校验文件条目中的单个哈希值 */
  const handleCopyEntryHash = useCallback(async (hash: string) => {
    if (!hash) return;
    try {
      await writeText(hash);
    } catch {
      // 剪贴板写入失败，忽略
    }
  }, []);

  /** 按文件名对校验文件条目分组 */
  const groupEntriesByFilename = (entries: VerificationEntry[]) => {
    const map = new Map<string, VerificationEntry[]>();
    for (const e of entries) {
      const list = map.get(e.filename) ?? [];
      list.push(e);
      map.set(e.filename, list);
    }
    return map;
  };

  const fileGroups = useMemo(() => buildFileGroups(fileList), [fileList]);

  /* 错落入场仅首次：应用生命周期内第一次显示文件列表时播放一次 */
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    if (fileList.length === 0 || hasEntered) return;
    const timer = setTimeout(() => setHasEntered(true), 800);
    return () => clearTimeout(timer);
  }, [fileList.length, hasEntered]);
  const animateEnter = fileList.length > 0 && !hasEntered;

  return (
    <section className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* 拖放区域 + 文件列表：内容超出时内部滚动，操作按钮固定在底部 */}
      <div
        className={cn(
          "main-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card",
          isDragOver
            ? "main-card--dragging border-2 border-dashed border-[var(--primary)] bg-primary-alpha"
            : "",
          fileList.length === 0 ? "cursor-pointer" : "",
        )}
        onClick={fileList.length === 0 ? handleZoneClick : undefined}
      >
        {/* 悬浮计算进度面板：相对于文件列表卡片居中 */}
        <FloatingProgress />
        <div className="filelist-scroll-area group relative min-h-0 flex-1">
          {fileList.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileSearch className="h-10 w-10 opacity-30" />
                <span>{t("drag_hint")}</span>
              </div>
              {/* 空状态常用快捷键：半透明，hover 全显；阻止冒泡避免触发打开文件对话框 */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="group/hk flex flex-col items-center gap-2 rounded-xl border border-border px-5 py-3 opacity-50 transition-opacity hover:opacity-100"
                style={{ backgroundColor: "color-mix(in srgb, var(--muted) 50%, transparent)" }}
              >
                <span className="text-xs font-medium text-muted-foreground">{t("home_shortcuts")}</span>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {(
                    [
                      { cmd: "open_file", labelKey: "menu_open" },
                      { cmd: "batch_process", labelKey: "menu_batch_process" },
                      { cmd: "import_verify", labelKey: "menu_import_verify" },
                      { cmd: "start_verify", labelKey: "start_verify" },
                    ] as const
                  ).map(({ cmd, labelKey }) => (
                    <li key={cmd} className="flex items-center gap-2 text-xs text-foreground">
                      <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {formatShortcut(SHORTCUT_BINDINGS[cmd])}
                      </kbd>
                      <span>{t(labelKey)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("show-quick-guide"));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {t("home_view_all")} →
                </button>
              </div>
            </div>
          ) : (
            <ul
              ref={listScrollRef}
              className="h-full overflow-y-auto scrollbar-none"
            >
              {fileList.flatMap((file, fileIndex) => {
                const children: FileResult[] = file.results ?? [];
                const group = fileGroups.map.get(file.path);
                const isVerification = file.role === "verification";
                const hasComputedHash = !isVerification && children.some((r) => !!r.hashValue);
                const isCollapsed = isVerification && collapsedVfs.has(file.path);
                const parent = (
                  <li
                    key={`p-${file.path}`}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 cursor-default hover:bg-muted/30",
                      isVerification && "bg-secondary/5 hover:bg-secondary/10 cursor-pointer",
                      animateEnter && "list-item-enter",
                    )}
                    style={
                      animateEnter
                        ? { animationDelay: `${Math.min(fileIndex * 40, 240)}ms` }
                        : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isVerification) toggleVf(file.path);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, fileIndex)}
                    aria-expanded={isVerification ? !isCollapsed : undefined}
                  >
                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                      <Tooltip
                        label={
                          group
                            ? `第 ${group.groupId} 组 · ${group.algorithm.toUpperCase()}: ${group.hash}`
                            : getBasename(file.path)
                        }
                        className="flex-1 min-w-0"
                      >
                        <span
                          className={cn(
                            "truncate text-base font-bold",
                            isVerification ? "text-secondary" : group ? group.colorClass : "text-foreground",
                          )}
                          aria-label={getBasename(file.path)}
                        >
                          {getBasename(file.path)}
                        </span>
                      </Tooltip>
                      {isVerification && (
                        <span className="shrink-0 rounded border border-primary/40 bg-primary-alpha px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          {t("verification_file")}
                        </span>
                      )}
                      {hasComputedHash && (
                        <span
                          className="shrink-0 text-base leading-none text-success"
                          aria-label={t("computed")}
                        >
                          ✓
                        </span>
                      )}
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {typeof file.size === "number" ? formatBytes(file.size) : ""}
                      </span>
                      {/* 校验文件折叠图标：紧跟大小信息，不再右对齐 */}
                      {isVerification && file.entries && file.entries.length > 0 && (
                        <Tooltip label={isCollapsed ? t("expand") : t("collapse")}>
                          <button
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVf(file.path);
                            }}
                            aria-label={isCollapsed ? t("expand") : t("collapse")}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </Tooltip>
                      )}
                    </div>
                    <Tooltip label={t("remove_selected")}>
                      <button
                        className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(fileIndex);
                        }}
                        aria-label={t("remove_selected")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </li>
                );
                if (isVerification && file.entries && file.entries.length > 0) {
                  const grouped = groupEntriesByFilename(file.entries);
                  const rows: ReactNode[] = [];
                  let childIdx = 0;
                  for (const [filename, entries] of grouped) {
                    const filenameKey = `vf-${file.path}-${filename}`;
                    rows.push(
                      <li
                        key={filenameKey}
                        className={cn(
                          "flex items-center gap-3 pl-10 pr-3 py-1 text-xs text-muted-foreground hover:bg-muted/20",
                          animateEnter && "list-item-enter",
                        )}
                        style={
                          animateEnter
                            ? {
                                animationDelay: `${Math.min(fileIndex * 40 + childIdx * 25, 400)}ms`,
                              }
                            : undefined
                        }
                      >
                        <span className="min-w-0 flex-1 flex items-baseline gap-1.5">
                          <span className="truncate font-medium text-foreground/80">
                            {filename}
                          </span>
                          <span
                            className="shrink-0 text-base leading-none text-success"
                            aria-label={t("computed")}
                          >
                            ✓
                          </span>
                        </span>
                      </li>,
                    );
                    childIdx++;
                    for (const e of entries) {
                      rows.push(
                        <li
                          key={`${filenameKey}-${e.algorithm}-${e.hashValue}-${childIdx}`}
                          className={cn(
                            "flex items-center gap-3 pl-16 pr-3 py-1 text-xs text-muted-foreground hover:bg-muted/20",
                            animateEnter && "list-item-enter",
                          )}
                          style={
                            animateEnter
                              ? {
                                  animationDelay: `${Math.min(fileIndex * 40 + childIdx * 25, 400)}ms`,
                                }
                              : undefined
                          }
                        >
                          <span className="w-20 shrink-0 font-medium uppercase text-foreground/70">
                            {e.algorithm}
                          </span>
                          <Tooltip label={e.hashValue} className="flex-1 min-w-0">
                            <span className="block w-full truncate font-mono text-foreground/80">
                              {e.hashValue}
                            </span>
                          </Tooltip>
                          <Tooltip label={t("copy")}>
                            <button
                              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopyEntryHash(e.hashValue)}
                              aria-label={t("copy")}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </Tooltip>
                        </li>,
                      );
                      childIdx++;
                    }
                  }
                  return isCollapsed ? [parent] : [parent, ...rows];
                }

                const childRows = children.map((r, ri) => (
                  <li
                    key={`c-${file.path}-${r.algorithm}`}
                    className={cn(
                      "flex items-center gap-3 pl-10 pr-3 py-1 text-xs text-muted-foreground hover:bg-muted/20",
                      animateEnter && "list-item-enter",
                    )}
                    style={
                      animateEnter
                        ? {
                            animationDelay: `${Math.min(fileIndex * 40 + ri * 25, 400)}ms`,
                          }
                        : undefined
                    }
                  >
                    <span className="w-20 shrink-0 font-medium uppercase text-foreground/70">
                      {r.algorithm}
                    </span>
                    <span className="min-w-0 flex-1 flex items-baseline gap-2">
                      <Tooltip
                        label={r.hashValue || translateErrorCode(r.errorCode, r.errorDetail, t, r.errorMessage)}
                        className="flex-1 min-w-0"
                      >
                        <span
                          className={cn(
                            "block w-full truncate font-mono text-foreground/80",
                            r.status === "error" ? "text-warning" : "",
                          )}
                        >
                          {r.status === "error"
                            ? translateErrorCode(r.errorCode, r.errorDetail, t, r.errorMessage)
                            : r.hashValue || "—"}
                        </span>
                      </Tooltip>
                      <span className="shrink-0 text-muted-foreground/80">
                        {r.elapsedTime > 0 ? `${r.elapsedTime.toFixed(2)}s` : "—"}
                      </span>
                    </span>
                    {r.status !== "error" && r.hashValue && (
                      <Tooltip label={t("copy")}>
                        <button
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyHash(r)}
                          aria-label={t("copy")}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </Tooltip>
                    )}
                  </li>
                ));
                return [parent, ...childRows];
              })}
            </ul>
          )}

          {/* 向上/向下滚动提示徽章 */}
          {fileList.length > 0 && (scrollState.canScrollUp || scrollState.canScrollDown) && (
            <div className="pointer-events-none absolute right-20 top-1/2 z-10 -translate-y-1/2 flex flex-col gap-2 transition-opacity duration-300 opacity-30 group-hover:opacity-100">
              {scrollState.canScrollUp && (
                <Tooltip label={t("scroll_to_top")}>
                  <button
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-foreground shadow ring-1 ring-border backdrop-blur hover:bg-primary hover:text-primary-foreground hover:ring-primary transition-colors hover:scale-110"
                    onClick={() => scrollToEdge("up")}
                    aria-label={t("scroll_to_top")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
              {scrollState.canScrollDown && (
                <Tooltip label={t("scroll_to_bottom")}>
                  <button
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-foreground shadow ring-1 ring-border backdrop-blur hover:bg-primary hover:text-primary-foreground hover:ring-primary transition-colors hover:scale-110"
                    onClick={() => scrollToEdge("down")}
                    aria-label={t("scroll_to_bottom")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          {/* 点击遮罩关闭菜单 */}
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <div
            ref={menuRef}
            tabIndex={-1}
            className="fixed z-50 min-w-[140px] rounded-default border border-border bg-card py-1 shadow-lg outline-none"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onBlur={(e) => {
              if (!menuRef.current?.contains(e.relatedTarget as Node)) {
                closeContextMenu();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeContextMenu();
              }
            }}
          >
            <button
              className="menu-item"
              onClick={() => {
                removeFile(contextMenu.index);
                closeContextMenu();
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t("remove_selected")}
            </button>
            <button
              className="menu-item"
              onClick={() => handleCopyPath(contextMenu.index)}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("copy_path")}
            </button>
            {fileList[contextMenu.index]?.role !== "verification" && (
              <button
                className="menu-item"
                onClick={() => handleCopyAll(fileList[contextMenu.index])}
              >
                <Hash className="h-3.5 w-3.5" />
                {t("menu_copy")}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
