import { useState, useCallback, useRef, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus, FilePlus, Trash2, X, Copy, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import { scanDirectory, openFileDialog, openFolderDialog } from "@/services/api";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/lib/utils";

/** 文件拖放列表组件，对应原始 DragDropFileListWidget */
export function FileList() {
  const { t } = useTranslation();
  const fileList = useAppStore((s) => s.fileList);
  const addFiles = useAppStore((s) => s.addFiles);
  const removeFile = useAppStore((s) => s.removeFile);
  const clearFiles = useAppStore((s) => s.clearFiles);

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

  /** 处理文件放置 */
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // webkitRelativePath 非空表示是文件夹中的文件
        // 但 HTML5 DnD 中文件夹需要特殊处理
        const path = (file as File & { path?: string }).path;
        if (path) {
          paths.push(path);
        }
      }

      if (paths.length > 0) {
        // 区分文件和文件夹：对每个路径尝试扫描目录
        const allFiles: string[] = [];
        for (const p of paths) {
          try {
            // 尝试扫描目录，如果是文件则返回空或自身
            const scanned = await scanDirectory(p);
            if (scanned.length > 0) {
              allFiles.push(...scanned);
            } else {
              // 可能是单个文件
              allFiles.push(p);
            }
          } catch {
            // 扫描失败，当作文件添加
            allFiles.push(p);
          }
        }
        addFiles(allFiles);
      }
    },
    [addFiles],
  );

  /** 点击添加文件按钮 */
  const handleAddFiles = useCallback(async () => {
    try {
      const paths = await openFileDialog();
      if (paths && paths.length > 0) {
        addFiles(paths);
      }
    } catch {
      // 用户取消选择，忽略
    }
  }, [addFiles]);

  /** 点击添加文件夹按钮 */
  const handleAddFolder = useCallback(async () => {
    try {
      const dirPath = await openFolderDialog();
      if (dirPath) {
        const files = await scanDirectory(dirPath);
        if (files.length > 0) {
          addFiles(files);
        }
      }
    } catch {
      // 用户取消选择，忽略
    }
  }, [addFiles]);

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
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 标签 */}
      <label className="text-xs text-muted-foreground">
        {t("file_list_label")}
      </label>

      {/* 拖放区域 + 文件列表 */}
      <div
        className={cn(
          "min-h-[120px] max-h-[200px] overflow-y-auto rounded-default border bg-card",
          isDragOver
            ? "border-2 border-dashed border-[var(--primary)] bg-primary/5"
            : "border-border",
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fileList.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            {t("quick_tip")}
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
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={handleAddFiles}>
          <FilePlus className="mr-1 h-4 w-4" />
          {t("add_files")}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleAddFolder}>
          <FolderPlus className="mr-1 h-4 w-4" />
          {t("add_folder")}
        </Button>
        <div className="flex-1" />
        <Button variant="destructive" size="sm" onClick={clearFiles}>
          <Trash2 className="mr-1 h-4 w-4" />
          {t("clear_list")}
        </Button>
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
    </div>
  );
}
