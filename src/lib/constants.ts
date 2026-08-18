/** 应用级常量（单一来源，避免设置页 / 指南硬编码版本号与联系方式导致发版漂移） */
export const APP_VERSION = "0.9.96";
export const APP_EMAIL = "ergeaia@agent.qq.com";
export const APP_BILIBILI_URL = "https://space.bilibili.com/67221461";
export const APP_GITHUB_URL = "https://github.com/ErgeAIA";

/** 算法语义色（用于快速指南与 NavRail 的算法标识圆点，按安全强度区分）
 *  key 与 HashAlgorithm value 一致；sha256 推荐(primary) / sha512 高安全(secondary)
 *  / sha1 已发现漏洞(warning) / md5 不推荐安全(destructive) / crc32 完整性(success) */
export const ALGO_COLOR_CLASS: Record<string, string> = {
  sha256: "bg-primary",
  sha512: "bg-secondary",
  sha1: "bg-warning",
  md5: "bg-destructive",
  crc32: "bg-success",
};
