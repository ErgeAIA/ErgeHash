"""
数据导出模块
支持 CSV 和 JSON 格式导出
"""

import csv
import json
from pathlib import Path
from typing import Dict, List


class DataExporter:
    """数据导出器"""

    @staticmethod
    def export_to_csv(data: List[Dict[str, str]], file_path: str) -> bool:
        """导出为 CSV 格式"""
        try:
            with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
                if not data:
                    return False

                # 获取所有字段名
                fieldnames = ["文件路径", "算法", "哈希值", "时间"]

                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()

                for record in data:
                    writer.writerow(
                        {
                            "文件路径": record.get("path", ""),
                            "算法": record.get("algorithm", "").upper(),
                            "哈希值": record.get("hash", ""),
                            "时间": record.get("timestamp", "")[:19],  # 只显示日期时间
                        }
                    )
            return True
        except Exception as e:
            print(f"导出 CSV 失败: {e}")
            return False

    @staticmethod
    def export_to_json(data: List[Dict[str, str]], file_path: str) -> bool:
        """导出为 JSON 格式"""
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"导出 JSON 失败: {e}")
            return False

    @staticmethod
    def generate_verification_file(
        file_path: str, algorithm: str, hash_value: str, output_path: str
    ) -> bool:
        """生成验证文件（包含文件名和哈希值）"""
        try:
            filename = Path(file_path).name
            content = f"{algorithm.upper()}: {hash_value}  {filename}\n"

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"生成验证文件失败: {e}")
            return False

    @staticmethod
    def import_verification_file(file_path: str) -> List[Dict[str, str]]:
        """导入验证文件并解析"""
        results = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    # 支持多种格式
                    # 格式1: SHA256: abc123def456  filename.txt
                    # 格式2: abc123def456  filename.txt
                    parts = line.split()

                    if len(parts) >= 2:
                        # 提取哈希值和文件名
                        if ":" in parts[0]:
                            algorithm = parts[0].replace(":", "").lower()
                            hash_value = parts[1]
                            filename = (
                                " ".join(parts[2:]) if len(parts) > 2 else "unknown"
                            )
                        else:
                            algorithm = "unknown"
                            hash_value = parts[0]
                            filename = " ".join(parts[1:])

                        results.append(
                            {
                                "algorithm": algorithm,
                                "hash": hash_value,
                                "filename": filename,
                            }
                        )
        except Exception as e:
            print(f"导入验证文件失败: {e}")

        return results
