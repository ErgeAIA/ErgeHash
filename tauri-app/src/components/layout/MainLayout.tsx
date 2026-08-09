import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* 主布局属性 */
interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

/* 主布局组件：左侧边栏 + 右侧内容区 */
function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-screen overflow-hidden",
        className,
      )}
      style={{ backgroundColor: "var(--background)" }}
    >
      {children}
    </div>
  );
}

export { MainLayout };
