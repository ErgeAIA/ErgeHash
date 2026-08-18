import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_VERSION, APP_BILIBILI_URL, APP_GITHUB_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useState, memo } from "react";

/** GitHub 官方 mark（lucide-react 已移除品牌图标，内联以保证显示） */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** 互动图标按钮（悬停显示二维码） */
const QrButton = memo(
  ({
    imgSrc,
    hovered,
    onHover,
  }: {
    imgSrc: string;
    hovered: boolean;
    onHover: (v: boolean) => void;
  }) => (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors",
        hovered
          ? "border-primary bg-primary/10"
          : "border-border bg-muted"
      )}
    >
      <img
        src={imgSrc}
        alt=""
        className="h-[22px] w-[22px] object-contain"
      />
    </div>
  )
);
QrButton.displayName = "QrButton";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 关于对话框 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  const [hoveredQr, setHoveredQr] = useState<"tip" | "friend" | "bilibili" | null>(null);

  /** 打开外部链接 */
  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      // 忽略打开链接失败
    }
  };

  const qrMap: Record<string, { src: string; label: string }> = {
    tip: { src: "/qr-tip.png", label: t("about_qr_tip") },
    bilibili: { src: "/qr-bilibili.png", label: t("about_qr_bilibili") },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t("about_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 space-y-4 min-h-0">
          {/* 关于（ErgeMD 风格） */}
          <section className="relative">
            <div
              className="rounded-[var(--radius)] bg-card p-4 text-foreground"
              onMouseLeave={() => setHoveredQr(null)}
            >
              {/* 应用信息 */}
              <div className="flex items-start gap-3 mb-3">
                <img
                  src="/app.svg"
                  alt="ErgeHash"
                  className="h-16 w-16 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-base font-bold">{t("about_app_name")}</h2>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-primary">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("about_app_description")}
                  </p>
                  <p className="mt-1 text-[11px] italic text-muted-foreground/60">
                    — {t("about_slogan")}
                  </p>
                </div>
              </div>

              {/* 特性标签 */}
              <div className="mb-3 flex flex-wrap justify-center gap-2">
                {[
                  { icon: "🔐", label: t("about_feature1") },
                  { icon: "📥", label: t("about_feature2") },
                  { icon: "⚡", label: t("about_feature3") },
                  { icon: "🖱️", label: t("about_feature4") },
                  { icon: "📄", label: t("about_feature5") },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="my-3 h-px bg-border" />

              {/* 作者名片 */}
              <div className="mb-3">
                <div className="flex justify-center mb-2">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-border bg-muted shadow-[0_0_20px_rgba(0,0,0,0.15)]">
                    <img
                      src="/avatar.png"
                      alt={t("about_author")}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = "none";
                        const parent = img.parentElement;
                        if (parent) {
                          parent.textContent = "😊";
                          parent.className += " flex items-center justify-center text-2xl text-muted-foreground";
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mb-1 text-center text-base font-bold">
                  {t("about_author")}
                </div>
                <p className="mb-2 text-center text-xs italic text-muted-foreground/70">
                  — {t("about_author_quote")}
                </p>
                <div className="mb-3 flex flex-wrap justify-center gap-2">
                  {[
                    t("about_author_tag1"),
                    t("about_author_tag2"),
                    t("about_author_tag3"),
                    t("about_author_tag4"),
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 左右分栏卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 左侧：个人简介 */}
                  <div className="rounded-xl bg-muted/50 p-4 border-l-[3px] border-l-[var(--primary)]">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {t("about_author_bio")}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-4">
                      <QrButton
                        imgSrc="/reward-ico.png"
                        hovered={hoveredQr === "tip"}
                        onHover={(v) => setHoveredQr(v ? "tip" : null)}
                      />
                      <QrButton
                        imgSrc="/bilibili-ico.png"
                        hovered={hoveredQr === "bilibili"}
                        onHover={(v) => setHoveredQr(v ? "bilibili" : null)}
                      />
                    </div>
                  </div>

                  {/* 右侧：B站卡片 */}
                  <div className="rounded-xl bg-muted/50 p-4 text-center border-l-[3px] border-l-pink-500">
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <img
                        src="/bilibili-ico.png"
                        alt="B站"
                        className="h-10 w-10 object-contain"
                      />
                      <span className="text-sm font-semibold">
                        {t("about_bilibili_title")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenLink(APP_BILIBILI_URL)}
                      className="mb-2 inline-flex items-center gap-1 rounded-lg border border-pink-500 bg-transparent px-4 py-1.5 text-xs font-medium text-pink-500 transition-colors hover:bg-pink-500/10"
                    >
                      {t("about_bilibili_button")}
                      <span>↗</span>
                    </button>
                    <p className="whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground/70">
                      {t("about_bilibili_desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* 二维码弹窗 */}
              {hoveredQr && qrMap[hoveredQr] && (
                <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-4 shadow-lg">
                  <div className="rounded-lg bg-white p-1">
                    <img
                      src={qrMap[hoveredQr].src}
                      alt={qrMap[hoveredQr].label}
                      className="h-48 w-48 object-contain"
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {qrMap[hoveredQr].label}
                  </p>
                </div>
              )}

              {/* 底部 */}
              <div className="mt-3 flex items-center justify-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleOpenLink(APP_GITHUB_URL)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2 py-1 transition-colors hover:border-primary hover:text-primary"
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  <span>{t("about_github_star")}</span>
                </button>
                <span className="opacity-40">|</span>
                <span>{t("about_footer")}</span>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
