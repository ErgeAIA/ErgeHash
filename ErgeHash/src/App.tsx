import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "./store/appStore";
import {
  getConfig,
  setConfig,
  clearHistory as apiClearHistory,
  addHistory,
  openFileDialog,
  importVerificationFile,
} from "./services/api";
import { onHashProgress, onBatchProgress, onBatchFileComplete, onBatchComplete } from "./services/api";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { MainLayout } from "./components/layout/MainLayout";
import { NavRail } from "./components/layout/NavRail";
import { TitleBar } from "./components/layout/TitleBar";
import { FileList } from "./components/FileList";
import { ExpectedHashSection } from "./components/ExpectedHashSection";
import { StatusReportBar } from "./components/StatusReportBar";
import { BottomActionBar } from "./components/BottomActionBar";
import { FloatingProgress } from "./components/FloatingProgress";
import { HistoryDialog } from "./components/dialogs/HistoryDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { QuickGuideDialog } from "./components/dialogs/QuickGuideDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ToastHost } from "./components/ui/toast";
import { useToastStore } from "./store/toastStore";
import type { HashAlgorithm } from "./services/types";

const ALL_ALGORITHMS: HashAlgorithm[] = ["sha256", "md5", "sha1", "sha512", "crc32"];

function parseAlgorithms(raw: string): HashAlgorithm[] {
  const parsed = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a): a is HashAlgorithm => ALL_ALGORITHMS.includes(a as HashAlgorithm));
  return parsed.length > 0 ? parsed : ["sha256"];
}

function App() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const setSelectedAlgorithms = useAppStore((s) => s.setSelectedAlgorithms);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setResultText = useAppStore((s) => s.setResultText);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const updateFileResult = useAppStore((s) => s.updateFileResult);
  const setBytesRead = useAppStore((s) => s.setBytesRead);
  const setTotalBytes = useAppStore((s) => s.setTotalBytes);
  const addFiles = useAppStore((s) => s.addFiles);

  // 对话框状态
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  // 侧栏折叠状态（持久化到 localStorage，重启后保持）
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("hvp.ui.nav_collapsed") === "true",
  );

  // 切换侧栏折叠（同步持久化）
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("hvp.ui.nav_collapsed", String(next));
      return next;
    });
  }, []);

  // 监听 Ctrl+B 触发的侧栏切换事件
  useEffect(() => {
    const onToggle = () => toggleSidebar();
    window.addEventListener("toggle-sidebar", onToggle);
    return () => window.removeEventListener("toggle-sidebar", onToggle);
  }, [toggleSidebar]);

  // 重要：Tauri 2 的文件拖放由 Rust 层接管（onDragDropEvent / WindowEvent::DragDrop），
  // 与浏览器原生 drag/drop 事件是两套独立机制。前端 onDragDropEvent 注册成功后，
  // Rust 侧 WindowEvent::DragDrop 不再派发（单消费者机制）。
  // 因此**不要**在全局对 drop/dragover 做 preventDefault 来"辅助"拖放——这会：
  //   1. 与 Tauri 拖放事件竞态，干扰 FileList 中基于 HTML5 drag 事件的拖拽高亮；
  //   2. 在 WebView2 下可能吞掉原生事件，使 React 的 onDragEnter/Leave 高亮不稳定。
  // 拖放的真实数据来源是 FileList.tsx 中的 getCurrentWebview().onDragDropEvent(payload.paths)。
  useEffect(() => {
    // 仅阻止"非文件拖放"（如拖入图片/链接）被浏览器直接打开，绝不影响文件拖放。
    const preventNonFileDrop = (e: DragEvent) => {
      if (e.dataTransfer && !Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
      }
    };
    window.addEventListener("dragover", preventNonFileDrop);
    window.addEventListener("drop", preventNonFileDrop);
    return () => {
      window.removeEventListener("dragover", preventNonFileDrop);
      window.removeEventListener("drop", preventNonFileDrop);
    };
  }, []);

  // 注册全局快捷键
  useKeyboardShortcuts();
  const addToast = useToastStore((s) => s.addToast);

  // 初始化：从后端加载配置
  // 注意：窗口 show 由 Rust 侧 setup 钩子负责，此处不调用 show()。
  // 原因：JS 侧 show 依赖 React 挂载 + IPC 链路，若 getConfig() 慢/挂起则窗口永不显示；
  // 且与 WebView2 渲染存在时序竞态。Rust 侧 setup 在事件循环前同步执行更稳健。
  useEffect(() => {
    async function initConfig() {
      try {
        const config = await getConfig();
        setTheme(config.theme);
        setLanguage(config.language);
        setSelectedAlgorithms(parseAlgorithms(config.algorithm));
        if (typeof config.autoCalculate === "boolean") {
          useAppStore.setState({ autoCalculate: config.autoCalculate });
        }

        // 恢复窗口几何
        if (config.windowGeometry) {
          try {
            const g = JSON.parse(config.windowGeometry) as {
              x: number;
              y: number;
              width: number;
              height: number;
            };
            const win = getCurrentWindow();
            await win.setPosition(new PhysicalPosition(g.x, g.y));
            await win.setSize(new PhysicalSize(g.width, g.height));
          } catch {
            // 几何数据无效时忽略
          }
        }
      } catch {
        // 后端尚未就绪时忽略错误
      }
    }
    initConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 语言变更时同步 i18next
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  // 主题变更时切换 dark 类
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // 窗口关闭时保存几何信息
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          const win = getCurrentWindow();
          const pos = await win.outerPosition();
          const size = await win.outerSize();
          await setConfig(
            "windowGeometry",
            JSON.stringify({
              x: pos.x,
              y: pos.y,
              width: size.width,
              height: size.height,
            }),
          );
        } catch {
          // 保存失败仍继续关闭
        }
        await getCurrentWindow().destroy();
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, []);

  // 注册 Tauri 事件监听
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    async function setupListeners() {
      unlisteners.push(
        await onHashProgress((payload) => {
          setCurrentFile(payload.filePath);
          setProgress(payload.progress);
          setBytesRead(payload.bytesRead);
          setTotalBytes(payload.totalBytes);
          setStatusMessage("calculating");
        }),
      );

      unlisteners.push(
        await onBatchFileComplete((payload) => {
          const fileName = payload.filePath.split(/[/\\]/).pop() ?? payload.filePath;
          const cacheNote = payload.fromCache ? ` [${t("from_cache")}]` : "";
          const timeNote =
            payload.elapsedTime > 0
              ? ` (${t("elapsed")}: ${payload.elapsedTime.toFixed(2)}s)`
              : "";
          const mark =
            payload.status === "success"
              ? "✓"
              : payload.status === "mismatch"
                ? "✗"
                : "!";
          setResultText(
            (prev) =>
              prev +
              `${mark} ${fileName}${cacheNote}\n  ${payload.hashValue}${timeNote}\n\n`,
          );
          setCurrentFile(payload.filePath);

          // 按算法维度写入子结果：后端 success 仅表示「计算成功」，映射为 computed（未验证）；
          // 真正「验证匹配」的 success 由 startValidation 在比对后覆盖写入。
          updateFileResult({
            filePath: payload.filePath,
            algorithm: payload.algorithm,
            hashValue: payload.hashValue,
            elapsedTime: payload.elapsedTime,
            status: payload.status === "success" ? "computed" : payload.status,
            fromCache: payload.fromCache,
            errorMessage: payload.errorMessage,
          });
        }),
      );

      unlisteners.push(
        await onBatchProgress((p) => {
          if (p.total > 0) {
            setProgress(Math.round((p.done / p.total) * 100));
          }
          setStatusMessage("calculating");
        }),
      );

      unlisteners.push(
        await onBatchComplete(async (payload) => {
          setCalculating(false);
          setProgress(100);
          setStatusMessage("completed");
          setResultText(
            (prev) =>
              prev +
              `---\n${t("batch_complete")}\n` +
              `${t("total_files")}: ${payload.total} | ` +
              `${t("success_count")}: ${payload.success} | ` +
              `${t("error_count")}: ${payload.error}\n` +
              `${t("total_time")}: ${payload.totalTime.toFixed(2)}s`,
          );

          // 成功结果写入历史记录（顺序 await，避免并发读写竞态）
          for (const r of payload.results) {
            if (r.status !== "success") continue;
            try {
              await addHistory({
                filePath: r.filePath,
                algorithm: r.algorithm,
                hashValue: r.hashValue,
                timestamp: new Date().toISOString(),
              });
            } catch {
              // 单条历史写入失败不阻塞其余
            }
          }
        }),
      );

      // Rust 侧文件拖放兜底（on_window_event 转发）
      unlisteners.push(
        await getCurrentWebview().listen<string[]>("files-dropped", (e) => {
          const paths = e.payload;
          if (paths && paths.length > 0) {
            addFiles(paths);
            if (useAppStore.getState().autoCalculate) {
              void useAppStore.getState().startValidation();
            }
          }
        }),
      );
    }

    setupListeners();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [
    t,
    setCurrentFile,
    setProgress,
    setStatusMessage,
    setCalculating,
    setResultText,
    updateFileResult,
    setBytesRead,
    setTotalBytes,
    addFiles,
  ]);

  /** 确认清空历史记录 */
  const handleConfirmClearHistory = useCallback(async () => {
    try {
      await apiClearHistory();
      addToast("success", t("history_cleared"));
    } catch {
      addToast("error", t("clear_history_failed"));
    }
  }, [addToast, t]);

  // 监听自定义事件（菜单栏和侧边栏触发）
  useEffect(() => {
    const onShowHistory = () => setShowHistory(true);
    const onShowSettings = () => setShowSettings(true);
    const onShowQuickGuide = () => setShowQuickGuide(true);
    const onExportResults = () => setShowExport(true);
    const onClearHistory = () => setConfirmClearHistory(true);
    const onImportVerification = async () => {
      const paths = await openFileDialog();
      if (!paths || paths.length === 0) return;
      try {
        const entries = await importVerificationFile(paths[0]);
        if (entries.length === 0) {
          setStatusMessage(t("import_error"));
          addToast("error", t("import_error"));
          return;
        }
        setExpectedHash(entries.map((e) => e.hashValue).join("\n"));
        setStatusMessage(t("import_success", { count: entries.length }));
        addToast("success", t("import_success", { count: entries.length }));
      } catch {
        setStatusMessage(t("import_error"));
        addToast("error", t("import_error"));
      }
    };

    window.addEventListener("show-history", onShowHistory);
    window.addEventListener("show-settings", onShowSettings);
    window.addEventListener("show-quick-guide", onShowQuickGuide);
    window.addEventListener("export-results", onExportResults);
    window.addEventListener("clear-history", onClearHistory);
    window.addEventListener("import-verification", onImportVerification);

    return () => {
      window.removeEventListener("show-history", onShowHistory);
      window.removeEventListener("show-settings", onShowSettings);
      window.removeEventListener("show-quick-guide", onShowQuickGuide);
      window.removeEventListener("export-results", onExportResults);
      window.removeEventListener("clear-history", onClearHistory);
      window.removeEventListener("import-verification", onImportVerification);
    };
  }, [t, setStatusMessage, setExpectedHash, addToast]);

  return (
    <MainLayout>
      {/* 顶栏：横跨整个窗口顶部，与左侧 NavRail 同色一体 */}
      <TitleBar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />

      {/* 下方横向：左侧导航（与顶栏一体浅黑） | 右侧深色圆角内容块 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏：与顶栏同色一体，无圆角无边距 */}
        <div className="flex shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-200" style={{ width: sidebarCollapsed ? 64 : 220 }}>
          <NavRail collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
        </div>

        {/* 右侧主内容区：文件列表 + 计算结果，禁止主窗口滚动。
            父容器用 bg-sidebar，与顶栏/侧栏 L 形框架同色，消除 m-2 间隙在亮色下的“残留直角块”视觉。 */}
        <div className="flex flex-1 flex-col gap-6 overflow-hidden bg-sidebar p-2">
          <div className="flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl bg-panel px-6 py-6">
            {/* 文件列表区：父级文件名/路径/大小 + 汇总状态，子级按算法展开哈希/耗时。
                计算结果直接回填到文件树，取代独立结果区。 */}
            <FileList className="flex-1" />
            <ExpectedHashSection className="shrink-0" />
            <BottomActionBar className="shrink-0" />
            <StatusReportBar className="shrink-0" />
          </div>
        </div>
      </div>

      {/* 对话框 */}
      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <QuickGuideDialog open={showQuickGuide} onOpenChange={setShowQuickGuide} />
      <ExportDialog open={showExport} onOpenChange={setShowExport} />
      <ConfirmDialog
        open={confirmClearHistory}
        onOpenChange={setConfirmClearHistory}
        title={t("warning")}
        description={t("clear_history_confirm")}
        variant="destructive"
        onConfirm={handleConfirmClearHistory}
      />
      <ToastHost />
      {/* 悬浮计算进度 toast */}
      <FloatingProgress />
    </MainLayout>
  );
}

export default App;
