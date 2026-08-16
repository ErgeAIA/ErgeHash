import { useTranslation } from "react-i18next";
import {
  SHORTCUT_BINDINGS,
  formatShortcut,
  type CommandId,
} from "@/lib/shortcuts";

/** 支持算法（名称固定，描述为 i18n；说明用途属用法，归指南） */
const ALGORITHMS: { name: string; key: string }[] = [
  { name: "SHA-256", key: "sha256" },
  { name: "SHA-512", key: "sha512" },
  { name: "SHA-1", key: "sha1" },
  { name: "MD5", key: "md5" },
  { name: "CRC32", key: "crc32" },
];

/** 快捷键展示（CommandId 单一数据源，标签走 i18n） */
const SHORTCUTS: { cmd: CommandId; labelKey: string }[] = [
  { cmd: "open_file", labelKey: "menu_open" },
  { cmd: "batch_process", labelKey: "guide_open_folder" },
  { cmd: "import_verify", labelKey: "menu_import_verify" },
  { cmd: "start_verify", labelKey: "start_verify" },
  { cmd: "copy_hash", labelKey: "menu_copy" },
  { cmd: "export_results", labelKey: "menu_export" },
  { cmd: "show_history", labelKey: "menu_history" },
  { cmd: "clear_history", labelKey: "menu_clear_history" },
  { cmd: "toggle_theme", labelKey: "guide_toggle_theme" },
  { cmd: "toggle_language", labelKey: "guide_toggle_language" },
  { cmd: "guide", labelKey: "menu_guide" },
  { cmd: "toggle_sidebar", labelKey: "guide_toggle_sidebar" },
  { cmd: "show_settings", labelKey: "guide_open_settings" },
  { cmd: "quit", labelKey: "menu_exit" },
  { cmd: "clear_list", labelKey: "guide_clear_list" },
];

/** 键盘徽章 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </kbd>
  );
}

/** 区块标题（品牌色竖条） */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
      <span className="inline-block h-4 w-1 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

/** 子标题 */
function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 mt-3 text-sm font-medium text-foreground">{children}</h3>
  );
}

/** 段落 */
function Para({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  );
}

/** 快速指南正文（React 组件，跟随主题 CSS 变量，文案走 i18n） */
export function QuickGuideContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const sc = (cmd: CommandId) => formatShortcut(SHORTCUT_BINDINGS[cmd]);

  return (
    <div className="space-y-6 pb-2">
      {/* 头部介绍（不含版本号，版本归设置「关于」） */}
      <section className="rounded-xl border border-border bg-primary-alpha px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">
          {t("guide_intro")}
        </p>
      </section>

      {/* 核心功能 */}
      <section>
        <SectionTitle>{t("guide_core")}</SectionTitle>

        <SubTitle>{t("guide_core_compute")}</SubTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            {t("guide_step_add", {
              openFile: sc("open_file"),
              openFolder: sc("batch_process"),
            })}
          </li>
          <li>{t("guide_step_algo")}</li>
          <li>{t("guide_step_start", { start: sc("start_verify") })}</li>
        </ol>

        <SubTitle>{t("guide_core_verify")}</SubTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            {t("guide_step_import", { import: sc("import_verify") })}
          </li>
          <li>{t("guide_step_compare", { start: sc("start_verify") })}</li>
        </ol>

        <SubTitle>{t("guide_core_context")}</SubTitle>
        <Para>{t("guide_context_desc")}</Para>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("guide_context_calc")}</li>
          <li>{t("guide_context_compare")}</li>
          <li>{t("guide_context_verify")}</li>
        </ul>
      </section>

      {/* 支持算法（说明用途属用法，归指南；设置页不再重复） */}
      <section>
        <SectionTitle>{t("guide_algorithms")}</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALGORITHMS.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="font-mono text-sm font-medium text-primary">
                {a.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`guide_algo_${a.key}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 快捷键 */}
      <section>
        <SectionTitle>{t("guide_shortcuts")}</SectionTitle>
        <div className="space-y-1.5">
          {SHORTCUTS.map(({ cmd, labelKey }) => (
            <div
              key={cmd}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <Kbd>{formatShortcut(SHORTCUT_BINDINGS[cmd])}</Kbd>
              <span className="text-sm text-foreground">{t(labelKey)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 主题与设置（仅说明如何切换，详细配置归设置页） */}
      <section>
        <SectionTitle>{t("guide_theme")}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("guide_theme_desc")}</li>
        </ul>
      </section>

      {/* 反馈（指向设置「关于」，避免与设置页重复；点击直接跳转并关闭指南） */}
      <section>
        <SectionTitle>{t("guide_feedback")}</SectionTitle>
        <Para>
          {t("guide_feedback_hint")}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("show-settings"));
              onClose();
            }}
            className="ml-1 text-primary hover:underline"
          >
            {t("settings_title")} → {t("about_title")}
          </button>
        </Para>
      </section>
    </div>
  );
}
