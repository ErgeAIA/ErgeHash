import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

/* 状态栏组件 */
function StatusBar() {
  const { t } = useTranslation();
  const statusMessage = useAppStore((s) => s.statusMessage);

  /* 实时时钟，每秒更新 */
  const [time, setTime] = useState(() => {
    const now = new Date();
    return formatTime(now);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* 格式化时间为 HH:MM:SS */
  function formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /* 将状态消息键转换为显示文本 */
  function getStatusText(msg: string): string {
    return t(msg);
  }

  return (
    <footer
      className={cn(
        "flex h-6 shrink-0 items-center justify-between border-t border-border px-3 text-xs text-muted-foreground",
      )}
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* 左侧状态消息 */}
      <span>{getStatusText(statusMessage)}</span>

      {/* 右侧时钟 */}
      <span>{time}</span>
    </footer>
  );
}

export { StatusBar };
