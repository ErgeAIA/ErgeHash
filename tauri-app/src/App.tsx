import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "./store/appStore";
import { getConfig, clearHistory as apiClearHistory } from "./services/api";
import { onHashProgress, onBatchFileComplete, onBatchComplete } from "./services/api";
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
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function App() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const setAlgorithm = useAppStore((s) => s.setAlgorithm);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);
  const setProgress = useAppStore((s) => s.setProgress);
  const setCurrentFile = useAppStore((s) => s.setCurrentFile);
  const setCalculating = useAppStore((s) => s.setCalculating);
  const setResultText = useAppStore((s) => s.setResultText);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  // 对话框状态
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);

  // 注册全局快捷键
  useKeyboardShortcuts();

  // 初始化：从后端加载配置
  useEffect(() => {
    async function initConfig() {
      try {
        const config = await getConfig();
        if (config.theme === "dark") {
          toggleTheme();
        }
        if (config.language === "en") {
          toggleLanguage();
        }
        setAlgorithm(config.algorithm);
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
          setResultText(
            (prev) =>
              prev +
              `✓ ${fileName}${cacheNote}\n  ${payload.hashValue}${timeNote}\n\n`,
          );
        }),
      );

      unlisteners.push(
        await onBatchComplete((payload) => {
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
  ]);

  // 监听自定义事件（菜单栏和侧边栏触发）
  useEffect(() => {
    const onShowHistory = () => setShowHistory(true);
    const onShowSettings = () => setShowSettings(true);
    const onShowQuickGuide = () => setShowQuickGuide(true);
    const onClearHistory = async () => {
      await apiClearHistory();
    };

    window.addEventListener("show-history", onShowHistory);
    window.addEventListener("show-settings", onShowSettings);
    window.addEventListener("show-quick-guide", onShowQuickGuide);
    window.addEventListener("clear-history", onClearHistory);

    return () => {
      window.removeEventListener("show-history", onShowHistory);
      window.removeEventListener("show-settings", onShowSettings);
      window.removeEventListener("show-quick-guide", onShowQuickGuide);
      window.removeEventListener("clear-history", onClearHistory);
    };
  }, []);

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
    </MainLayout>
  );
}

export default App;
