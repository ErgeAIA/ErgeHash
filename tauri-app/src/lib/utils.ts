import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 className，处理 Tailwind CSS 类名冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
