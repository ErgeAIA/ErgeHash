import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Binary,
  CheckCheck,
  ListX,
  FolderOpen,
  FileInput,
  NotepadText,
  Info,
  Zap,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { openNotepad, openFileDialog } from "@/services/api";
import { handleDroppedPaths } from "@/lib/dropHandler";
import { Tooltip } from "@/components/ui/Tooltip";
import type { HashAlgorithm } from "@/services/types";
import { ALGO_COLOR_CLASS } from "@/lib/constants";

/* 算法选项列表（含 CRC32，见 docs/architecture-multi-algo.md §7.1） */
const ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: "sha256", label: "SHA-256" },
  { value: "sha512", label: "SHA-512" },
  { value: "sha1", label: "SHA-1" },
  { value: "md5", label: "MD5" },
  { value: "crc32", label: "CRC32" },
];

interface NavRailProps {
  /** 是否折叠为 64px 图标栏 */
  collapsed: boolean;
  /** 切换折叠状态 */
  onToggleCollapsed: () => void;
}

/** 左侧导航栏：LOGO + 算法选择 + 功能组（记事本/打开文件/导入验证/自动检验/动画）+ 底部关于/退出。
 *  历史/主题/语言在顶栏提供快捷访问，导出在结果区与顶栏菜单提供。 */
export function NavRail({ collapsed, onToggleCollapsed }: NavRailProps) {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const selectedAlgorithms = useAppStore((s) => s.selectedAlgorithms);
  const toggleAlgorithm = useAppStore((s) => s.toggleAlgorithm);
  const selectAllAlgorithms = useAppStore((s) => s.selectAllAlgorithms);
  const deselectAllAlgorithms = useAppStore((s) => s.deselectAllAlgorithms);
  const autoCalculate = useAppStore((s) => s.autoCalculate);
  const toggleAutoCalculate = useAppStore((s) => s.toggleAutoCalculate);
  const animations = useAppStore((s) => s.animations);
  const toggleAnimations = useAppStore((s) => s.toggleAnimations);
  const biliBtnRef = useRef<HTMLButtonElement>(null);
  const qrPopupRef = useRef<HTMLDivElement>(null);
  const qrHoverTimer = useRef<number | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrPos, setQrPos] = useState({ x: 0, y: 0 });

  const QR_EST_W = 288;
  const QR_EST_H = 320;

  const updateQrPosition = useCallback(() => {
    const btn = biliBtnRef.current;
    const popup = qrPopupRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const pw = popup?.offsetWidth ?? QR_EST_W;
    const ph = popup?.offsetHeight ?? QR_EST_H;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x: number;
    let y: number;
    if (collapsed) {
      // 收起态：在 B站徽章右侧垂直居中
      x = rect.right + 12;
      y = rect.top + rect.height / 2 - ph / 2;
    } else {
      // 展开态：在 B站徽章上方水平居中
      x = rect.left + rect.width / 2 - pw / 2;
      y = rect.top - ph - 12;
    }
    // 视口边界防溢出
    x = Math.max(12, Math.min(x, vw - pw - 12));
    y = Math.max(12, Math.min(y, vh - ph - 12));
    setQrPos({ x, y });
  }, [collapsed]);

  const showQr = useCallback(() => {
    if (qrHoverTimer.current) window.clearTimeout(qrHoverTimer.current);
    qrHoverTimer.current = null;
    setQrVisible(true);
  }, []);

  const hideQr = useCallback(() => {
    if (qrHoverTimer.current) window.clearTimeout(qrHoverTimer.current);
    qrHoverTimer.current = window.setTimeout(() => setQrVisible(false), 120);
  }, []);

  useLayoutEffect(() => {
    if (qrVisible) updateQrPosition();
  }, [qrVisible, updateQrPosition]);

  useEffect(() => {
    if (!qrVisible) return;
    const handleResize = () => setQrVisible(false);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [qrVisible]);

  const openFile = async () => {
    const files = await openFileDialog();
    if (files && files.length > 0) handleDroppedPaths(files, t);
  };

  /* 导航项 / 算法项通用样式
   * 选中态：左竖条（border-l 等价实现）+ 品牌色文字 + 品牌 tint 底
   * 未选中：灰文字，hover 只变品牌色文字（不变底色） */
  const navItemClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-[15px] font-medium transition-colors duration-100",
      collapsed && "justify-center px-0",
      active
        ? "nav-active-indicator relative text-primary bg-primary-alpha before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']"
        : "text-muted-foreground hover:text-primary",
    );

  const allSelected = selectedAlgorithms.length === ALGORITHMS.length;
  const onlyOneSelected = selectedAlgorithms.length === 1;

  return (
    <aside
      className="flex w-full flex-1 flex-col overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* 顶部 LOGO：点击切换侧栏折叠/展开 */}
      <Tooltip label={t("app_desc")}>
        <button
          type="button"
          aria-label={collapsed ? t("expand_sidebar") : t("collapse_sidebar")}
          onClick={onToggleCollapsed}
          className="flex h-12 w-full shrink-0 items-center justify-center px-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {collapsed ? (
            <img
              src="/app.svg"
              alt="ErgeHash"
              className="h-7 w-7 shrink-0"
            />
          ) : (
            <img
              src={
                theme === "dark"
                  ? "/ergehash-logo-horizontal.svg"
                  : "/ergehash-logo-horizontal-light.svg"
              }
              alt="ErgeHash"
              className="h-7 w-auto max-w-full shrink-0"
            />
          )}
        </button>
      </Tooltip>

      {/* 滚动区：仅算法选择 */}
      <nav className="scrollbar-none flex-1 overflow-y-auto px-2 pb-2">
        {/* 算法选择组 */}
        <div className="mb-2 mt-2">
          {collapsed ? (
            <div className="flex justify-center">
              <Tooltip label={t("algorithms")}>
                <button
                  onClick={onToggleCollapsed}
                  aria-label={t("algorithms")}
                  className="nav-icon-btn h-9 w-9"
                >
                  <Binary className="h-5 w-5" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("algorithms")}
                </span>
                <div className="flex items-center gap-1">
                  <Tooltip label={t("select_all")} disabled={allSelected}>
                    <button
                      type="button"
                      aria-label={t("select_all")}
                      onClick={selectAllAlgorithms}
                      disabled={allSelected}
                      className={cn(
                        "inline-flex h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium transition-colors",
                        allSelected
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary hover:bg-primary/25",
                      )}
                    >
                      <CheckCheck size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip label={t("deselect_all")} disabled={onlyOneSelected}>
                    <button
                      type="button"
                      aria-label={t("deselect_all")}
                      onClick={deselectAllAlgorithms}
                      disabled={onlyOneSelected}
                      className={cn(
                        "inline-flex h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium transition-colors",
                        onlyOneSelected
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary hover:bg-primary/25",
                      )}
                    >
                      <ListX size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo.value}
                    onClick={() => toggleAlgorithm(algo.value)}
                    className={navItemClass(selectedAlgorithms.includes(algo.value))}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${ALGO_COLOR_CLASS[algo.value]}`}
                      aria-hidden="true"
                    />
                    <span>{algo.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 文件组：记事本 + 打开文件 + 导入验证文件（折叠时仅图标） */}
        <div className="mb-2 mt-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5">
              <Tooltip label={t("notepad")}>
                <button
                  type="button"
                  aria-label={t("notepad")}
                  onClick={() => void openNotepad()}
                  className="nav-icon-btn h-9 w-9"
                >
                  <NotepadText className="h-5 w-5" />
                </button>
              </Tooltip>
              <Tooltip label={t("menu_open")}>
                <button
                  type="button"
                  aria-label={t("menu_open")}
                  onClick={() => void openFile()}
                  className="nav-icon-btn h-9 w-9"
                >
                  <FolderOpen className="h-5 w-5" />
                </button>
              </Tooltip>
              <Tooltip label={t("menu_import_verify")}>
                <button
                  type="button"
                  aria-label={t("menu_import_verify")}
                  onClick={() => window.dispatchEvent(new CustomEvent("import-verification"))}
                  className="nav-icon-btn h-9 w-9"
                >
                  <FileInput className="h-5 w-5" />
                </button>
              </Tooltip>
              <Tooltip label={t("auto_calculate")}>
                <button
                  type="button"
                  aria-label={t("auto_calculate")}
                  onClick={toggleAutoCalculate}
                  className={cn(
                    "nav-icon-btn h-9 w-9",
                    autoCalculate &&
                      "nav-active-indicator relative text-primary bg-primary-alpha before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']",
                  )}
                >
                  <Zap className="h-5 w-5" />
                </button>
              </Tooltip>
              <Tooltip label={t("enable_animations")}>
                <button
                  type="button"
                  aria-label={t("enable_animations")}
                  onClick={toggleAnimations}
                  className={cn(
                    "nav-icon-btn h-9 w-9",
                    animations &&
                      "nav-active-indicator relative text-primary bg-primary-alpha before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']",
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {t("nav_feature")}
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => void openNotepad()}
                  className="menu-item text-[15px] font-medium"
                >
                  <NotepadText className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span>{t("notepad")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void openFile()}
                  className="menu-item text-[15px] font-medium"
                >
                  <FolderOpen className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span>{t("menu_open")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("import-verification"))}
                  className="menu-item text-[15px] font-medium"
                >
                  <FileInput className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span>{t("menu_import_verify")}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleAutoCalculate}
                  className={navItemClass(autoCalculate)}
                >
                  <Zap className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span>{t("nav_auto_check")}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleAnimations}
                  className={navItemClass(animations)}
                >
                  <Sparkles className="h-[18px] w-[18px] shrink-0 opacity-70" />
                  <span>{t("nav_animations")}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* 底部：关于 / B站 */}
      <div
        className={cn(
          "relative shrink-0 px-2 pb-2 pt-1",
          collapsed ? "flex flex-col items-center gap-2" : "flex flex-row items-center justify-center gap-2",
        )}
      >
        <Tooltip label={t("about_qr_bilibili")}>
          <button
            ref={biliBtnRef}
            type="button"
            aria-label={t("about_qr_bilibili")}
            onMouseEnter={showQr}
            onMouseLeave={hideQr}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-muted text-foreground transition-colors hover:border hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            <img
              src="/bilibili-ico.png"
              alt=""
              className="h-6 w-6 object-contain"
            />
          </button>
        </Tooltip>
        <Tooltip label={t("about_title")}>
          <button
            type="button"
            aria-label={t("about_title")}
            onClick={() => window.dispatchEvent(new CustomEvent("show-about"))}
            className="nav-icon-btn h-10 w-10"
          >
            <Info className="h-6 w-6" />
          </button>
        </Tooltip>

        {/* B站二维码悬浮弹窗（portal 渲染到 body，避免侧栏 overflow-hidden 裁剪） */}
        {qrVisible &&
          createPortal(
            <div
              ref={qrPopupRef}
              onMouseEnter={showQr}
              onMouseLeave={hideQr}
              className="fixed z-50 rounded-xl border border-border bg-card p-4 shadow-lg"
              style={{ left: qrPos.x, top: qrPos.y }}
            >
              <div className="rounded-lg bg-white p-1">
                <img
                  src="/qr-bilibili.png"
                  alt={t("about_qr_bilibili")}
                  className="h-64 w-64 object-contain"
                />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {t("about_qr_bilibili")}
              </p>
            </div>,
            document.body,
          )}
      </div>
    </aside>
  );
}
