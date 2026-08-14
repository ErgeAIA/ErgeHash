import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import type { TFunction } from "i18next";
import { scanDirectory, importVerificationFile } from "@/services/api";
import { classifyDroppedPaths, MAX_SNIFF } from "@/lib/checksumFile";
import { showImportFeedback } from "@/lib/importFeedback";

/** 单次拖放允许处理的最大文件总数；超出截断并告警，防止 UI 卡死 */
const MAX_DROP = 5000;

/** 同一批次（同路径集合）在去重窗口内的重复触发被忽略（防止拖放事件重复处理） */
const DEDUP_WINDOW_MS = 300;

/** 每嗅探该数量文件后让出事件循环一次，避免拖放句柄长时间独占 */
const SNIFF_YIELD_EVERY = 50;

/** 串行化所有拖放批次，防止并发 drop 导致的 lost-update 与重复 startValidation */
let dropChain: Promise<void> = Promise.resolve();

/** 近期已处理批次的去重表（批次键 → 时间戳） */
const recentBatches = new Map<string, number>();

function batchKey(paths: string[]): string {
  return JSON.stringify([...paths].sort());
}

/** 展开目录为文件列表；目录扫描失败则降级为按原始路径处理 */
async function expandPaths(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      const scanned = await scanDirectory(p);
      if (scanned.length > 0) {
        out.push(...scanned);
        continue;
      }
    } catch {
      // 扫描失败，当作普通文件
    }
    out.push(p);
  }
  return out;
}

/**
 * 统一拖放入口（文件列表区拖放与菜单导入收敛到同一逻辑）：
 * - 目录展开 → 分类 → 校验文件解析(file 模式) + 普通文件哈希(none/single)；
 * - 串行队列 + 去重，根治 D1 双 handler 冲突、D3 竞态、D4 嗅探风暴；
 * - 校验文件本身也会加入 fileList（role=verification），仅展示/回填，不参与 HASH 计算；
 * - autoCalculate 开启时，存在 source 文件即触发一次校验。
 */
export function handleDroppedPaths(paths: string[], t: TFunction): void {
  if (!paths || paths.length === 0) return;

  // 去重：同一路径集合在窗口内重复触发（双 handler）直接忽略
  const key = batchKey(paths);
  const now = Date.now();
  const prev = recentBatches.get(key);
  if (prev !== undefined && now - prev < DEDUP_WINDOW_MS) {
    return;
  }
  recentBatches.set(key, now);
  for (const [k, ts] of recentBatches) {
    if (now - ts >= DEDUP_WINDOW_MS) recentBatches.delete(k);
  }

  // 截断超大批次
  let effective = paths;
  let truncated = false;
  if (paths.length > MAX_DROP) {
    effective = paths.slice(0, MAX_DROP);
    truncated = true;
  }

  dropChain = dropChain
    .then(() => runBatch(effective, t, truncated))
    .catch(() => {
      // 单批次失败不应中断后续队列
    });
}

async function runBatch(paths: string[], t: TFunction, truncated: boolean): Promise<void> {
  const { addFiles, setImportedEntries, setStatusMessage, startValidation } =
    useAppStore.getState();
  const addToast = useToastStore.getState().addToast;

  const expanded = await expandPaths(paths);
  const { checksum, ambiguous, regular } = classifyDroppedPaths(expanded);

  // 校验文件：逐文件解析 + 反馈（与菜单导入一致），并把该校验文件本身加入 fileList 展示
  for (const cp of checksum) {
    try {
      const report = await importVerificationFile(cp);
      showImportFeedback(report, { setImportedEntries, addToast, setStatusMessage, t });
      addFiles([cp], "verification", report.entries);
    } catch {
      addToast("error", t("import_error"));
    }
  }

  // 歧义文件：内容嗅探兜底，受 MAX_SNIFF 上限约束
  const finalRegular = [...regular];
  let sniffSkipped = 0;
  let sniffed = 0;
  let sinceYield = 0;
  for (const ap of ambiguous) {
    if (sniffed >= MAX_SNIFF) {
      sniffSkipped++;
      finalRegular.push(ap);
      continue;
    }
    sniffed++;
    try {
      const report = await importVerificationFile(ap);
      if (report.entries.length > 0) {
        showImportFeedback(report, { setImportedEntries, addToast, setStatusMessage, t });
        addFiles([ap], "verification", report.entries);
      } else {
        finalRegular.push(ap);
      }
    } catch {
      finalRegular.push(ap);
    }
    if (++sinceYield >= SNIFF_YIELD_EVERY) {
      sinceYield = 0;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (finalRegular.length > 0) {
    addFiles(finalRegular);
  }

  // 只要当前列表中存在 source 文件且开启自动计算，就触发校验（覆盖只拖入校验文件到已有源文件的场景）
  if (useAppStore.getState().autoCalculate) {
    const hasSourceFiles = useAppStore
      .getState()
      .fileList.some((f) => f.role !== "verification");
    if (hasSourceFiles) {
      startValidation();
    }
  }

  if (sniffSkipped > 0) {
    addToast("warning", t("import_sniff_skipped", { count: sniffSkipped }));
  }
  if (truncated) {
    addToast("warning", t("import_too_many_files", { max: MAX_DROP }));
  }
}
