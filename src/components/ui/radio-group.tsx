import * as React from "react";
import { cn } from "@/lib/utils";

/* 单选按钮属性 */
interface RadioItem {
  /** 显示文本 */
  label: string;
  /** 选项值 */
  value: string;
}

/* 单选组属性 */
interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 选项列表 */
  items: RadioItem[];
  /** 当前选中值 */
  value: string;
  /** 选中值变更回调 */
  onValueChange: (value: string) => void;
  /** 选项名称，用于原生 radio 分组 */
  name?: string;
}

/* 单选组组件 */
const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, items, value, onValueChange, name, ...props }, ref) => {
    /* 生成唯一分组名 */
    const groupName = name ?? React.useId();

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1", className)}
        role="radiogroup"
        {...props}
      >
        {items.map((item) => {
          const isChecked = value === item.value;
          return (
            <label
              key={item.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                isChecked && "text-primary font-medium",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={item.value}
                checked={isChecked}
                onChange={() => onValueChange(item.value)}
                className="sr-only"
              />
              {/* 自定义单选圆圈 */}
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isChecked
                    ? "border-primary"
                    : "border-muted-foreground/50",
                )}
              >
                {isChecked && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span>{item.label}</span>
            </label>
          );
        })}
      </div>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

export { RadioGroup, type RadioItem };
