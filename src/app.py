#!/usr/bin/env python
"""
HashValidatorPlus 启动脚本
"""

import sys
import traceback
from pathlib import Path

# 添加 src 目录到 Python 路径
if getattr(sys, 'frozen', False):
    # PyInstaller 打包环境
    sys.path.insert(0, sys._MEIPASS)
else:
    # 开发环境：添加 src 目录
    src_path = Path(__file__).parent
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))

# 检查依赖
try:
    from PyQt5.QtWidgets import QApplication

    from main import HashValidator
except ImportError as e:
    print(f"❌ 缺少依赖: {e}")
    print("请运行: pip install -r requirements.txt")
    traceback.print_exc()
    sys.exit(1)


def main():
    """应用程序入口"""
    try:
        app = QApplication(sys.argv)
        window = HashValidator()
        window.show()
        sys.exit(app.exec_())
    except Exception as e:
        # 详细的错误报告
        error_msg = (
            f"应用程序启动失败\n\n错误: {str(e)}\n\n详细信息:\n{traceback.format_exc()}"
        )
        print(error_msg)
        try:
            from PyQt5.QtWidgets import QMessageBox

            app = QApplication.instance()
            if not app:
                app = QApplication(sys.argv)
            QMessageBox.critical(None, "应用程序错误", error_msg)
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
