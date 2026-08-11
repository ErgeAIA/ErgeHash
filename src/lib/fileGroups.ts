import type { FileItem } from "@/services/types";

/**
 * 重复组颜色类名（与 index.css 中的 --group-* 变量一一对应）。
 * 每组重复文件按组号循环分配不同颜色，多对重复时也能一眼区分。
 */
export const GROUP_COLOR_CLASSES = [
  "text-group-1",
  "text-group-2",
  "text-group-3",
  "text-group-4",
  "text-group-5",
] as const;

export interface FileGroupInfo {
  /** 组编号，从 1 开始 */
  groupId: number;
  /** 颜色在调色板中的索引 */
  colorIndex: number;
  /** 可直接用于 className 的颜色类名 */
  colorClass: (typeof GROUP_COLOR_CLASSES)[number];
  /** 所属算法 */
  algorithm: string;
  /** 共同哈希值 */
  hash: string;
}

export interface FileGroupsSummary {
  /** 重复组数（每组 ≥2 个文件哈希相同） */
  duplicateGroupCount: number;
  /** 参与重复的文件总数 */
  duplicateFileCount: number;
  /** 已计算但未与他人重复的文件数 */
  uniqueCount: number;
  /** 已计算（有任意子结果）的文件数 */
  verifiedCount: number;
  /** 尚未计算的文件数 */
  unverifiedCount: number;
}

export interface FileGroupsResult {
  /** 所有重复组元数据（仅含 ≥2 个文件的组） */
  groups: FileGroupInfo[];
  /** 文件路径 -> 所属重复组信息（唯一文件不在 map 中） */
  map: Map<string, FileGroupInfo>;
  summary: FileGroupsSummary;
}

/**
 * 按文件的主导哈希值（取第一个子结果）分组。
 * 只有已计算（status != undefined）的文件才参与分组；
 * 若多个文件在首个子结果上算法+哈希相同，则被归为同一重复组。
 */
export function buildFileGroups(fileList: FileItem[]): FileGroupsResult {
  const bucketMap = new Map<string, FileItem[]>();
  let verifiedCount = 0;

  for (const file of fileList) {
    if (file.status == null) continue;
    verifiedCount++;
    const lead = file.results[0];
    if (!lead) continue;
    const key = `${lead.algorithm}:${lead.hashValue.toLowerCase()}`;
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.push(file);
    } else {
      bucketMap.set(key, [file]);
    }
  }

  const sortedKeys = Array.from(bucketMap.keys()).sort();
  const groups: FileGroupInfo[] = [];
  const map = new Map<string, FileGroupInfo>();
  let duplicateGroupCount = 0;
  let duplicateFileCount = 0;
  let groupId = 0;

  for (const key of sortedKeys) {
    const bucket = bucketMap.get(key)!;
    if (bucket.length < 2) continue;

    duplicateGroupCount++;
    duplicateFileCount += bucket.length;
    groupId++;

    const [algorithm, hash] = key.split(":", 2);
    const colorIndex = (groupId - 1) % GROUP_COLOR_CLASSES.length;
    const info: FileGroupInfo = {
      groupId,
      colorIndex,
      colorClass: GROUP_COLOR_CLASSES[colorIndex],
      algorithm,
      hash,
    };

    groups.push(info);
    for (const f of bucket) {
      map.set(f.path, info);
    }
  }

  return {
    groups,
    map,
    summary: {
      duplicateGroupCount,
      duplicateFileCount,
      uniqueCount: verifiedCount - duplicateFileCount,
      verifiedCount,
      unverifiedCount: fileList.length - verifiedCount,
    },
  };
}
