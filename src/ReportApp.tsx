import { useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useTranslation } from "react-i18next";
import { Tooltip } from "./components/ui/Tooltip";
import { getConfig, addHistory } from "./services/api";
import type { HashAlgorithm } from "./services/types";
import i18n from "@/i18n";

interface CtxRequest {
  operation: string;
  algorithm: string;
  paths: string[];
}

interface HashResult {
  filePath: string;
  algorithm: string;
  hashValue: string;
  elapsedTime: number;
  status: string;
  fromCache: boolean;
  errorMessage: string | null;
}

interface VerifyResult {
  filePath: string;
  algorithm: string;
  expected: string;
  actual: string;
  status: string; // match | mismatch | error
  errorMessage: string | null;
}

const ALGO_LABELS: Record<string, string> = {
  SHA256: "SHA-256",
  MD5: "MD5",
  SHA1: "SHA-1",
  SHA512: "SHA-512",
  Crc32: "CRC32",
};

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i >= 0 ? p.slice(i + 1) : p;
}

function algoLabel(s: string): string {
  return ALGO_LABELS[s.toUpperCase()] ?? s;
}

export default function ReportApp() {
  const { t } = useTranslation();
  const [req, setReq] = useState<CtxRequest | null>(null);
  const [results, setResults] = useState<HashResult[]>([]);
  const [verifyResults, setVerifyResults] = useState<VerifyResult[]>([]);
  const [copied, setCopied] = useState(false);
  // closingRef：拦截 onCloseRequested 递归。主窗口已显示时，先 preventDefault 再主动
  // close() 会再次触发本监听，需用此标记放行「真正关闭」，否则窗口关不掉且陷入死循环。
  // mainRevealedRef：标记主窗口是否已打开，决定关闭时仅关报告窗还是退出整进程。
  const closingRef = useRef(false);
  const mainRevealedRef = useRef(false);

  useEffect(() => {
    const win = getCurrentWindow();
    // 任何关闭方式（按钮 / Alt+F4 / ESC）都阻止默认关闭，改由前端显式处理：
    // 无主窗口时退出进程，有主窗口时仅关闭 report 窗。
    const unlistenClose = win.onCloseRequested((event) => {
      if (closingRef.current) {
        // 二次触发（主动 close 引起）：放行真正的关闭，避免递归死循环。
        return;
      }
      closingRef.current = true;
      event.preventDefault();
      // 阻止默认关闭后主动 close()，会二次触发本监听；closingRef 已置位，二次放行。
      // 主窗口未打开时，Rust 端监听 WindowEvent::Destroyed 在 report 窗销毁后退出进程。
      getCurrentWindow().close().catch(() => {});
    });

    // ESC 关闭报告窗。
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);

    // 拉取并渲染一次右键请求；挂载时调用一次，收到 context-updated 事件（重复右键复用窗口）
    // 时再次调用，避免显示上一次的旧数据。
    const load = async () => {
      let r: CtxRequest;
      try {
        r = (await invoke("get_context_request")) as CtxRequest;
      } catch {
        return;
      }
      setReq(r);
      if (r.operation === "verify") {
        const all: VerifyResult[] = [];
        for (const cf of r.paths) {
          try {
            const list = (await invoke("verify_checksum_file", {
              checksumFile: cf,
            })) as VerifyResult[];
            all.push(...list);
          } catch (e) {
            // 单个校验文件解析失败不应中断其余文件：记录一条 error 占位继续
            all.push({
              filePath: cf,
              algorithm: "",
              expected: "",
              actual: "",
              status: "error",
              errorMessage: `解析失败: ${String(e)}`,
            });
          }
        }
        setVerifyResults(all);
        const text = all
          .map(
            (x) =>
              `${basename(x.filePath)}\t[${algoLabel(x.algorithm)}]\t${x.status}`,
          )
          .join("\n");
        if (text) {
          try {
            await writeText(text);
            setCopied(true);
          } catch {
            /* 剪贴板不可用时静默 */
          }
        }
        return;
      }
      const res = (await invoke("compute_hashes", {
        paths: r.paths,
        algorithm: r.algorithm,
      })) as HashResult[];
      setResults(res);
      // 右键计算 / 对比结果也写入主窗口历史记录（按 路径+算法 去重更新）。
      res
        .filter((x) => x.status === "success")
        .forEach((x) => {
          addHistory({
            filePath: x.filePath,
            algorithm: x.algorithm as HashAlgorithm,
            hashValue: x.hashValue,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        });
      const text = res
        .filter((x) => x.status === "success")
        .map((x) => x.hashValue)
        .join("\n");
      if (text) {
        try {
          await writeText(text);
          setCopied(true);
        } catch {
          /* 剪贴板不可用时静默 */
        }
      }
    };

    load();

    const unlistenEvt: Promise<UnlistenFn> = listen("context-updated", () => {
      load();
    });

    return () => {
      unlistenClose.then((fn) => fn());
      unlistenEvt.then((fn) => fn());
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // 报告窗与主窗口是独立 WebView，不会继承主窗口的 dark class / 语言，
  // 因此需在挂载时从后端配置同步，避免弹窗始终是亮色、语言不跟随。
  useEffect(() => {
    getConfig()
      .then((config) => {
        const root = document.documentElement;
        if (config.theme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
        i18n.changeLanguage(config.language);
      })
      .catch(() => {});
  }, []);

  // 关闭报告窗：直接关闭窗口。窗口关闭触发 onCloseRequested → maybe_exit 决定进程是否退出
  // （主窗口未打开则整进程退出；已打开则保留，由主窗口生命周期决定）。注意不能只调 maybe_exit：
  // 主窗口已打开时 maybe_exit 是空操作，✕ 按钮会失效不关窗。
  const close = () => {
    getCurrentWindow()
      .close()
      .catch(() => invoke("maybe_exit").catch(() => {}));
  };
  const openMain = () => {
    mainRevealedRef.current = true;
    invoke("reveal_main_window")
      .catch(() => {})
      .finally(() => close());
  };

  const copyAll = async () => {
    if (req?.operation === "verify") {
      const text = verifyResults
        .map((x) => {
          if (x.status === "match") {
            return `${basename(x.filePath)}\t[${algoLabel(x.algorithm)}]\t${t("report_verify_ok")}`;
          }
          return `${basename(x.filePath)}\t[${algoLabel(x.algorithm)}]\t${x.status}\n  期望: ${x.expected}\n  实际: ${x.actual}`;
        })
        .join("\n");
      if (text) {
        try {
          await writeText(text);
          setCopied(true);
        } catch {
          /* 忽略 */
        }
      }
      return;
    }
    const text = results
      .filter((x) => x.status === "success")
      .map((x) => `${x.hashValue}  ${basename(x.filePath)}`)
      .join("\n");
    if (text) {
      try {
        await writeText(text);
        setCopied(true);
      } catch {
        /* 忽略 */
      }
    }
  };

  // ===== 校验文件模式 =====
  if (req?.operation === "verify") {
    const ok = verifyResults.filter((x) => x.status === "match").length;
    const mismatch = verifyResults.filter((x) => x.status === "mismatch").length;
    const errors = verifyResults.filter((x) => x.status === "error").length;
    const total = verifyResults.length;
    const allPass = total > 0 && mismatch === 0 && errors === 0;

    const bannerStyle: CSSProperties = allPass
      ? {
          color: "var(--success)",
          backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)",
          borderColor: "var(--success)",
        }
      : {
          color: "var(--destructive)",
          backgroundColor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
          borderColor: "var(--destructive)",
        };

    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <div
          onMouseDown={() => getCurrentWindow().startDragging()}
          className="flex shrink-0 cursor-move items-center justify-between border-b border-border px-4 py-2.5"
        >
          <span className="text-sm font-semibold">{t("report_title_verify")}</span>
          <button
            onClick={close}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
            aria-label={t("report_close")}
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
              {t("report_verify_count", { count: total })}
            </span>
            {copied && <span className="text-primary">{t("report_copied")}</span>}
          </div>

          <div
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium"
            style={bannerStyle}
          >
            {total === 0
              ? t("report_verify_empty")
              : allPass
                ? t("report_verify_all_pass", { count: ok })
                : t("report_verify_summary", {
                    ok,
                    mismatch,
                    error: errors,
                  })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {verifyResults.map((r, idx) => {
              const color =
                r.status === "match"
                  ? "var(--success)"
                  : r.status === "mismatch"
                    ? "var(--destructive)"
                    : "var(--warning)";
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-panel p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Tooltip label={r.filePath}>
                      <div className="truncate text-xs font-medium text-foreground">
                        {basename(r.filePath)}
                      </div>
                    </Tooltip>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        color,
                        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                      }}
                    >
                      {r.status === "match"
                        ? t("report_verify_ok")
                        : r.status === "mismatch"
                          ? t("report_verify_mismatch")
                          : t("report_verify_error")}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {algoLabel(r.algorithm)}
                  </div>
                  {r.status === "error" ? (
                    <div className="mt-1 text-xs" style={{ color }}>
                      {r.errorMessage || t("report_error")}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-baseline gap-2 text-[11px]">
                        <span className="shrink-0 text-muted-foreground">
                          {t("report_verify_expected")}
                        </span>
                        <code className="block min-w-0 break-all font-mono text-[12px] text-muted-foreground">
                          {r.expected}
                        </code>
                      </div>
                      <div className="flex items-baseline gap-2 text-[11px]">
                        <span className="shrink-0 text-muted-foreground">
                          {t("report_verify_actual")}
                        </span>
                        <code
                          className="block min-w-0 flex-1 break-all font-mono text-[12px]"
                          style={{ color }}
                        >
                          {r.actual}
                        </code>
                        <button
                          onClick={async () => {
                            try {
                              await writeText(r.actual);
                              setCopied(true);
                            } catch {
                              /* 忽略 */
                            }
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-primary-alpha hover:text-primary"
                          aria-label={t("report_copy")}
                        >
                          ⧉
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {verifyResults.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {t("report_computing")}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            onClick={copyAll}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-primary-alpha hover:text-primary"
          >
            {t("report_copy_all")}
          </button>
          <button
            onClick={openMain}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("report_open_main")}
          </button>
        </div>
      </div>
    );
  }

  // ===== 计算 / 比较模式 =====
  const success = results.filter((x) => x.status === "success");
  const distinct = new Set(success.map((x) => x.hashValue)).size;
  const allMatch = success.length > 1 && distinct === 1;
  const isCompare = req?.operation === "compare";

  const bannerStyle: CSSProperties = allMatch
    ? {
        color: "var(--success)",
        backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)",
        borderColor: "var(--success)",
      }
    : {
        color: "var(--destructive)",
        backgroundColor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
        borderColor: "var(--destructive)",
      };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
      {/* 标题栏（可拖拽，无系统边框） */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        className="flex shrink-0 cursor-move items-center justify-between border-b border-border px-4 py-2.5"
      >
        <span className="text-sm font-semibold">
          {isCompare ? t("report_title_compare") : t("report_title_compute")}
        </span>
        <button
          onClick={close}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
          aria-label={t("report_close")}
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        {/* 算法 + 文件数 */}
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
            {req ? algoLabel(req.algorithm) : ""}
          </span>
          <span>
            {t("report_file_count", { count: results.length })}
          </span>
          {copied && (
            <span className="text-primary">{t("report_copied")}</span>
          )}
        </div>

        {/* 比较结论 */}
        {isCompare && success.length > 1 && (
          <div
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium"
            style={bannerStyle}
          >
            {allMatch
              ? t("report_all_match", { count: success.length })
              : t("report_differ", { count: distinct })}
          </div>
        )}

        {/* 结果列表 */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {results.map((r, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-border bg-panel p-2.5"
            >
              <Tooltip label={r.filePath}>
                <div className="truncate text-xs text-muted-foreground">
                  {basename(r.filePath)}
                </div>
              </Tooltip>
              {r.status === "success" ? (
                <div className="mt-1 flex items-start gap-2">
                  <code className="block w-full min-w-0 break-all font-mono text-[13px] leading-relaxed text-foreground">
                    {r.hashValue}
                  </code>
                  <button
                    onClick={async () => {
                      try {
                        await writeText(r.hashValue);
                        setCopied(true);
                      } catch {
                        /* 忽略 */
                      }
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-primary-alpha hover:text-primary"
                    aria-label={t("report_copy")}
                  >
                    ⧉
                  </button>
                </div>
              ) : (
                <div className="mt-1 text-xs text-destructive">
                  {r.errorMessage || t("report_error")}
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t("report_computing")}
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <button
          onClick={copyAll}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-primary-alpha hover:text-primary"
        >
          {t("report_copy_all")}
        </button>
        <button
          onClick={openMain}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t("report_open_main")}
        </button>
      </div>
    </div>
  );
}
