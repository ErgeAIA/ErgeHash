import { useEffect, useState } from "react";
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
import { ask } from "@tauri-apps/plugin-dialog";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { MainLayout } from "./components/layout/MainLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { StatusBar } from "./components/layout/StatusBar";
import { MenuBar } from "./components/layout/MenuBar";
import { ContentArea } from "./components/ContentArea";
import { HistoryDialog } from "./components/dialogs/HistoryDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { QuickGuideDialog } from "./components/dialogs/QuickGuideDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ToastHost } from "./components/ui/toast";
import { useToastStore } from "./store/toastStore";

function App() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setResultText = useAppStore((s) => s.setResultText);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const setLastResults = useAppStore((s) => s.setLastResults);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const updateFileByPath = useAppStore((s) => s.updateFileByPath);

  // 对话框状态
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // 注册全局快捷键
  useKeyboardShortcuts();
  const addToast = useToastStore((s) => s.addToast);

  // 初始化：从后端加载配置
  useEffect(() => {
    async function initConfig() {
      try {
        const config = await getConfig();
        setTheme(config.theme);
        setLanguage(config.language);
        setAlgorithm(config.algorithm);

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

          // 回填文件列表状态（供状态色与「比较哈希值」使用）
          updateFileByPath(
            payload.filePath,
            payload.hashValue,
            payload.status,
            payload.errorMessage,
          );
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
          setLastResults(payload.results);
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
    setLastResults,
    updateFileByPath,
  ]);

  // 监听自定义事件（菜单栏和侧边栏触发）
  useEffect(() => {
    const onShowHistory = () => setShowHistory(true);
    const onShowSettings = () => setShowSettings(true);
    const onShowQuickGuide = () => setShowQuickGuide(true);
    const onExportResults = () => setShowExport(true);
    const onClearHistory = async () => {
      const ok = await ask(t("clear_history_confirm"), { title: t("warning") });
      if (!ok) return;
      try {
        await apiClearHistory();
        addToast("success", t("history_cleared"));
      } catch {
        addToast("error", t("clear_history_failed"));
      }
    };
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
      {/* 左侧边栏 */}
      <Sidebar
        onShowHistory={() => setShowHistory(true)}
        onShowSettings={() => setShowSettings(true)}
      />

      {/* 右侧主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 菜单栏 */}
        <MenuBar />

        {/* 顶部标题栏 */}
        <Header />

        {/* 中间内容区 */}
        <ContentArea />

        {/* 底部状态栏 */}
        <StatusBar />
      </div>

      {/* 对话框 */}
      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <QuickGuideDialog open={showQuickGuide} onOpenChange={setShowQuickGuide} />
      <ExportDialog open={showExport} onOpenChange={setShowExport} />
      <ToastHost />
    </MainLayout>
  );
}

export default App;
