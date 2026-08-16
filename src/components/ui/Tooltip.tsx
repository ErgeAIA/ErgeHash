import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** 提示内容。空字符串 / undefined / disabled 时整个提示不渲染。 */
  label?: ReactNode;
  /** 触发元素（图标按钮、文字按钮或 flex-1 truncate 文本等）。 */
  children: ReactNode;
  /** 禁用提示（如 disabled 按钮）。 */
  disabled?: boolean;
  /** 附加到包裹 span 的类名。包裹 flex-1 truncate 弹性元素时传 "flex-1 min-w-0"。 */
  className?: string;
}

const GAP = 12;

/**
 * 品牌色 Hover 提示（替代原生 title）。
 * - 跟随鼠标右下 12px 偏移，视口边缘自动翻转
 * - portal 渲染到 body，不被 overflow/滚动裁剪
 * - 卡片底 + 边框 + 左侧品牌竖线贯穿全部行 + 280px 内自动换行
 * - 150ms 淡入，且自动接入 .animations-off / prefers-reduced-motion 双层无障碍开关
 * - role="tooltip"；被包裹元素请务必补足 aria-label（禁止原生 title 残留）
 */
export function Tooltip({ label, children, disabled, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const hasLabel = label != null && label !== "" && !disabled;

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const el = tooltipRef.current;
    const tw = el?.offsetWidth ?? 280;
    const th = el?.offsetHeight ?? 40;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let px = clientX + GAP;
    let py = clientY + GAP;
    // 右侧不足翻到光标左侧
    if (px + tw > vw - 8) px = clientX - GAP - tw;
    // 下方不足翻到上方
    if (py + th > vh - 8) py = clientY - GAP - th;

    setCoords({ x: Math.max(8, px), y: Math.max(8, py) });
  }, []);

  const show = useCallback(
    (e: React.MouseEvent | React.FocusEvent) => {
      if (!hasLabel) return;
      setVisible(true);
      if ("clientX" in e) {
        updatePosition(e.clientX, e.clientY);
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        updatePosition(rect.left + rect.width / 2, rect.top + rect.height);
      }
    },
    [hasLabel, updatePosition],
  );

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const close = () => setVisible(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [visible]);

  return (
    <>
      <span
        className={className ?? "inline-flex flex-shrink-0"}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onMouseMove={(e) => visible && updatePosition(e.clientX, e.clientY)}
      >
        {children}
      </span>
      {hasLabel &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={`erge-tooltip${visible ? " erge-tooltip--visible" : ""}`}
            style={{ left: coords.x, top: coords.y }}
          >
            <span className="erge-tooltip__bar" aria-hidden="true" />
            <span className="erge-tooltip__content min-w-0">{label}</span>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Tooltip;
