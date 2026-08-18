import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** 是否开启 */
  checked: boolean;
  /** 切换回调 */
  onCheckedChange: (checked: boolean) => void;
  /** 是否始终显示为激活态（轨道使用品牌色），用于二选一开关如主题切换 */
  alwaysActive?: boolean;
}

/** 主题感知的胶囊开关
 *  - 胶囊背景：开启=品牌色(--primary)，关闭=--muted
 *  - 圆点：开启居右、关闭居左；浅色主题白点，深色主题黑点
 *  - 过渡：背景色与圆点位置均带 transition
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, alwaysActive, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out",
          checked || alwaysActive ? "bg-primary" : "bg-muted",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 h-4 w-4 -translate-y-1/2 rounded-full shadow-sm transition-all duration-200 ease-in-out",
            "dark:bg-black bg-white",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
