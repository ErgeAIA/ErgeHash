import { useEffect, useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Hash, FileSearch } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { scanDirectory, openFileDialog } from "@/services/api";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { HashAlgorithm } from "@/services/types";
import { FileActions } from "./FileActions";

/** 哈希值长度与算法的映射表 */
const HASH_LENGTH_ALGO_MAP: Record<number, HashAlgorithm> = {
  32: "md5",
  40: "sha1",
  64: "sha256",
  128: "sha512",
};

/** 算法显示名（大写形式，与后端 serde UPPERCASE 序列化一致） */
const ALGO_DISPLAY_NAME: Record<HashAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA1",
  sha256: "SHA256",
  sha512: "SHA512",
};

/** 文件拖放列表组件，对应原始 DragDropFileListWidget */
export function FileList() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const addFiles = useAppStore((s) => s.addFiles);
  const removeFile = useAppStore((s) => s.removeFile);
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);

  /* 拖拽高亮状态 */
  const [isDragOver, setIsDragOver] = useState(false);
  /* 预期哈希输入框聚焦状态 */
  const [hashFocused, setHashFocused] = useState(false);

  /* 右键菜单状态 */
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  /* 阻止右键菜单关闭的 ref */
  const menuRef = useRef<HTMLDivElement>(null);

  // 自动检测到的算法提示状态
  const [detectedAlgo, setDetectedAlgo] = useState<HashAlgorithm | null>(null);

  /** 预期哈希值变更：同步到 store 并按长度推断算法 */
  const handleExpectedHashChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setExpectedHash(value);

      const trimmed = value.trim();
      if (trimmed.includes("\n")) {
        setDetectedAlgo(null);
        return;
      }

      const cleaned = trimmed.replace(/\s/g, "");
      if (cleaned.length > 0 && /^[0-9a-f]+$/i.test(cleaned)) {
        const algo = HASH_LENGTH_ALGO_MAP[cleaned.length];
        if (algo) {
          setAlgorithm(algo);
          setDetectedAlgo(algo);
          return;
        }
      }
      setDetectedAlgo(null);
    },
    [setExpectedHash, setAlgorithm],
  );

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

  /** 复制哈希值 */
  const handleCopyHash = useCallback(
    async (index: number) => {
      const file = fileList[index];
      if (file?.hashValue) {
        try {
          await writeText(file.hashValue);
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

  /** 根据状态获取行背景色 */
  const getStatusBg = (status?: string) => {
    switch (status) {
      case "success":
        return "bg-success";
      case "mismatch":
        return "bg-mismatch";
      case "error":
        return "bg-error";
      case "computed":
        return "bg-computed";
      default:
        return "";
    }
  };

  return (
    <section className="flex min-h-0 flex-[1.4] flex-col gap-3">
      {/* 二级标题 */}
      <h2 className="shrink-0 text-lg font-semibold text-foreground">
        {t("file_list_label")}
      </h2>

      {/* 拖放区域 + 文件列表：固定高度，内容超出时内部滚动 */}
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card",
          isDragOver
            ? "border-2 border-dashed border-[var(--primary)] bg-primary/10"
            : "",
          fileList.length === 0 ? "cursor-pointer" : "",
        )}
        onClick={fileList.length === 0 ? handleZoneClick : undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fileList.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileSearch className="h-10 w-10 opacity-30" />
            <span>{t("drag_hint")}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {fileList.map((file, index) => (
              <li
                key={file.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-default",
                  getStatusBg(file.status),
                )}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => handleContextMenu(e, index)}
                title={file.path}
              >
                {/* 文件名 */}
                <span className="flex-1 truncate" title={file.path}>
                  {getBasename(file.path)}
                </span>

                {/* 哈希值（如果有） */}
                {file.hashValue && (
                  <span className="max-w-[200px] truncate text-xs text-muted-foreground" title={file.hashValue}>
                    {file.hashValue}
                  </span>
                )}

                {/* 状态图标 */}
                {file.status === "computed" && (
                  <span className="text-xs text-muted-foreground">&#10003;</span>
                )}
                {file.status === "success" && (
                  <span className="text-xs text-primary">&#10003;</span>
                )}
                {file.status === "mismatch" && (
                  <span className="text-xs text-destructive">&#10007;</span>
                )}
                {file.status === "error" && (
                  <span className="text-xs text-warning">!</span>
                )}

                {/* 删除按钮 */}
                <button
                  className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(index)}
                  title={t("remove_selected")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 浮动操作按钮：开始检测 + 清空列表，悬浮在文件列表右下偏左；空态时仍可见（半透明灰显） */}
        <div className="pointer-events-none absolute bottom-4 right-20 z-10">
          <div className="pointer-events-auto">
            <FileActions />
          </div>
        </div>
      </div>

      {/* 预期哈希值输入 */}
      <div className="relative shrink-0">
        <Textarea
          value={expectedHash}
          onChange={handleExpectedHashChange}
          onFocus={() => setHashFocused(true)}
          onBlur={() => setHashFocused(false)}
          placeholder=""
          className="h-[80px] resize-none pr-8"
        />
        {/* 空态居中提示：与文件列表/结果区空态提示风格一致 */}
        {!expectedHash.trim() && !hashFocused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("expected_hash_placeholder")}
          </div>
        )}
        {expectedHash.trim() && (
          <button
            className="absolute right-2 top-2 rounded-full bg-muted p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setExpectedHash("")}
            title={t("clear")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 自动检测到的算法提示 */}
      {detectedAlgo && (
        <div className="shrink-0 text-xs text-muted-foreground">
          {t("auto_detected")}: {ALGO_DISPLAY_NAME[detectedAlgo]}
        </div>
      )}

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
            className="fixed z-50 min-w-[140px] rounded-default border border-border bg-card py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => handleCopyHash(contextMenu.index)}
              disabled={!fileList[contextMenu.index]?.hashValue}
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
