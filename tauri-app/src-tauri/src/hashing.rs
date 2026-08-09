use std::path::Path;
use std::time::UNIX_EPOCH;

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};

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

/// 创建对应算法的哈希对象（trait object，消除按算法复制的分块循环）
pub fn make_hasher(algorithm: HashAlgorithm) -> Box<dyn HashSink> {
    match algorithm {
        HashAlgorithm::SHA256 => Box::new(Sha256::new()),
        HashAlgorithm::MD5 => Box::new(Md5::new()),
        HashAlgorithm::SHA1 => Box::new(Sha1::new()),
        HashAlgorithm::SHA512 => Box::new(Sha512::new()),
    }
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
