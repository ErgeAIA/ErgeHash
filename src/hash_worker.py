"""
改进的哈希计算线程
支持暂停、继续、取消和进度报告
"""

import hashlib
import threading
import time
from pathlib import Path

from PyQt5.QtCore import QThread, pyqtSignal


class HashCalculatorThread(QThread):
    """支持暂停/继续的哈希计算线程"""

    progress = pyqtSignal(int)  # 当前文件进度 0-100
    batch_progress = pyqtSignal(int)  # 批量进度 0-100
    finished = pyqtSignal(str, float)  # 哈希值, 耗时(秒)
    error = pyqtSignal(str)  # 错误信息
    status_changed = pyqtSignal(str)  # 状态变化

    def __init__(self, file_path, algorithm):
        super().__init__()
        self.file_path = file_path
        self.algorithm = algorithm
        self.should_stop = False
        self._pause_event = threading.Event()
        self._pause_event.set()  # 默认不暂停
        self.start_time = None

    def stop(self):
        """停止计算"""
        self.should_stop = True
        self._pause_event.set()  # 解除暂停，以便快速停止

    def pause(self):
        """暂停计算"""
        self._pause_event.clear()
        self.status_changed.emit("已暂停")

    def resume(self):
        """继续计算"""
        self._pause_event.set()
        self.status_changed.emit("正在计算")

    def run(self):
        """执行哈希计算"""
        self.start_time = time.time()

        try:
            # 检查文件是否存在
            if not Path(self.file_path).exists():
                self.error.emit(f"文件不存在: {self.file_path}")
                return

            # 获取文件大小
            file_size = Path(self.file_path).stat().st_size

            # 特殊处理空文件
            if file_size == 0:
                hash_obj = getattr(hashlib, self.algorithm)()
                elapsed = time.time() - self.start_time
                self.finished.emit(hash_obj.hexdigest(), elapsed)
                return

            # 创建哈希对象
            hash_obj = getattr(hashlib, self.algorithm)()
            processed_size = 0
            chunk_size = 8192 * 10  # 81KB chunks

            with open(self.file_path, "rb") as f:
                while True:
                    # 检查取消信号
                    if self.should_stop:
                        self.error.emit("计算已取消")
                        return

                    # 检查暂停信号
                    self._pause_event.wait()

                    # 读取数据块
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break

                    hash_obj.update(chunk)
                    processed_size += len(chunk)

                    # 计算进度
                    progress = int((processed_size / file_size) * 100)
                    self.progress.emit(progress)

            # 计算完成
            hash_value = hash_obj.hexdigest()
            elapsed = time.time() - self.start_time
            self.finished.emit(hash_value, elapsed)

        except PermissionError:
            self.error.emit("权限不足：无法读取文件")
        except FileNotFoundError:
            self.error.emit("文件不存在或已被删除")
        except OSError as e:
            self.error.emit(f"文件访问错误: {str(e)}")
        except Exception as e:
            self.error.emit(f"未知错误: {str(e)}")
