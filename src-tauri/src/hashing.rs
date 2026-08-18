use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, UNIX_EPOCH};

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use crc32fast::Hasher as Crc32Hasher;

use crate::models::HashAlgorithm;

/// 哈希计算统一接口：屏蔽各算法差异，可作 trait object 使用。
/// `Digest` 因含关联类型 `OutputSize` 不能直接 `Box<dyn Digest>`，
/// 故定义此薄封装（`Box<Self>` receiver 保证对象安全）。
pub trait HashSink {
    fn update(&mut self, data: &[u8]);
    fn finalize_hex(self: Box<Self>) -> String;
}

impl HashSink for Sha256 {
    fn update(&mut self, data: &[u8]) {
        Digest::update(self, data);
    }
    fn finalize_hex(self: Box<Self>) -> String {
        format!("{:x}", Sha256::finalize(*self))
    }
}

impl HashSink for Md5 {
    fn update(&mut self, data: &[u8]) {
        Digest::update(self, data);
    }
    fn finalize_hex(self: Box<Self>) -> String {
        format!("{:x}", Md5::finalize(*self))
    }
}

impl HashSink for Sha1 {
    fn update(&mut self, data: &[u8]) {
        Digest::update(self, data);
    }
    fn finalize_hex(self: Box<Self>) -> String {
        format!("{:x}", Sha1::finalize(*self))
    }
}

impl HashSink for Sha512 {
    fn update(&mut self, data: &[u8]) {
        Digest::update(self, data);
    }
    fn finalize_hex(self: Box<Self>) -> String {
        format!("{:x}", Sha512::finalize(*self))
    }
}

/// CRC32（IEEE 802.3，与 zip/以太网一致），非 Digest trait，单独实现 HashSink。
impl HashSink for Crc32Hasher {
    fn update(&mut self, data: &[u8]) {
        self.update(data);
    }
    fn finalize_hex(self: Box<Self>) -> String {
        format!("{:08x}", self.finalize())
    }
}

/// 创建对应算法的哈希对象（trait object，消除按算法复制的分块循环）
pub fn make_hasher(algorithm: HashAlgorithm) -> Box<dyn HashSink> {
    match algorithm {
        HashAlgorithm::SHA256 => Box::new(Sha256::new()),
        HashAlgorithm::MD5 => Box::new(Md5::new()),
        HashAlgorithm::SHA1 => Box::new(Sha1::new()),
        HashAlgorithm::SHA512 => Box::new(Sha512::new()),
        HashAlgorithm::Crc32 => Box::new(Crc32Hasher::new()),
    }
}

/// 哈希读取块大小：1MB，减少系统调用次数（相对 8KB 显著降低 syscall 开销）
pub const CHUNK_SIZE: usize = 1024 * 1024;

/// 哈希缓存类型别名：键 (路径, 大小, mtime纳秒, 算法) → 哈希值
pub type HashCache = HashMap<(String, u64, u128, HashAlgorithm), String>;

/// 中断检查：已取消返回错误；已暂停阻塞等待（期间仍检查取消）。
/// 独立于 AppState，供 blocking 线程中的批量处理使用。
pub fn check_interrupted(pause_flag: &AtomicBool, cancel_flag: &AtomicBool) -> Result<(), String> {
    if cancel_flag.load(Ordering::Relaxed) {
        return Err(crate::models::error_codes::COMPUTE_CANCELLED.to_string());
    }
    while pause_flag.load(Ordering::Relaxed) {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(crate::models::error_codes::COMPUTE_CANCELLED.to_string());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}

/// 计算哈希缓存键：加入文件路径与修改时间，避免同大小不同文件/内容修改后误命中。
pub fn file_cache_key(
    file_path: &str,
    size: u64,
    algorithm: HashAlgorithm,
) -> (String, u64, u128, HashAlgorithm) {
    let mtime = Path::new(file_path)
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (file_path.to_string(), size, mtime, algorithm)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 用已知标准测试向量验证各算法哈希正确性（回归基线）
    #[test]
    fn hash_vectors_match_known_values() {
        let cases: &[(HashAlgorithm, &str, &str)] = &[
            (
                HashAlgorithm::SHA256,
                "abc",
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            ),
            (
                HashAlgorithm::SHA256,
                "",
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ),
            (
                HashAlgorithm::MD5,
                "abc",
                "900150983cd24fb0d6963f7d28e17f72",
            ),
            (
                HashAlgorithm::MD5,
                "",
                "d41d8cd98f00b204e9800998ecf8427e",
            ),
            (
                HashAlgorithm::SHA1,
                "abc",
                "a9993e364706816aba3e25717850c26c9cd0d89d",
            ),
            (
                HashAlgorithm::SHA1,
                "",
                "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            ),
            (
                HashAlgorithm::SHA512,
                "abc",
                "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
            ),
            (
                HashAlgorithm::SHA512,
                "",
                "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
            ),
            (
                HashAlgorithm::Crc32,
                "abc",
                "352441c2",
            ),
            (
                HashAlgorithm::Crc32,
                "",
                "00000000",
            ),
        ];

        for &(algorithm, input, expected) in cases {
            let mut hasher = make_hasher(algorithm);
            hasher.update(input.as_bytes());
            assert_eq!(
                hasher.finalize_hex(),
                expected,
                "算法 {:?} 向量不符",
                algorithm
            );
        }
    }

    /// make_hasher 对不同算法返回不同哈希（防串算法）
    #[test]
    fn make_hasher_distinguishes_algorithms() {
        let mut sha = make_hasher(HashAlgorithm::SHA256);
        sha.update(b"abc");
        let mut md5 = make_hasher(HashAlgorithm::MD5);
        md5.update(b"abc");
        assert_ne!(sha.finalize_hex(), md5.finalize_hex());
    }

    /// 缓存键：路径或算法不同 → key 不同
    #[test]
    fn cache_key_differs_by_path_and_algorithm() {
        let k1 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        let k2 = file_cache_key("/tmp/b.bin", 100, HashAlgorithm::SHA256);
        let k3 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::MD5);
        let k4 = file_cache_key("/tmp/a.bin", 200, HashAlgorithm::SHA256);
        assert_ne!(k1, k2);
        assert_ne!(k1, k3);
        assert_ne!(k1, k4);
    }

    /// 缓存键：同路径同大小同算法，两次调用结果一致（mtime 取不到时为 0，稳定）
    #[test]
    fn cache_key_is_stable() {
        let k1 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        let k2 = file_cache_key("/tmp/a.bin", 100, HashAlgorithm::SHA256);
        assert_eq!(k1, k2);
    }

    /// 分块更新与一次更新等价（保护 CHUNK_SIZE 分块读取语义）
    #[test]
    fn chunked_update_equals_single_update() {
        // 数据跨越多个 1MB 块 + 余数
        let data = vec![0xABu8; CHUNK_SIZE * 2 + 7];

        let mut single = make_hasher(HashAlgorithm::SHA256);
        single.update(&data);
        let expected = single.finalize_hex();

        let mut chunked = make_hasher(HashAlgorithm::SHA256);
        for chunk in data.chunks(CHUNK_SIZE) {
            chunked.update(chunk);
        }
        let actual = chunked.finalize_hex();

        assert_eq!(actual, expected, "分块更新应与一次更新产生相同哈希");
    }
}
