"""
配置管理模块
保存和加载用户配置、历史记录等
"""

import json
from pathlib import Path
from typing import Any, Dict, List


class ConfigManager:
    """配置管理器"""

    CONFIG_FILE = Path.home() / ".hashvalidatorplus" / "config.json"
    HISTORY_FILE = Path.home() / ".hashvalidatorplus" / "history.json"

    def __init__(self):
        """初始化配置管理器"""
        self.config_dir = self.CONFIG_FILE.parent
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config = self._load_config()
        self.history = self._load_history()

    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if self.CONFIG_FILE.exists():
            try:
                with open(self.CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return self._default_config()
        return self._default_config()

    def _default_config(self) -> Dict[str, Any]:
        """默认配置"""
        return {
            "algorithm": "sha256",  # 默认算法
            "window_geometry": None,  # 窗口大小位置
            "theme": "light",  # 主题
            "auto_copy": False,  # 计算完成后自动复制
        }

    def _load_history(self) -> List[Dict[str, str]]:
        """加载历史记录"""
        if self.HISTORY_FILE.exists():
            try:
                with open(self.HISTORY_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def save_config(self):
        """保存配置"""
        try:
            with open(self.CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存配置失败: {e}")

    def save_history(self):
        """保存历史记录"""
        try:
            with open(self.HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存历史记录失败: {e}")

    def add_history(self, file_path: str, algorithm: str, hash_value: str):
        """添加历史记录"""
        from datetime import datetime

        record = {
            "path": file_path,
            "algorithm": algorithm,
            "hash": hash_value,
            "timestamp": datetime.now().isoformat(),
        }

        # 检查是否已存在相同记录
        for i, h in enumerate(self.history):
            if h["path"] == file_path and h["algorithm"] == algorithm:
                self.history[i] = record
                self.save_history()
                return

        # 添加新记录，最多保留 50 条
        self.history.insert(0, record)
        self.history = self.history[:50]
        self.save_history()

    def get_history(self, limit: int = 10) -> List[Dict[str, str]]:
        """获取最近的历史记录"""
        return self.history[:limit]

    def get_config(self, key: str, default=None):
        """获取配置值"""
        return self.config.get(key, default)

    def set_config(self, key: str, value):
        """设置配置值"""
        self.config[key] = value
        self.save_config()
