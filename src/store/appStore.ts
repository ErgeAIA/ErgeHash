import { create } from "zustand";
import type {
  FileItem,
  FileItemStatus,
  FileResult,
  HashAlgorithm,
  HashResult,
  VerificationEntry,
  VerificationParseReport,
} from "../services/types";
import { setConfig, startBatchValidation, getFileSizes } from "../services/api";
import { normalizeExpectedHash } from "@/lib/hash";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useToastStore } from "./toastStore";
import i18n from "@/i18n";

/**
 * 由子结果数组推导父级汇总状态与主导哈希。
 * 规则：error 优先 > mismatch > computed；无子结果则视为未计算。
 */
function aggregateParent(
  results: FileResult[],
): { hashValue?: string; status?: FileItemStatus; errorMessage?: string } {
  if (results.length === 0) {
    return { hashValue: undefined, status: undefined, errorMessage: undefined };
  }
  const lead = results[0];
  let status: FileItemStatus;
  if (results.some((r) => r.status === "error")) status = "error";
  else if (results.some((r) => r.status === "mismatch")) status = "mismatch";
  else if (results.some((r) => r.status === "success")) status = "success";
  else status = "computed";
  const errorMessage = results.map((r) => r.errorMessage).find(Boolean);
  return { hashValue: lead.hashValue, status, errorMessage };
}

/** 取路径中的文件名（兼容 / 与 \\），仅用于校验文件逐文件绑定比较 */
function basename(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

/** 应用状态 */
interface AppState {
  /** 文件列表 */
  fileList: FileItem[];
  /** 当前选中的算法列表 */
  selectedAlgorithms: HashAlgorithm[];
  /** 主题 */
  theme: "light" | "dark";
  /** 语言 */
  language: "zh" | "en";
  /** 拖入文件后是否自动开始校验 */
  autoCalculate: boolean;
  /** 是否启用界面动画 */
  animations: boolean;
  /** 是否正在计算 */
  isCalculating: boolean;
  /** 是否暂停 */
  isPaused: boolean;
  /** 进度 0-100 */
  progress: number;
  /** 当前正在计算的文件 */
  currentFile: string | null;
  /** 结果文本 */
  resultText: string;
  /** 状态栏消息 */
  statusMessage: string;
  /** 预期哈希值 */
  expectedHash: string;
  /**
   * 校验模式：
   * - none: 无预期（仅计算）
   * - single: 预期哈希框（全局集合匹配）
   * - file: 导入的校验文件（逐文件名绑定匹配）
   * 与 importedEntries 互斥共存：导入文件时清空 expectedHash，输入单哈希时清空 importedEntries。
   */
  verificationMode: "none" | "single" | "file";
  /** 导入校验文件解析出的结构化条目（文件名→算法→哈希） */
  importedEntries: VerificationEntry[];
  /** 最近一次批量结果（供导出/复制使用） */
  lastResults: HashResult[] | null;
  /** 当前文件已读取字节数 */
  bytesRead: number;
  /** 当前文件总字节数 */
  totalBytes: number;

  // ---- Actions ----
  /** 添加文件到列表；role=verification 时可传入解析出的 entries，供子级展示 */
  addFiles: (files: string[], role?: "source" | "verification", entries?: VerificationEntry[]) => void;
  /** 移除指定索引的文件 */
  removeFile: (index: number) => void;
  /** 清空文件列表 */
  clearFiles: () => void;
  /** 仅清空计算结果（保留文件列表与预期哈希值） */
  clearResults: () => void;
  /** 清空工作区：文件列表、预期哈希、计算结果 */
  clearAll: () => void;
  /** 切换算法选中状态（持久化） */
  toggleAlgorithm: (algo: HashAlgorithm) => void;
  /** 全选算法 */
  selectAllAlgorithms: () => void;
  /** 全不选算法（至少保留一个默认算法） */
  deselectAllAlgorithms: () => void;
  /** 设置选中的算法列表（持久化） */
  setSelectedAlgorithms: (algos: HashAlgorithm[]) => void;
  /** 设置自动开始校验开关（持久化） */
  setAutoCalculate: (value: boolean) => void;
  /** 设置界面动画开关（持久化） */
  setAnimations: (value: boolean) => void;
  /** 开始校验：验证区有输入时先计算全部文件哈希再逐一比对；为空时仅计算哈希 */
  startValidation: () => Promise<void>;
  /** 直接设置主题（初始化用，不持久化） */
  setTheme: (theme: "light" | "dark") => void;
  /** 直接设置语言（初始化用，不持久化） */
  setLanguage: (language: "zh" | "en") => void;
  /** 切换主题（持久化） */
  toggleTheme: () => void;
  /** 切换语言（持久化） */
  toggleLanguage: () => void;
  /** 设置计算状态 */
  setCalculating: (value: boolean) => void;
  /** 设置暂停状态 */
  setPaused: (value: boolean) => void;
  /** 设置进度 */
  setProgress: (value: number) => void;
  /** 设置当前计算文件 */
  setCurrentFile: (file: string | null) => void;
  /** 设置结果文本，支持直接赋值或函数式更新 */
  setResultText: (text: string | ((prev: string) => string)) => void;
  /** 设置状态栏消息 */
  setStatusMessage: (msg: string) => void;
  /** 按算法维度 upsert 单个结果到文件子结果集合，并重新计算父级汇总状态 */
  updateFileResult: (result: Omit<HashResult, "status"> & { status: FileItemStatus }) => void;
  /** 设置预期哈希值 */
  setExpectedHash: (hash: string) => void;
  /** 写入导入的校验文件条目（原子切到 file 模式，清空单哈希预期，二者互斥） */
  setImportedEntries: (report: VerificationParseReport) => void;
  /** 设置最近一次批量结果 */
  setLastResults: (results: HashResult[] | null) => void;
  /** 设置已读取字节数 */
  setBytesRead: (value: number) => void;
  /** 设置总字节数 */
  setTotalBytes: (value: number) => void;
  /** 复制结果到剪贴板，返回是否成功 */
  copyResult: () => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  fileList: [],
  selectedAlgorithms: ["sha256"],
  theme: "light",
  language: "zh",
  autoCalculate: false,
  animations: true,
  isCalculating: false,
  isPaused: false,
  progress: 0,
  currentFile: null,
  resultText: "",
  statusMessage: "ready",
  expectedHash: "",
  verificationMode: "none",
  importedEntries: [],
  lastResults: null,
  bytesRead: 0,
  totalBytes: 0,

  addFiles: (files, role = "source", entries) => {
    // 在 set 回调内基于最新 state 合并，避免并发 addFiles 的 read-then-set 竞态（D3 lost-update）
    let newPaths: string[] = [];
    set((state) => {
      const existingPaths = new Set(state.fileList.map((f) => f.path));
      const filtered = files.filter((p) => !existingPaths.has(p));
      newPaths = filtered;
      const attachEntries =
        role === "verification" && files.length === 1 && entries && entries.length > 0;
      const newItems: FileItem[] = filtered.map((p) => ({
        path: p,
        role,
        results: [],
        ...(attachEntries ? { entries } : {}),
      }));
      return newItems.length > 0
        ? { fileList: [...state.fileList, ...newItems] }
        : {};
    });
    // 异步批量获取文件大小（不阻塞 UI）
    if (newPaths.length > 0) {
      getFileSizes(newPaths)
        .then((sizes) => {
          set((s) => ({
            fileList: s.fileList.map((f) =>
              f.size === undefined && sizes[f.path] !== undefined
                ? { ...f, size: sizes[f.path] }
                : f,
            ),
          }));
        })
        .catch(() => {
          /* 获取大小失败不影响其余功能 */
        });
    }
  },

  removeFile: (index) =>
    set((state) => ({
      fileList: state.fileList.filter((_, i) => i !== index),
    })),

  clearFiles: () =>
    set((state) => ({
      fileList: [],
      currentFile: null,
      progress: 0,
      bytesRead: 0,
      totalBytes: 0,
      importedEntries: [],
      verificationMode: state.expectedHash.trim() ? "single" : "none",
    })),

  clearResults: () =>
    set((state) => ({
      resultText: "",
      progress: 0,
      currentFile: null,
      lastResults: null,
      bytesRead: 0,
      totalBytes: 0,
      statusMessage: "ready",
      fileList: state.fileList.map((f) => ({ ...f, results: [] })),
    })),

  clearAll: () =>
    set({
      fileList: [],
      expectedHash: "",
      verificationMode: "none",
      importedEntries: [],
      resultText: "",
      progress: 0,
      currentFile: null,
      lastResults: null,
      bytesRead: 0,
      totalBytes: 0,
      statusMessage: "ready",
    }),

  toggleAlgorithm: (algo) =>
    set((state) => {
      const selected = new Set(state.selectedAlgorithms);
      if (selected.has(algo)) {
        if (selected.size > 1) selected.delete(algo);
      } else {
        selected.add(algo);
      }
      const next = Array.from(selected) as HashAlgorithm[];
      void setConfig("algorithm", next.join(","));
      return { selectedAlgorithms: next };
    }),

  selectAllAlgorithms: () =>
    set(() => {
      const next: HashAlgorithm[] = ["sha256", "md5", "sha1", "sha512", "crc32"];
      void setConfig("algorithm", next.join(","));
      return { selectedAlgorithms: next };
    }),

  deselectAllAlgorithms: () =>
    set(() => {
      const next: HashAlgorithm[] = ["sha256"];
      void setConfig("algorithm", next.join(","));
      return { selectedAlgorithms: next };
    }),

  setSelectedAlgorithms: (algos) => {
    set({ selectedAlgorithms: algos });
    void setConfig("algorithm", algos.join(","));
  },

  setTheme: (theme) => set({ theme }),

  setLanguage: (language) => set({ language }),

  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      void setConfig("theme", theme);
      return { theme };
    }),

  toggleLanguage: () =>
    set((state) => {
      const language = state.language === "zh" ? "en" : "zh";
      void setConfig("language", language);
      return { language };
    }),

  setAutoCalculate: (value) => {
    set({ autoCalculate: value });
    void setConfig("auto_calculate", value);
  },

  setAnimations: (value) => {
    set({ animations: value });
    void setConfig("animations", value);
  },

  setCalculating: (value) => set({ isCalculating: value }),

  startValidation: async () => {
    const state = get();
    const sourceFiles = state.fileList.filter((f) => f.role !== "verification");
    if (state.isCalculating) return;
    if (sourceFiles.length === 0) {
      useToastStore.getState().addToast("error", i18n.t("no_source_files"));
      return;
    }

    const toast = useToastStore.getState().addToast;
    const t = i18n.t.bind(i18n);

    set({
      isCalculating: true,
      isPaused: false,
      progress: 0,
      currentFile: null,
      resultText: "",
      statusMessage: "calculating",
    });

    try {
      const paths = sourceFiles.map((f) => f.path);
      const expected = state.expectedHash?.trim() || "";
      // 一次读取同时为所有选中算法计算哈希（Rust 端单趟多哈希，避免每种算法重读文件）
      const batch = await startBatchValidation(paths, state.selectedAlgorithms);
      const allResults: HashResult[] = batch.results;

      set({ isCalculating: false, progress: 100, statusMessage: "completed", lastResults: allResults });

      // 逐文件绑定模式（导入校验文件）：按 文件名→算法 精确匹配，杜绝跨文件误命中
      if (state.verificationMode === "file" && state.importedEntries.length > 0) {
        const verifyMap = new Map<string, Map<string, string>>();
        for (const e of state.importedEntries) {
          const key = basename(e.filename).toLowerCase();
          let inner = verifyMap.get(key);
          if (!inner) {
            inner = new Map();
            verifyMap.set(key, inner);
          }
          inner.set(e.algorithm.toLowerCase(), e.hashValue.toLowerCase());
        }
        const provided = new Set(allResults.map((r) => basename(r.filePath).toLowerCase()));
        const missingFiles = new Set<string>();
        for (const e of state.importedEntries) {
          const k = basename(e.filename).toLowerCase();
          if (!provided.has(k)) missingFiles.add(basename(e.filename));
        }

        let compText = `\n${t("comparison_results")}\n\n`;
        let matchCount = 0;
        let mismatchCount = 0;
        let noExpectedCount = 0;

        for (const r of allResults) {
          if (!r.hashValue) continue;
          const fileName = basename(r.filePath);
          const expectedInner = verifyMap.get(fileName.toLowerCase());
          if (!expectedInner) {
            // 校验文件未记录该文件：仅计算，不误判 mismatch
            get().updateFileResult({ ...r, status: "computed" });
            compText += `· ${fileName} ${t("not_in_verify")}\n`;
            noExpectedCount++;
            continue;
          }
          const expectedHash = expectedInner.get(r.algorithm);
          if (expectedHash == null) {
            // 该文件在校验文件中有记录，但未含此算法：仅计算，不判 mismatch
            get().updateFileResult({ ...r, status: "computed" });
            compText += `· ${fileName} (${r.algorithm}) ${t("not_in_verify")}\n`;
            noExpectedCount++;
            continue;
          }
          const isMatch = expectedHash === r.hashValue.toLowerCase();
          get().updateFileResult({ ...r, status: isMatch ? "success" : "mismatch" });
          if (isMatch) {
            compText += `✓ ${fileName} ${t("match")}\n`;
            matchCount++;
          } else {
            compText += `✗ ${fileName} ${t("mismatch")}\n`;
            mismatchCount++;
          }
        }

        if (missingFiles.size > 0) {
          compText += `\n${t("missing_files_title")}\n`;
          for (const m of missingFiles) compText += `✗ ${m} ${t("missing_file")}\n`;
        }

        compText += `\n---\n${t("total_summary")}: ${allResults.filter((r) => r.hashValue).length} | ${t("match")}: ${matchCount} | ${t("mismatch")}: ${mismatchCount} | ${t("not_in_verify")}: ${noExpectedCount}\n`;
        set((s) => ({ resultText: s.resultText + compText }));

        if (mismatchCount > 0) {
          toast("error", t("toast_mismatch"));
        } else if (missingFiles.size > 0) {
          toast("warning", t("toast_missing_files", { n: missingFiles.size }));
        } else {
          toast("success", t("toast_all_match"));
        }
        return;
      }

      if (!expected) return;

      // 集合匹配：把预期哈希看作一组可信指纹（规范化后去空格、小写），
      // 每个文件只要任一计算结果命中集合即判为 match，不再强求行序对应。
      const expectedLines = normalizeExpectedHash(expected)
        .split("\n")
        .map((l) => l.toLowerCase().replace(/\s/g, ""))
        .filter((l) => l.length > 0);
      const expectedSet = new Set(expectedLines);
      const hasInvalid = expectedLines.some((l) => !/^[0-9a-f]+$/i.test(l));

      const computedResults = allResults.filter((r) => r.hashValue);

      let compText = `\n${t("comparison_results")}\n\n`;
      let matchCount = 0;
      let mismatchCount = 0;

      for (const r of computedResults) {
        const fileName = r.filePath.split(/[/\\]/).pop() ?? r.filePath;
        const isMatch = expectedSet.has(r.hashValue.toLowerCase());
        get().updateFileResult({ ...r, status: isMatch ? "success" : "mismatch" });
        if (isMatch) {
          compText += `✓ ${fileName} ${t("match")}\n`;
          matchCount++;
        } else {
          compText += `✗ ${fileName} ${t("mismatch")}\n`;
          mismatchCount++;
        }
      }

      if (hasInvalid) {
        compText += `\n⚠ ${t("invalid_hash_format")}\n`;
      }

      compText += `\n---\n${t("total_summary")}: ${computedResults.length} | ${t("match")}: ${matchCount} | ${t("mismatch")}: ${mismatchCount}\n`;
      set((s) => ({ resultText: s.resultText + compText }));

      if (mismatchCount > 0) {
        toast("error", t("toast_mismatch"));
      } else {
        toast("success", t("toast_all_match"));
      }
    } catch (err) {
      set((s) => ({ resultText: s.resultText + `\n✗ ${String(err)}\n`, isCalculating: false, statusMessage: "ready" }));
    }
  },

  setPaused: (value) => set({ isPaused: value }),

  setProgress: (value) => set({ progress: value }),

  setCurrentFile: (file) => set({ currentFile: file }),

  setResultText: (text) =>
    set((state) => ({
      resultText: typeof text === "function" ? text(state.resultText) : text,
    })),

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  updateFileResult: (result: Omit<HashResult, "status"> & { status: FileItemStatus }) =>
    set((state) => {
      const idx = state.fileList.findIndex((f) => f.path === result.filePath);
      if (idx < 0) return state;
      const fileList = [...state.fileList];
      const item = fileList[idx];
      const results: FileResult[] = [...(item.results ?? [])];
      const rIdx = results.findIndex((r) => r.algorithm === result.algorithm);
      const normalized: FileResult = {
        algorithm: result.algorithm,
        hashValue: result.hashValue,
        elapsedTime: result.elapsedTime,
        status: result.status,
        fromCache: result.fromCache,
        errorMessage: result.errorMessage,
      };
      if (rIdx >= 0) results[rIdx] = normalized;
      else results.push(normalized);
      fileList[idx] = { ...item, results, ...aggregateParent(results) };
      return { fileList };
    }),

  setExpectedHash: (hash) =>
    set((state) => {
      const trimmed = hash.trim();
      if (trimmed) {
        // 输入单哈希预期时，清空已导入的校验文件（二者互斥）
        return { expectedHash: hash, verificationMode: "single", importedEntries: [] };
      }
      return {
        expectedHash: hash,
        verificationMode: state.importedEntries.length > 0 ? "file" : "none",
      };
    }),

  setImportedEntries: (report) =>
    set((state) => {
      // 累积已导入的校验条目：同一文件（按文件名）再次导入时以新条目覆盖，
      // 避免后一次导入整段覆盖前一次，导致「检测到算法」只显示最后一次。
      const merged = new Map<string, VerificationEntry>();
      for (const e of state.importedEntries) merged.set(e.filename, e);
      for (const e of report.entries) merged.set(e.filename, e);
      const importedEntries = Array.from(merged.values());

      // 回填哈希到输入框作为可见反馈：同样累积，仅追加本次新增的哈希值。
      const existingLines = new Set(
        normalizeExpectedHash(state.expectedHash)
          .split("\n")
          .map((l) => l.toLowerCase()),
      );
      const newHashes = report.entries
        .map((e) => e.hashValue)
        .filter((h) => h && !existingLines.has(h.toLowerCase()));
      const expectedHash =
        newHashes.length > 0
          ? [state.expectedHash, ...newHashes].filter(Boolean).join("\n")
          : state.expectedHash;

      return {
        importedEntries,
        expectedHash,
        verificationMode: importedEntries.length > 0 ? "file" : "none",
      };
    }),

  setLastResults: (results) => set({ lastResults: results }),

  setBytesRead: (value) => set({ bytesRead: value }),

  setTotalBytes: (value) => set({ totalBytes: value }),

  copyResult: async () => {
    // 优先复制结构化哈希行（文件名: 哈希），对齐 PyQt 语义；无结果时回退复制整个结果区
    const { lastResults, resultText } = get();
    let text = "";
    if (lastResults && lastResults.length > 0) {
      text = lastResults
        .filter((r) => r.hashValue)
        .map(
          (r) =>
            `${r.filePath.split(/[/\\]/).pop() ?? r.filePath}: ${r.hashValue}`,
        )
        .join("\n");
    } else if (resultText) {
      text = resultText;
    }
    if (!text) return false;
    try {
      await writeText(text);
      return true;
    } catch {
      // 剪贴板写入失败
      return false;
    }
  },
}));
