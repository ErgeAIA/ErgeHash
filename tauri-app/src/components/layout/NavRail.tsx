import { useTranslation } from "react-i18next";
import { Hash, CheckCheck, ListX } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import type { HashAlgorithm } from "@/services/types";

/* 算法选项列表（含 CRC32，见 docs/architecture-multi-algo.md §7.1） */
const ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: "sha256", label: "SHA-256" },
  { value: "md5", label: "MD5" },
  { value: "sha1", label: "SHA-1" },
  { value: "sha512", label: "SHA-512" },
  { value: "crc32", label: "CRC32" },
];

interface NavRailProps {
  /** 是否折叠为 64px 图标栏 */
  collapsed: boolean;
  /** 切换折叠状态 */
  onToggleCollapsed: () => void;
}

/** 左侧导航栏：仅保留 LOGO + 算法选择模块。
 *  历史/工具/主题/语言/设置/退出等入口统一收纳到 ☰ 菜单，
 *  其中历史/工具/主题/语言另在顶栏紧凑按钮组提供快捷访问。 */
export function NavRail({ collapsed, onToggleCollapsed }: NavRailProps) {
  const { t } = useTranslation();
  const selectedAlgorithms = useAppStore((s) => s.selectedAlgorithms);
  const toggleAlgorithm = useAppStore((s) => s.toggleAlgorithm);
  const selectAllAlgorithms = useAppStore((s) => s.selectAllAlgorithms);
  const deselectAllAlgorithms = useAppStore((s) => s.deselectAllAlgorithms);

  /* 导航项 / 算法项通用样式
   * 选中态：左竖条（border-l 等价实现）+ 品牌色文字 + 品牌 tint 底
   * 未选中：灰文字，hover 只变品牌色文字（不变底色） */
  const navItemClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-[15px] font-medium transition-colors duration-100",
      collapsed && "justify-center px-0",
      active
        ? "relative text-primary bg-primary-alpha before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']"
        : "text-muted-foreground hover:text-primary",
    );

  const allSelected = selectedAlgorithms.length === ALGORITHMS.length;
  const onlyOneSelected = selectedAlgorithms.length === 1;

  return (
    <aside
      className="flex w-full flex-1 flex-col overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* 顶部 LOGO（折叠功能移到顶栏，此处仅展示） */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Hash className="h-5 w-5 shrink-0 text-primary" />
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-foreground">
            HashValidatorPlus
          </span>
        )}
      </div>

      {/* 滚动区：仅算法选择 */}
      <nav className="scrollbar-none flex-1 overflow-y-auto px-2 pb-2">
        {/* 算法选择组 */}
        <div className="mb-2">
          {collapsed ? (
            <button
              onClick={onToggleCollapsed}
              title={t("algorithms")}
              className="flex h-9 w-full items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:text-primary"
            >
              <Hash className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("algorithms")}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={t("select_all")}
                    onClick={selectAllAlgorithms}
                    disabled={allSelected}
                    className={cn(
                      "inline-flex h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium transition-colors",
                      allSelected
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary hover:bg-primary/25",
                    )}
                  >
                    <CheckCheck size={12} />
                  </button>
                  <button
                    type="button"
                    title={t("deselect_all")}
                    onClick={deselectAllAlgorithms}
                    disabled={onlyOneSelected}
                    className={cn(
                      "inline-flex h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium transition-colors",
                      onlyOneSelected
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary hover:bg-primary/25",
                    )}
                  >
                    <ListX size={12} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo.value}
                    onClick={() => toggleAlgorithm(algo.value)}
                    className={navItemClass(selectedAlgorithms.includes(algo.value))}
                  >
                    <Hash className="h-[18px] w-[18px] shrink-0 opacity-70" />
                    <span>{algo.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}
