"""
批量处理管理器
管理文件队列、缓存、批量验证流程
"""

from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class BatchHashManager:
    """批量哈希管理器"""

    def __init__(self):
        self.file_queue: List[str] = []
        self.current_index = 0
        self.hash_cache: Dict[tuple, str] = {}  # (size, algorithm) -> hash
        self.results: List[Dict] = []
        self.is_running = False
        self.is_paused = False

    def add_files(self, files: List[str]):
        """添加文件到队列"""
        self.file_queue.extend(files)

    def clear(self):
        """清空队列"""
        self.file_queue.clear()
        self.current_index = 0
        self.results.clear()
        self.is_running = False
        self.is_paused = False

    def get_queue_size(self) -> int:
        """获取队列大小"""
        return len(self.file_queue)

    def get_current_file(self) -> Optional[str]:
        """获取当前处理的文件"""
        if 0 <= self.current_index < len(self.file_queue):
            return self.file_queue[self.current_index]
        return None

    def get_progress(self) -> tuple:
        """获取进度 (当前索引, 总数)"""
        return (self.current_index, len(self.file_queue))

    def move_to_next(self):
        """移动到下一个文件"""
        self.current_index += 1

    def is_complete(self) -> bool:
        """检查是否完成"""
        return self.current_index >= len(self.file_queue)

    def add_result(
        self,
        file_path: str,
        algorithm: str,
        hash_value: str,
        status: str,
        elapsed_time: float = 0,
    ):
        """添加结果"""
        result = {
            "path": file_path,
            "algorithm": algorithm,
            "hash": hash_value,
            "status": status,  # success, error, mismatch
            "timestamp": datetime.now().isoformat(),
            "elapsed_time": elapsed_time,
        }
        self.results.append(result)

    def get_results(self) -> List[Dict]:
        """获取所有结果"""
        return self.results

    def cache_hash(self, file_path: str, algorithm: str, hash_value: str):
        """缓存哈希值"""
        try:
            size = Path(file_path).stat().st_size
            key = (size, algorithm)
            self.hash_cache[key] = hash_value
        except Exception:
            pass

    def get_cached_hash(self, file_path: str, algorithm: str) -> Optional[str]:
        """获取缓存的哈希值"""
        try:
            size = Path(file_path).stat().st_size
            key = (size, algorithm)
            return self.hash_cache.get(key)
        except Exception:
            return None

    def get_statistics(self) -> Dict:
        """获取统计信息"""
        total = len(self.results)
        success = sum(1 for r in self.results if r["status"] == "success")
        error = sum(1 for r in self.results if r["status"] == "error")
        mismatch = sum(1 for r in self.results if r["status"] == "mismatch")
        total_time = sum(r.get("elapsed_time", 0) for r in self.results)

        return {
            "total": total,
            "success": success,
            "error": error,
            "mismatch": mismatch,
            "total_time": total_time,
        }
