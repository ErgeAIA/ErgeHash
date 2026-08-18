import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const QR_TIP_IMG = "/qr-tip.png";
const QR_FRIEND_IMG = "/qr-friend.png";
const QR_BILIBILI_QR = "/qr-bilibili.png";
const ICO_REWARD = "/reward-ico.png";
const ICO_WECHAT = "/Wechat-ico.png";
const ICO_BILIBILI = "/bilibili-ico.png";

interface EasterEggProps {
  onClose: () => void;
}

const QrButton: React.FC<{
  iconSrc: string;
  qrSrc: string;
  label: string;
}> = memo(({ iconSrc, qrSrc, label }) => {
  const btnRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const EST_W = 224;
  const EST_H = 280;

  const updatePos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const pw = popupRef.current?.offsetWidth ?? EST_W;
    const ph = popupRef.current?.offsetHeight ?? EST_H;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = r.left + r.width / 2 - pw / 2;
    // 优先在按钮下方展开，避免遮挡卡片标题/描述；下方不足才落到上方
    let y = r.bottom + gap;
    if (y + ph > vh - 12) y = r.top - ph - gap;
    x = Math.max(12, Math.min(x, vw - pw - 12));
    y = Math.max(12, Math.min(y, vh - ph - 12));
    setPos({ x, y });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setHovered(true);
  }, []);

  const hide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHovered(false), 120);
  }, []);

  useLayoutEffect(() => {
    if (hovered) updatePos();
  }, [hovered, updatePos]);

  useEffect(() => {
    if (!hovered) return;
    const onResize = () => setHovered(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hovered]);

  return (
    <>
      <div
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="cursor-pointer"
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-[10px] border transition-all duration-200",
            hovered
              ? "scale-110 border-primary bg-primary-alpha"
              : "border-border bg-muted",
          )}
          style={{ width: 48, height: 48 }}
        >
          <img
            src={iconSrc}
            alt=""
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
        </div>
      </div>

      {/* 二维码弹窗：portal 到 body，定位在按钮上方，避免遮挡触发按钮导致闪烁 */}
      {hovered &&
        createPortal(
          <div
            ref={popupRef}
            onMouseEnter={show}
            onMouseLeave={hide}
            className="fixed z-[300] w-56 rounded-xl border border-border bg-card p-3 shadow-lg"
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src={qrSrc}
                alt={label}
                className="block h-auto max-h-[280px] w-full object-contain"
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {label}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
});

const EasterEgg: React.FC<EasterEggProps> = memo(({ onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        data-tauri-drag-region
        onContextMenu={(e) => e.preventDefault()}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[8px]"
      />

      {/* 卡片 */}
      <div
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        className="fixed left-1/2 top-1/2 z-[101] w-[90%] max-w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-8 text-center shadow-lg"
      >
        <div className="mb-3 text-[18px] font-bold text-foreground">
          {t("easter_egg_title")}
        </div>
        <p className="mb-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {t("easter_egg_desc")}
        </p>
        <div className="mb-6 flex items-center justify-center gap-4">
          <QrButton
            iconSrc={ICO_REWARD}
            qrSrc={QR_TIP_IMG}
            label={t("about_qr_tip")}
          />
          <QrButton
            iconSrc={ICO_WECHAT}
            qrSrc={QR_FRIEND_IMG}
            label={t("about_qr_friend")}
          />
          <QrButton
            iconSrc={ICO_BILIBILI}
            qrSrc={QR_BILIBILI_QR}
            label={t("about_qr_bilibili")}
          />
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-border bg-transparent px-5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary-alpha hover:text-primary"
        >
          {t("easter_egg_close")}
        </button>
      </div>
    </>
  );
});

export default EasterEgg;
