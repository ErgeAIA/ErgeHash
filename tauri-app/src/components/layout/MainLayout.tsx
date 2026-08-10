import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* 主布局属性 */
interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

/* 主布局组件：纵向布局，顶部 TitleBar + 下方横向（Sidebar + 内容区） */
function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div
      className={cn("flex h-screen w-screen flex-col overflow-hidden", className)}
      style={{ backgroundColor: "var(--background)" }}
    >
      {children}
    </div>
  );
}

export { MainLayout };
