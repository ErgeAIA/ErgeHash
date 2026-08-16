import * as React from "react";
import {
  SHORTCUT_BINDINGS,
  formatShortcut,
  type CommandId,
} from "@/lib/shortcuts";

/** 支持算法（名称固定，描述为说明文案） */
const ALGORITHMS: { name: string; desc: string }[] = [
  { name: "SHA-256", desc: "推荐（默认）" },
  { name: "SHA-512", desc: "高安全需求" },
  { name: "SHA-1", desc: "旧系统兼容" },
  { name: "MD5", desc: "快速校验（不推荐安全场景）" },
  { name: "CRC32", desc: "传输校验" },
];

/** 快捷键展示（CommandId 单一数据源，标签为说明文案） */
const SHORTCUTS: { cmd: CommandId; label: string }[] = [
  { cmd: "open_file", label: "打开文件" },
  { cmd: "batch_process", label: "打开文件夹" },
  { cmd: "import_verify", label: "导入校验文件" },
  { cmd: "start_verify", label: "开始校验" },
  { cmd: "copy_hash", label: "复制哈希结果" },
  { cmd: "export_results", label: "导出结果" },
  { cmd: "show_history", label: "历史记录" },
  { cmd: "clear_history", label: "清空历史" },
  { cmd: "toggle_theme", label: "切换主题" },
  { cmd: "toggle_language", label: "切换语言" },
  { cmd: "guide", label: "打开本指南" },
  { cmd: "toggle_sidebar", label: "折叠 / 展开侧栏" },
  { cmd: "show_settings", label: "打开设置" },
  { cmd: "quit", label: "退出" },
  { cmd: "clear_list", label: "清空文件列表" },
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

/** 快速指南正文（React 组件，跟随主题 CSS 变量，风格与主应用一致） */
export function QuickGuideContent() {
  return (
    <div className="space-y-6 pb-2">
      {/* 头部介绍 */}
      <section className="rounded-xl border border-border bg-primary-alpha px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">
          <strong className="text-primary">ErgeHash（二哈）</strong>{" "}
          是一款 Windows 桌面文件哈希校验工具，基于 Tauri 2 + React/TypeScript
          构建，哈希计算由 Rust 原生实现。当前版本 v0.3.0。
        </p>
      </section>

      {/* 核心功能 */}
      <section>
        <SectionTitle>核心功能</SectionTitle>

        <SubTitle>计算哈希</SubTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            添加文件：拖拽文件或文件夹到列表，或按 <Kbd>Ctrl+O</Kbd> 选文件、
            <Kbd>Ctrl+Shift+O</Kbd> 选文件夹。
          </li>
          <li>选择算法：在左侧边栏勾选算法（可多选）。</li>
          <li>
            开始计算：点击「开始校验」或按 <Kbd>Ctrl+Enter</Kbd>
            。结果回填到文件列表，可逐条复制。
          </li>
        </ol>

        <SubTitle>校验文件</SubTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            准备预期哈希：导入校验文件（<Kbd>Ctrl+I</Kbd>，支持
            .md5/.sha256/.sfv 等），或在列表的预期哈希框中粘贴哈希值。
          </li>
          <li>
            开始比对：按 <Kbd>Ctrl+Enter</Kbd>，每行显示匹配 / 不匹配状态。
          </li>
        </ol>

        <SubTitle>资源管理器右键菜单</SubTitle>
        <Para>安装后，在文件上右键可直接调用：</Para>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">计算哈希</strong>
            ：弹出报告窗显示所选文件的哈希值。
          </li>
          <li>
            <strong className="text-foreground">对比文件</strong>
            ：多选文件后右键「对比文件」，报告窗列出全部文件并标明是否一致。
          </li>
          <li>
            <strong className="text-foreground">校验文件</strong>
            ：对校验文件右键，自动解析并比对。
          </li>
        </ul>
      </section>

      {/* 支持算法 */}
      <section>
        <SectionTitle>支持算法</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALGORITHMS.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="font-mono text-sm font-medium text-primary">
                {a.name}
              </span>
              <span className="text-xs text-muted-foreground">{a.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 快捷键 */}
      <section>
        <SectionTitle>快捷键</SectionTitle>
        <div className="space-y-1.5">
          {SHORTCUTS.map(({ cmd, label }) => (
            <div
              key={cmd}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <Kbd>{formatShortcut(SHORTCUT_BINDINGS[cmd])}</Kbd>
              <span className="text-sm text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 主题与设置 */}
      <section>
        <SectionTitle>主题与设置</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">主题</strong>
            ：点击标题栏主题按钮切换亮 / 暗，自动保存。
          </li>
          <li>
            <strong className="text-foreground">设置</strong>：按 <Kbd>Ctrl+,</Kbd>{" "}
            打开设置，可查看版本与支持算法。
          </li>
          <li>
            <strong className="text-foreground">历史记录</strong>：按{" "}
            <Kbd>Ctrl+H</Kbd> 查看，可快速重新计算历史文件。
          </li>
        </ul>
      </section>

      {/* 反馈 */}
      <section>
        <SectionTitle>反馈</SectionTitle>
        <Para>
          开发者：<strong className="text-foreground">B站·宝藏二哥</strong>
          。有建议或问题请反馈至{" "}
          <a
            className="text-primary hover:underline"
            href="mailto:ergeaia@agent.qq.com"
          >
            ergeaia@agent.qq.com
          </a>
          。
        </Para>
      </section>
    </div>
  );
}
