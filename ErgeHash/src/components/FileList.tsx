import { useEffect, useLayoutEffect, useState, useCallback, useRef, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Hash, FileSearch } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { FileResult, FileItemStatus } from "@/services/types";
import { scanDirectory, openFileDialog } from "@/services/api";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";

/** 文件拖放列表组件，对应原始 DragDropFileListWidget */
export function FileList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const addFiles = useAppStore((s) => s.addFiles);
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

  /** 处理拖拽进入 */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  /** 处理拖拽悬停 */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /** 处理拖拽离开 */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /** 处理文件放置（HTML5 事件仅阻止默认行为；真实路径由 Tauri onDragDropEvent 提供） */
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /** 处理 Tauri 拖放提供的真实路径：目录则扫描出文件，文件则直接加入 */
  const processPaths = useCallback(
    async (paths: string[]) => {
      if (!paths || paths.length === 0) return;
      const allFiles: string[] = [];
      for (const p of paths) {
        try {
          // 目录则扫描出文件，文件则返回空数组
          const scanned = await scanDirectory(p);
          if (scanned.length > 0) {
            allFiles.push(...scanned);
          } else {
            // 单个文件
            allFiles.push(p);
          }
        } catch {
          // 扫描失败，当作文件添加
          allFiles.push(p);
        }
      }
      if (allFiles.length > 0) {
        addFiles(allFiles);
      }
    },
    [addFiles],
  );

  /* 注册 Tauri 拖放事件：获取真实文件路径（替代已失效的 HTML5 File.path），并驱动拖拽高亮 */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const ev = event.payload;
        // 调试日志：确认拖放事件链路是否触发
        console.log("[drag-drop]", ev.type, ev);
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
            void processPaths(ev.paths);
            break;
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        // 事件监听注册失败（权限/版本问题）。注意：Tauri 2 前端 onDragDropEvent 注册成功后
        // Rust 侧 WindowEvent::DragDrop 不再派发（单消费者），此处无法回退到 Rust 兜底，
        // 拖放将完全失效——需确保 capabilities 已授权 core:webview:allow-on-drag-drop-event。
        console.error("[drag-drop] onDragDropEvent 注册失败", err);
      });
    return () => {
      unlisten?.();
    };
  }, [processPaths]);

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
          addFiles(paths);
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
    [addFiles],
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

  /** 复制单个算法子结果行 */
  const handleCopyChild = useCallback(
    async (file: { path: string }, r: FileResult) => {
      try {
        await writeText(`${getBasename(file.path)} ${r.algorithm}: ${r.hashValue}`);
      } catch {
        // 剪贴板写入失败，忽略
      }
    },
    [],
  );

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

  /** 父级汇总状态徽章 */
  const StatusBadge = ({ status }: { status?: FileItemStatus }) => {
    if (!status) {
      return (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground">
          {t("unverified")}
        </span>
      );
    }
    if (status === "success") {
      return (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-primary">
          {t("match")}
        </span>
      );
    }
    if (status === "mismatch") {
      return (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-destructive">
          {t("mismatch")}
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-warning">
          {t("error")}
        </span>
      );
    }
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground">
        {t("computed")}
      </span>
    );
  };

  return (
    <section className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* 拖放区域 + 文件列表：内容超出时内部滚动，操作按钮固定在底部 */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card",
          isDragOver
            ? "border-2 border-dashed border-[var(--primary)] bg-primary-alpha"
            : "",
          fileList.length === 0 ? "cursor-pointer" : "",
        )}
        onClick={fileList.length === 0 ? handleZoneClick : undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fileList.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileSearch className="h-10 w-10 opacity-30" />
              <span>{t("drag_hint")}</span>
            </div>
          ) : (
            <ul>
              {fileList.flatMap((file, fileIndex) => {
                const children: FileResult[] = file.results ?? [];
                const parent = (
                  <li
                    key={`p-${file.path}`}
                    className="flex items-center gap-2 px-3 py-2 cursor-default hover:bg-muted/30"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => handleContextMenu(e, fileIndex)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span
                          className="truncate text-base font-bold text-foreground"
                          title={getBasename(file.path)}
                        >
                          {getBasename(file.path)}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={file.path}
                        >
                          {file.path}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {typeof file.size === "number" ? formatBytes(file.size) : ""}
                    </span>
                    <StatusBadge status={file.status} />
                    <button
                      className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyAll(file)}
                      title={t("menu_copy")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(fileIndex)}
                      title={t("remove_selected")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
                const childRows = children.map((r, ci) => (
                  <li
                    key={`c-${file.path}-${r.algorithm}`}
                    className={cn(
                      "group relative flex items-center gap-2 py-1 pr-3 text-xs text-muted-foreground hover:bg-muted/20",
                      ci === children.length - 1 ? "pb-2" : "",
                    )}
                    title={file.path}
                  >
                    {/* 连续竖线引导 + 拐角：父级与子级视觉成一体 */}
                    <span className="relative flex w-8 shrink-0 justify-center">
                      <span
                        className={cn(
                          "absolute top-0 w-px bg-muted-foreground/40",
                          ci === children.length - 1 ? "bottom-1/2" : "bottom-0",
                        )}
                        style={{ left: "1rem" }}
                      />
                      {ci === children.length - 1 && (
                        <span
                          className="absolute h-px w-4 bg-muted-foreground/40"
                          style={{ left: "1rem", top: "50%" }}
                        />
                      )}
                      <span
                        className="absolute z-10 h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                        style={{ left: "1rem", top: "50%", transform: "translate(-50%, -50%)" }}
                      />
                    </span>
                    <span className="w-20 shrink-0 font-medium uppercase text-foreground/70">
                      {r.algorithm}
                    </span>
                    <span
                      className={cn(
                        "flex-1 truncate font-mono text-foreground/80",
                        r.status === "error" ? "text-warning" : "",
                      )}
                      title={r.hashValue || r.errorMessage}
                    >
                      {r.status === "error"
                        ? r.errorMessage ?? t("error")
                        : r.hashValue || "—"}
                    </span>
                    <span className="w-20 shrink-0 text-right text-muted-foreground/80">
                      {r.elapsedTime > 0 ? `${r.elapsedTime.toFixed(2)}s` : "—"}
                    </span>
                    {r.status !== "error" && (
                      <button
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                        onClick={() => handleCopyChild(file, r)}
                        title={t("copy")}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ));
                return [parent, ...childRows];
              })}
            </ul>
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => {
                removeFile(contextMenu.index);
                closeContextMenu();
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t("remove_selected")}
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => handleCopyPath(contextMenu.index)}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("copy_path")}
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => handleCopyAll(fileList[contextMenu.index])}
            >
              <Hash className="h-3.5 w-3.5" />
              {t("menu_copy")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
