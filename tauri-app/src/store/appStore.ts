import { create } from "zustand";
import type { FileItem, HashAlgorithm, HashResult } from "../services/types";
import { setConfig } from "../services/api";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/** 应用状态 */
interface AppState {
  /** 文件列表 */
  fileList: FileItem[];
  /** 当前算法 */
  algorithm: HashAlgorithm;
  /** 主题 */
  theme: "light" | "dark";
  /** 语言 */
  language: "zh" | "en";
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
  /** 最近一次批量结果（供导出/复制使用） */
  lastResults: HashResult[] | null;

  // ---- Actions ----
  /** 添加文件到列表 */
  addFiles: (files: string[]) => void;
  /** 移除指定索引的文件 */
  removeFile: (index: number) => void;
  /** 清空文件列表 */
  clearFiles: () => void;
  /** 设置算法（持久化） */
  setAlgorithm: (algo: HashAlgorithm) => void;
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
  /** 更新文件状态 */
  updateFileStatus: (
    index: number,
    hashValue: string,
    status: FileItem["status"],
    errorMessage?: string,
  ) => void;
  /** 按路径更新文件状态（哈希计算完成后回填列表） */
  updateFileByPath: (
    path: string,
    hashValue: string,
    status: FileItem["status"],
    errorMessage?: string,
  ) => void;
  /** 设置预期哈希值 */
  setExpectedHash: (hash: string) => void;
  /** 设置最近一次批量结果 */
  setLastResults: (results: HashResult[] | null) => void;
  /** 复制结果到剪贴板，返回是否成功 */
  copyResult: () => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  fileList: [],
  algorithm: "sha256",
  theme: "light",
  language: "zh",
  isCalculating: false,
  isPaused: false,
  progress: 0,
  currentFile: null,
  resultText: "",
  statusMessage: "ready",
  expectedHash: "",
  lastResults: null,

  addFiles: (files) =>
    set((state) => {
      // 去重：已有路径不再添加
      const existingPaths = new Set(state.fileList.map((f) => f.path));
      const newItems: FileItem[] = files
        .filter((p) => !existingPaths.has(p))
        .map((p) => ({ path: p }));
      return { fileList: [...state.fileList, ...newItems] };
    }),

  removeFile: (index) =>
    set((state) => ({
      fileList: state.fileList.filter((_, i) => i !== index),
    })),

  clearFiles: () =>
    set({
      fileList: [],
      resultText: "",
      progress: 0,
      currentFile: null,
      lastResults: null,
    }),

  setAlgorithm: (algo) => {
    set({ algorithm: algo });
    void setConfig("algorithm", algo);
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

  setCalculating: (value) => set({ isCalculating: value }),

  setPaused: (value) => set({ isPaused: value }),

  setProgress: (value) => set({ progress: value }),

  setCurrentFile: (file) => set({ currentFile: file }),

  setResultText: (text) =>
    set((state) => ({
      resultText: typeof text === "function" ? text(state.resultText) : text,
    })),

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  updateFileStatus: (index, hashValue, status, errorMessage) =>
    set((state) => {
      const fileList = [...state.fileList];
      if (index >= 0 && index < fileList.length) {
        fileList[index] = {
          ...fileList[index],
          hashValue,
          status,
          errorMessage,
        };
      }
      return { fileList };
    }),

  updateFileByPath: (path, hashValue, status, errorMessage) =>
    set((state) => {
      const idx = state.fileList.findIndex((f) => f.path === path);
      if (idx < 0) return state;
      const fileList = [...state.fileList];
      fileList[idx] = {
        ...fileList[idx],
        hashValue,
        status,
        errorMessage,
      };
      return { fileList };
    }),

  setExpectedHash: (hash) => set({ expectedHash: hash }),

  setLastResults: (results) => set({ lastResults: results }),

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
