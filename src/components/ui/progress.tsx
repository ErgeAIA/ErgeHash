import * as React from "react";
import { cn } from "@/lib/utils";

/** 进度条组件属性 */
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 进度值 0-100 */
  value?: number;
}

/** 通用进度条组件 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-3 w-full overflow-hidden rounded-full bg-muted",
          className,
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
