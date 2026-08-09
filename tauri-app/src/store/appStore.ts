import { create } from "zustand";
import type { FileItem, HashAlgorithm, HashResult } from "../services/types";
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
  /** 设置算法 */
  setAlgorithm: (algo: HashAlgorithm) => void;
  /** 切换主题 */
  toggleTheme: () => void;
  /** 切换语言 */
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
  /** 设置预期哈希值 */
  setExpectedHash: (hash: string) => void;
  /** 设置最近一次批量结果 */
  setLastResults: (results: HashResult[] | null) => void;
  /** 复制结果到剪贴板 */
  copyResult: () => void;
}

export const useAppStore = create<AppState>((set) => ({
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
    }),

  setAlgorithm: (algo) => set({ algorithm: algo }),

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "light" ? "dark" : "light",
    })),

  toggleLanguage: () =>
    set((state) => ({
      language: state.language === "zh" ? "en" : "zh",
    })),

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

  setExpectedHash: (hash) => set({ expectedHash: hash }),

  setLastResults: (results) => set({ lastResults: results }),

  copyResult: () =>
    set((state) => {
      if (state.resultText) {
        writeText(state.resultText).catch(() => {
          // 剪贴板写入失败时静默处理
        });
      }
      return state;
    }),
}));
