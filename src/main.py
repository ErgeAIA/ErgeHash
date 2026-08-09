import hashlib
import sys
import time
from datetime import datetime
from pathlib import Path

from PyQt5.QtCore import Qt, QThread, QTimer, pyqtSignal
from PyQt5.QtGui import QDragEnterEvent, QDropEvent, QIcon
from PyQt5.QtWidgets import (
    QAction,
    QApplication,
    QButtonGroup,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QRadioButton,
    QStatusBar,
    QTextBrowser,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

# 添加 src 目录到 Python 路径，支持直接运行和打包
if getattr(sys, "frozen", False):
    # PyInstaller 打包环境
    sys.path.insert(0, sys._MEIPASS)
else:
    # 开发环境：添加 src 目录
    src_path = Path(__file__).parent
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))

from batch_manager import BatchHashManager
from config import ConfigManager
from exporter import DataExporter
from file_list import DragDropFileListWidget
from hash_worker import HashCalculatorThread


class HashCalculator(QThread):
    """哈希值计算线程"""

    progress = pyqtSignal(int)
    finished = pyqtSignal(str)
    error = pyqtSignal(str)

    def __init__(self, file_path, algorithm):
        super().__init__()
        self.file_path = file_path
        self.algorithm = algorithm
        self.should_stop = False

    def stop(self):
        """停止计算"""
        self.should_stop = True

    def run(self):
        try:
            # 验证文件是否存在
            if not Path(self.file_path).exists():
                self.error.emit(f"文件不存在: {self.file_path}")
                return

            hash_obj = getattr(hashlib, self.algorithm)()
            file_size = 0
            processed_size = 0

            # 获取文件大小
            with open(self.file_path, "rb") as f:
                f.seek(0, 2)
                file_size = f.tell()
                f.seek(0)

            # 分块读取文件并计算哈希值
            with open(self.file_path, "rb") as f:
                chunk = f.read(8192)
                while chunk and not self.should_stop:
                    hash_obj.update(chunk)
                    processed_size += len(chunk)
                    if file_size > 0:
                        progress = int((processed_size / file_size) * 100)
                        self.progress.emit(progress)
                    chunk = f.read(8192)

            if self.should_stop:
                self.error.emit("计算已取消")
                return

            hash_value = hash_obj.hexdigest()
            self.finished.emit(hash_value)
        except PermissionError:
            self.error.emit("权限不足：无法读取文件")
        except FileNotFoundError:
            self.error.emit("文件不存在或已被删除")
        except OSError as e:
            self.error.emit(f"文件访问错误: {str(e)}")
        except Exception as e:
            self.error.emit(str(e))


class HashValidator(QMainWindow):
    """文件哈希校验工具主窗口"""

    def __init__(self):
        super().__init__()

        # 尽早设置窗口图标
        import sys

        # 处理 PyInstaller 打包环境
        if hasattr(sys, "_MEIPASS"):
            # 打包环境
            icon_path = Path(sys._MEIPASS) / "resources" / "icons" / "app.ico"
        else:
            # 开发环境
            icon_path = Path(__file__).parent.parent / "resources" / "icons" / "app.ico"

        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

        # 初始化管理器
        self.config_manager = ConfigManager()
        self.exporter = DataExporter()
        self.batch_manager = BatchHashManager()

        self.current_file = None
        self.calculated_hash = None
        self.calculator_thread = None

        # 批量处理相关
        self.is_batch_running = False
        self.batch_start_time = None

        # 暗黑模式状态
        self.dark_mode = False
        self.nav_buttons = {}

        # 语言设置
        self.current_language = "zh"  # 默认中文
        self.language_map = {
            "zh": {
                "app_title": "文件哈希校验工具",
                "window_title": "文件哈希校验工具 v0.1 by: B站·宝藏二哥",
                "calculator_title": "文件哈希计算器",
                "file_list_label": "文件列表（支持拖放多个文件或文件夹）",
                "add_files": "添加文件",
                "add_folder": "添加文件夹",
                "clear_list": "清空列表",
                "verify_group": "验证哈希值 (可选)",
                "select_algorithm": "选择算法:",
                "expected_hash": "预期哈希值:",
                "compare_hash": "比较哈希值",
                "quick_compare": "快速比较",
                "progress_group": "计算进度",
                "result_group": "计算结果",
                "start_batch": "开始批量校验",
                "pause": "暂停",
                "stop": "取消",
                "copy_result": "复制结果",
                "algorithms": "算法",
                "quick_tip": "快速提示:\n直接拖放文件到计算器区域",
                "menu_file": "文件(&F)",
                "menu_open": "打开文件(&O)",
                "menu_batch": "批量处理(&B)",
                "menu_export": "导出结果(&E)",
                "menu_exit": "退出(&X)",
                "menu_edit": "编辑(&E)",
                "menu_copy": "复制哈希值(&C)",
                "menu_history": "查看历史记录(&H)",
                "menu_tools": "工具(&T)",
                "menu_guide": "快速指南(&G)",
                "menu_clear_history": "清空历史记录",
                "menu_import_verify": "导入验证文件",
                "history_title": "历史记录",
                "settings_title": "设置",
                "appearance_settings": "外观设置",
                "current_theme": "当前主题:",
                "dark_mode": "暗黑模式",
                "light_mode": "亮色模式",
                "hash_algorithms": "哈希算法",
                "about_title": "关于",
                "about_text": "HashValidatorPlus v0.1.0\n\n支持的算法:\nSHA-256, MD5, SHA-1, SHA-512",
                "success": "成功",
                "warning": "警告",
                "error": "错误",
                "info": "信息",
                "browse_files": "浏览文件",
                "browse_folder": "浏览文件夹",
                "please_select_file": "请先选择一个文件",
                "please_calculate_hash": "请先计算文件的哈希值",
                "please_enter_expected": "请输入预期的哈希值",
                "hash_matches": "哈希值匹配！文件完整且未被修改。",
                "hash_mismatch": "哈希值不匹配！文件可能已被修改或损坏。",
                "batch_processing": "批量处理",
                "found_files": "找到 {count} 个文件\n是否继续？",
                "batch_complete": "批量处理完成",
                "export_results": "导出结果",
                "save_results": "保存结果",
                "no_results": "请先计算文件的哈希值",
                "import_success": "成功导入 {count} 条记录",
                "import_error": "无法解析验证文件",
                "history_empty": "暂无历史记录",
                "history_double_click": "双击使用历史记录中的文件",
                "use_selected": "使用选中项",
                "clear_history_confirm": "确定要清空所有历史记录吗？",
                "history_cleared": "历史记录已清空",
                "notepad_error": "无法打开记事本: {error}",
                "verification_file_single": "验证文件只支持导出单个文件的哈希值",
                "calculating": "计算中...",
                "ready": "就绪",
                "preparing": "准备计算...",
                "file_progress": "文件进度: {progress}%",
                "batch_start_time": "批量处理开始时间",
                "total_files": "总文件数",
                "success_count": "成功",
                "error_count": "错误",
                "total_time": "总耗时",
                "batch_stats": "批量统计信息",
                "algorithm": "算法",
                "path": "路径",
                "status": "状态",
                "elapsed": "耗时",
                "from_cache": "来自缓存",
                "completed": "已完成",
                "comparison_results": "对比结果:",
                "match": "匹配",
                "mismatch": "不匹配",
                "format_error": "格式错误",
                "lines_mismatch": "预期哈希值行数与计算结果数不匹配",
                "menu_batch_process": "批量处理文件夹",
                "select_folder": "选择文件夹",
                "no_files": "所选文件夹中没有文件",
                "processing_files": "正在处理文件",
                "export_to": "导出到",
                "csv_file": "CSV 文件 (*.csv)",
                "json_file": "JSON 文件 (*.json)",
                "verify_file": "验证文件 (*.txt)",
                "export_success": "结果已导出到:",
                "export_failed": "导出失败",
                "clipboard_success": "哈希值已复制到剪贴板",
                "clipboard_error": "无法访问剪贴板",
                "language": "语言",
                "chinese": "中文",
                "english": "English",
                "select_file": "选择文件",
                "multiple_files_hint": "文件列表中有多个文件，快速比较将只比较前两个文件。",
                "bilibili_prompt": "来 B 站找我玩",
            },
            "en": {
                "app_title": "File Hash Validator",
                "window_title": "File Hash Validator v0.1 by: B站·宝藏二哥",
                "calculator_title": "File Hash Calculator",
                "file_list_label": "File List (Supports drag and drop multiple files or folders)",
                "add_files": "Add Files",
                "add_folder": "Add Folder",
                "clear_list": "Clear List",
                "verify_group": "Verify Hash (Optional)",
                "select_algorithm": "Select Algorithm:",
                "expected_hash": "Expected Hash:",
                "compare_hash": "Compare Hash",
                "quick_compare": "Quick Compare",
                "progress_group": "Calculation Progress",
                "result_group": "Calculation Result",
                "start_batch": "Start Batch Validation",
                "pause": "Pause",
                "stop": "Stop",
                "copy_result": "Copy Result",
                "algorithms": "Algorithms",
                "quick_tip": "Quick Tip:\nDrag and drop files directly into the calculator area",
                "menu_file": "File(&F)",
                "menu_open": "Open File(&O)",
                "menu_batch": "Batch Process(&B)",
                "menu_export": "Export Results(&E)",
                "menu_exit": "Exit(&X)",
                "menu_edit": "Edit(&E)",
                "menu_copy": "Copy Hash(&C)",
                "menu_history": "View History(&H)",
                "menu_tools": "Tools(&T)",
                "menu_guide": "Quick Guide(&G)",
                "menu_clear_history": "Clear History",
                "menu_import_verify": "Import Verification File",
                "history_title": "History Records",
                "settings_title": "Settings",
                "appearance_settings": "Appearance Settings",
                "current_theme": "Current Theme:",
                "dark_mode": "Dark Mode",
                "light_mode": "Light Mode",
                "hash_algorithms": "Hash Algorithms",
                "about_title": "About",
                "about_text": "HashValidatorPlus v0.1.0\n\nSupported Algorithms:\nSHA-256, MD5, SHA-1, SHA-512",
                "success": "Success",
                "warning": "Warning",
                "error": "Error",
                "info": "Information",
                "browse_files": "Browse Files",
                "browse_folder": "Browse Folder",
                "please_select_file": "Please select a file first",
                "please_calculate_hash": "Please calculate the file hash first",
                "please_enter_expected": "Please enter the expected hash value",
                "hash_matches": "Hash value matches! File is complete and unmodified.",
                "hash_mismatch": "Hash value does not match! File may have been modified or corrupted.",
                "batch_processing": "Batch Processing",
                "found_files": "Found {count} files\nContinue?",
                "batch_complete": "Batch processing completed",
                "export_results": "Export Results",
                "save_results": "Save Results",
                "no_results": "Please calculate the file hash first",
                "import_success": "Successfully imported {count} records",
                "import_error": "Cannot parse verification file",
                "history_empty": "No history records",
                "history_double_click": "Double-click to use history file",
                "use_selected": "Use Selected",
                "clear_history_confirm": "Are you sure to clear all history records?",
                "history_cleared": "History records cleared",
                "notepad_error": "Cannot open notepad: {error}",
                "verification_file_single": "Verification file only supports exporting single file hash",
                "calculating": "Calculating...",
                "ready": "Ready",
                "preparing": "Preparing...",
                "file_progress": "File Progress: {progress}%",
                "batch_start_time": "Batch Start Time",
                "total_files": "Total Files",
                "success_count": "Success",
                "error_count": "Error",
                "total_time": "Total Time",
                "batch_stats": "Batch Statistics",
                "algorithm": "Algorithm",
                "path": "Path",
                "status": "Status",
                "elapsed": "Elapsed",
                "from_cache": "From Cache",
                "completed": "Completed",
                "comparison_results": "Comparison Results:",
                "match": "Match",
                "mismatch": "Mismatch",
                "format_error": "Format Error",
                "lines_mismatch": "Expected hash lines do not match calculation results count",
                "menu_batch_process": "Batch Process Folder",
                "select_folder": "Select Folder",
                "no_files": "No files in selected folder",
                "processing_files": "Processing files",
                "export_to": "Export to",
                "csv_file": "CSV Files (*.csv)",
                "json_file": "JSON Files (*.json)",
                "verify_file": "Verification Files (*.txt)",
                "export_success": "Results exported to:",
                "export_failed": "Export failed",
                "clipboard_success": "Hash value copied to clipboard",
                "clipboard_error": "Cannot access clipboard",
                "language": "Language",
                "chinese": "中文",
                "english": "English",
                "select_file": "Select File",
                "multiple_files_hint": "There are multiple files in the list. Quick compare will only compare the first two files.",
                "bilibili_prompt": "Come find me on bilibili",
            },
        }

        # 时间显示定时器
        self.time_timer = QTimer()
        self.time_timer.timeout.connect(self.update_time_display)

        # 初始化用户界面
        self.init_ui()

        # 加载已保存的主题设置（默认暗黑模式）
        saved_theme = self.config_manager.get_config("theme", "dark")
        if saved_theme == "dark":
            self.dark_mode = True
            self.apply_dark_theme()
        else:
            self.dark_mode = False
            self.apply_light_theme()

        # 加载已保存的语言设置（默认中文）
        saved_language = self.config_manager.get_config("language", "zh")
        self.current_language = saved_language

        # 初始化语言按钮图标
        if hasattr(self, "language_button"):
            self.language_button.setText(
                "🇺🇸" if self.current_language == "en" else "🇨🇳"
            )

        # 初始化导航按钮颜色
        self._update_nav_buttons_color()

        # 更新界面文本（强制更新所有元素）
        self.update_ui_text()

        # 强制更新占位符文本
        for widget in self.findChildren(QTextEdit):
            if (
                widget.placeholderText() == "在此粘贴预期的哈希值..."
                or widget.placeholderText() == "Paste expected hash value here..."
            ):
                widget.setPlaceholderText(
                    "在此粘贴预期的哈希值..."
                    if self.current_language == "zh"
                    else "Paste expected hash value here..."
                )
            elif (
                widget.placeholderText() == "计算结果将显示在这里..."
                or widget.placeholderText()
                == "Calculation result will be displayed here..."
            ):
                widget.setPlaceholderText(
                    "计算结果将显示在这里..."
                    if self.current_language == "zh"
                    else "Calculation result will be displayed here..."
                )

    def init_ui(self):
        """初始化用户界面"""
        # 设置窗口标题和大小
        self.setWindowTitle("文件哈希校验工具 v0.1 by: B站·宝藏二哥")
        self.setGeometry(100, 100, 900, 600)

        # 创建中心部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        # 创建主布局
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)

        # 创建左侧边栏
        sidebar = QWidget()
        sidebar.setFixedWidth(200)
        sidebar_layout = QVBoxLayout(sidebar)

        # 左侧边栏（无标题）
        sidebar_layout.addSpacing(10)

        # 添加导航按钮
        nav_buttons_info = [
            ("📒 记事本", self.open_system_notepad),
            ("📋 历史记录", self.show_history),
            ("⚙️ 设置", self.show_settings),
        ]
        for button_text, callback in nav_buttons_info:
            button = QPushButton(button_text)
            button.setStyleSheet(
                "text-align: left; padding: 10px; "
                "border: none; border-radius: 4px; "
                "background-color: transparent; font-family: Microsoft YaHei; font-size: 12px;"
            )
            # 使用完整的导入路径确保Qt变量可用
            from PyQt5.QtCore import Qt
            from PyQt5.QtGui import QCursor

            button.setCursor(QCursor(Qt.PointingHandCursor))
            button.clicked.connect(callback)
            self.nav_buttons[button_text.split()[1]] = button
            sidebar_layout.addWidget(button)

        sidebar_layout.addSpacing(10)

        # 添加算法选择区域
        algorithms_group = QGroupBox("算法")
        algorithms_layout = QVBoxLayout(algorithms_group)

        self.algorithm_group = QButtonGroup()
        self.algorithms = [
            ("SHA-256", "sha256"),
            ("MD5", "md5"),
            ("SHA-1", "sha1"),
            ("SHA-512", "sha512"),
        ]

        # 创建算法ID映射
        self.algorithm_ids = {algo[1]: idx for idx, algo in enumerate(self.algorithms)}

        for idx, (text, value) in enumerate(self.algorithms):
            radio = QRadioButton(text)
            radio.setStyleSheet("margin: 2px 0;")  # 减小行距
            self.algorithm_group.addButton(radio, idx)  # 使用整数ID
            algorithms_layout.addWidget(radio)

        # 恢复上次选择的算法，默认SHA-256
        saved_algo = self.config_manager.get_config("algorithm", "sha256")
        saved_id = next(
            (
                idx
                for idx, (_, algo) in enumerate(self.algorithms)
                if algo == saved_algo
            ),
            0,
        )
        self.algorithm_group.button(saved_id).setChecked(True)

        sidebar_layout.addWidget(algorithms_group)

        # 添加占位符，将后续内容推到下方
        sidebar_layout.addStretch()

        # 添加 bilibili 图片
        bilibili_path = (
            Path(__file__).parent.parent / "resources" / "images" / "bilibili.png"
        )
        if bilibili_path.exists():
            from PyQt5.QtCore import Qt, QUrl
            from PyQt5.QtGui import QCursor, QDesktopServices, QPixmap

            # 创建图片标签
            bilibili_label = QLabel()
            pixmap = QPixmap(str(bilibili_path))
            # 缩放图片以适应侧边栏
            scaled_pixmap = pixmap.scaled(
                200, 168, Qt.KeepAspectRatio, Qt.SmoothTransformation
            )
            bilibili_label.setPixmap(scaled_pixmap)
            bilibili_label.setAlignment(Qt.AlignCenter)
            # 设置鼠标指针为手形
            bilibili_label.setCursor(QCursor(Qt.PointingHandCursor))

            # 添加点击事件
            def on_bilibili_click(event):
                try:
                    url = QUrl("https://space.bilibili.com/67221461")
                    QDesktopServices.openUrl(url)
                except Exception as e:
                    print(f"打开链接失败: {e}")

            bilibili_label.mousePressEvent = on_bilibili_click
            sidebar_layout.addWidget(bilibili_label)

            # 添加文字提示
            bilibili_prompt_label = QLabel(
                self.language_map[self.current_language]["bilibili_prompt"]
            )
            bilibili_prompt_label.setStyleSheet(
                "font-family: Microsoft YaHei; font-size: 12px; color: #666; margin-top: 2px;"
            )
            bilibili_prompt_label.setAlignment(Qt.AlignCenter)
            # 为文字也添加点击事件
            bilibili_prompt_label.setCursor(QCursor(Qt.PointingHandCursor))
            bilibili_prompt_label.mousePressEvent = on_bilibili_click
            sidebar_layout.addWidget(bilibili_prompt_label)

        # 添加到主布局
        main_layout.addWidget(sidebar)

        # 创建右侧主内容区域
        main_content = QWidget()
        main_content_layout = QVBoxLayout(main_content)

        # 添加标题和工具按钮区域
        header_layout = QHBoxLayout()

        # 标题
        title = QLabel("文件哈希校验工具")
        title.setStyleSheet(
            "font-family: Microsoft YaHei; font-size: 18px; font-weight: bold;"
        )
        header_layout.addWidget(title)

        # 工具按钮
        tools_layout = QHBoxLayout()

        # 添加语言切换按钮
        self.language_button = QPushButton("🇨🇳")
        self.language_button.setFixedSize(30, 30)
        self.language_button.setStyleSheet("border: none; font-size: 16px;")
        self.language_button.clicked.connect(self.toggle_language)
        tools_layout.addWidget(self.language_button)

        # 添加暗黑模式切换按钮
        theme_button = QPushButton("🌙")
        theme_button.setFixedSize(30, 30)
        theme_button.setStyleSheet("border: none; font-size: 16px;")
        theme_button.clicked.connect(self.toggle_theme)
        tools_layout.addWidget(theme_button)

        header_layout.addStretch()
        header_layout.addLayout(tools_layout)

        main_content_layout.addLayout(header_layout)
        main_content_layout.addSpacing(10)

        # 创建文件列表（支持拖放和多选）
        self.file_list_label = QLabel("文件列表（支持拖放多个文件或文件夹）")
        self.file_list_label.setStyleSheet(
            "font-family: Microsoft YaHei; font-size: 12px; color: #666; margin-bottom: 10px;"
        )
        main_content_layout.addWidget(self.file_list_label)

        self.file_list_widget = DragDropFileListWidget(self)
        self.file_list_widget.setAlternatingRowColors(True)
        main_content_layout.addWidget(self.file_list_widget)

        # 文件列表操作按钮
        file_list_btn_layout = QHBoxLayout()

        add_files_button = QPushButton("添加文件")
        add_files_button.setStyleSheet(
            "padding: 8px 16px; background-color: #4CAF50; color: white; border-radius: 4px;"
        )
        add_files_button.clicked.connect(self.browse_files)

        add_folder_button = QPushButton("添加文件夹")
        add_folder_button.setStyleSheet(
            "padding: 8px 16px; background-color: #2196F3; color: white; border-radius: 4px;"
        )
        add_folder_button.clicked.connect(self.browse_folder)

        clear_list_button = QPushButton("清空列表")
        clear_list_button.setStyleSheet(
            "padding: 8px 16px; background-color: #f44336; color: white; border-radius: 4px;"
        )
        clear_list_button.clicked.connect(self.clear_file_list)

        file_list_btn_layout.addWidget(add_files_button)
        file_list_btn_layout.addWidget(add_folder_button)
        file_list_btn_layout.addStretch()
        file_list_btn_layout.addWidget(clear_list_button)

        main_content_layout.addLayout(file_list_btn_layout)

        # 创建哈希验证区域
        verify_group = QGroupBox("验证哈希值 (可选)")
        verify_layout = QVBoxLayout(verify_group)
        verify_layout.setContentsMargins(20, 20, 20, 20)

        # 预期哈希值输入
        expected_layout = QVBoxLayout()
        self.expected_hash_input = QTextEdit()
        self.expected_hash_input.setPlaceholderText("在此粘贴预期的哈希值...")
        self.expected_hash_input.setFixedHeight(60)
        expected_layout.addWidget(self.expected_hash_input)
        verify_layout.addLayout(expected_layout)

        # 按钮布局
        button_layout = QHBoxLayout()
        button_layout.setSpacing(10)

        # 比较按钮
        compare_button = QPushButton("比较哈希值")
        compare_button.setStyleSheet(
            "padding: 10px; background-color: #333; color: white; border-radius: 4px;"
        )
        compare_button.clicked.connect(self.compare_hash)
        button_layout.addWidget(compare_button)

        # 快速比较按钮
        quick_compare_button = QPushButton("快速比较")
        quick_compare_button.setStyleSheet(
            "padding: 10px; background-color: #4CAF50; color: white; border-radius: 4px;"
        )
        quick_compare_button.clicked.connect(self.quick_compare)
        button_layout.addWidget(quick_compare_button)

        verify_layout.addLayout(button_layout)

        main_content_layout.addWidget(verify_group)

        # 创建进度显示区域
        progress_group = QGroupBox("计算进度")
        progress_layout = QVBoxLayout(progress_group)

        self.progress_bar = QProgressBar()
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        self.progress_bar.setValue(0)
        self.progress_bar.setVisible(False)
        # 增强进度条样式
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                border: 2px solid #ddd;
                border-radius: 5px;
                background-color: #f0f0f0;
                padding: 2px;
                text-align: center;
            }
            QProgressBar::chunk {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #4CAF50, stop:1 #45a049);
                border-radius: 3px;
            }
        """)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat("%p%")

        self.progress_label = QLabel("就绪")
        self.progress_label.setStyleSheet(
            "font-family: Microsoft YaHei; color: #666; font-size: 11px;"
        )

        progress_layout.addWidget(self.progress_bar)
        progress_layout.addWidget(self.progress_label)

        main_content_layout.addWidget(progress_group)

        # 创建计算结果区域
        result_group = QGroupBox("计算结果")
        result_layout = QVBoxLayout(result_group)
        result_layout.setContentsMargins(20, 20, 20, 20)

        self.result_display = QTextEdit()
        self.result_display.setReadOnly(True)
        self.result_display.setPlaceholderText("计算结果将显示在这里...")
        result_layout.addWidget(self.result_display)

        # 按钮布局
        button_layout = QHBoxLayout()

        self.calculate_button = QPushButton("开始批量校验")
        self.calculate_button.setStyleSheet(
            "padding: 10px; background-color: #4CAF50; color: white; border-radius: 4px;"
        )
        self.calculate_button.clicked.connect(self.start_batch_validation)
        button_layout.addWidget(self.calculate_button)

        self.pause_button = QPushButton("暂停")
        self.pause_button.setStyleSheet(
            "padding: 10px; background-color: #FF9800; color: white; border-radius: 4px;"
        )
        self.pause_button.clicked.connect(self.toggle_pause)
        self.pause_button.setEnabled(False)
        button_layout.addWidget(self.pause_button)

        self.stop_button = QPushButton("取消")
        self.stop_button.setStyleSheet(
            "padding: 10px; background-color: #f44336; color: white; border-radius: 4px;"
        )
        self.stop_button.clicked.connect(self.stop_batch)
        self.stop_button.setEnabled(False)
        button_layout.addWidget(self.stop_button)

        self.copy_button = QPushButton("复制结果")
        self.copy_button.setStyleSheet(
            "padding: 10px; background-color: #2196F3; color: white; border-radius: 4px;"
        )
        self.copy_button.clicked.connect(self.copy_result)
        self.copy_button.setEnabled(False)
        button_layout.addWidget(self.copy_button)

        result_layout.addLayout(button_layout)

        main_content_layout.addWidget(result_group)

        # 添加到主布局
        main_layout.addWidget(main_content)

        # 创建状态栏（包含时间显示）
        self.status_bar = QStatusBar()
        self.status_bar.showMessage("就绪")

        # 添加时间标签到状态栏右侧
        self.time_label = QLabel()
        self.time_label.setStyleSheet("padding-right: 10px;")
        self.status_bar.addPermanentWidget(self.time_label)
        self.update_time_display()
        self.time_timer.start(1000)  # 每秒更新一次

        self.setStatusBar(self.status_bar)

        # 启用拖放功能
        self.setAcceptDrops(True)

        # 创建菜单栏
        self._create_menu_bar()

        # 绑定快捷键
        self._setup_shortcuts()

    def _create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()

        # 文件菜单
        file_menu = menubar.addMenu("文件(&F)")

        open_action = QAction("打开文件(&O)", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.browse_files)
        file_menu.addAction(open_action)

        batch_action = QAction("批量处理(&B)", self)
        batch_action.setShortcut("Ctrl+B")
        batch_action.triggered.connect(self.batch_process_folder)
        file_menu.addAction(batch_action)

        file_menu.addSeparator()

        export_action = QAction("导出结果(&E)", self)
        export_action.triggered.connect(self.export_results)
        file_menu.addAction(export_action)

        file_menu.addSeparator()

        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # 编辑菜单
        edit_menu = menubar.addMenu("编辑(&E)")

        copy_action = QAction("复制哈希值(&C)", self)
        copy_action.setShortcut("Ctrl+C")
        copy_action.triggered.connect(self.copy_result)
        edit_menu.addAction(copy_action)

        history_action = QAction("查看历史记录(&H)", self)
        history_action.triggered.connect(self.show_history)
        edit_menu.addAction(history_action)

        # 工具菜单
        tools_menu = menubar.addMenu("工具(&T)")

        clear_history_action = QAction("清空历史记录", self)
        clear_history_action.triggered.connect(self.clear_history)
        tools_menu.addAction(clear_history_action)

        tools_menu.addSeparator()

        import_verify_action = QAction("导入验证文件", self)
        import_verify_action.triggered.connect(self.import_verification_file)
        tools_menu.addAction(import_verify_action)

        # 添加快速指南菜单项（一级菜单，点击直接显示）
        quick_guide_action = QAction("快速指南(&G)", self)
        quick_guide_action.triggered.connect(self.show_quick_guide)
        menubar.addAction(quick_guide_action)

    def _setup_shortcuts(self):
        """设置快捷键"""
        # 快捷键已在菜单中定义

    def _restore_geometry(self):
        """恢复窗口大小和位置"""
        geometry = self.config_manager.get_config("window_geometry")
        if geometry:
            self.restoreGeometry(bytes.fromhex(geometry))

    def closeEvent(self, event):
        """窗口关闭事件"""
        # 保存窗口大小和位置
        geometry_hex = bytes(self.saveGeometry()).hex()
        self.config_manager.set_config("window_geometry", geometry_hex)

        # 保存当前选择的算法
        for button in self.algorithm_group.buttons():
            if button.isChecked():
                algo_id = self.algorithm_group.id(button)
                algo_name = self.algorithms[algo_id][1]
                self.config_manager.set_config("algorithm", algo_name)
                break

        event.accept()

    def browse_files(self):
        """添加文件到列表"""
        files, _ = QFileDialog.getOpenFileNames(self, "选择文件", "", "所有文件 (*.*)")
        if files:
            for file_path in files:
                self.file_list_widget._add_files_recursive(file_path)

    def copy_result(self):
        """复制结果到剪贴板"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        # 优先获取批量处理结果
        if self.batch_manager.results:
            # 收集所有成功计算的哈希值
            hash_values = []
            for result in self.batch_manager.results:
                if result.get("hash"):
                    filename = Path(result.get("path", "")).name
                    hash_value = result.get("hash")
                    hash_values.append(f"{filename}: {hash_value}")

            if hash_values:
                hash_to_copy = "\n".join(hash_values)
            else:
                QMessageBox.warning(
                    self, lang["warning"], lang["please_calculate_hash"]
                )
                return
        # 否则获取单个文件结果
        elif self.calculated_hash:
            hash_to_copy = self.calculated_hash

        if not hash_to_copy:
            QMessageBox.warning(self, lang["warning"], lang["please_calculate_hash"])
            return

        try:
            # 使用PyQt5内置的剪贴板功能
            clipboard = QApplication.clipboard()
            clipboard.setText(hash_to_copy)

            # 复制成功
            self.status_bar.showMessage(lang["clipboard_success"])

        except Exception as e:
            # 显示错误信息
            error_msg = f"复制失败: {str(e)}"
            print(f"复制错误: {error_msg}")
            QMessageBox.warning(self, lang["error"], error_msg)

    def compare_hash(self):
        """比较哈希值 - 支持单个或多行批量对比"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        expected_input = self.expected_hash_input.toPlainText().strip()
        if not expected_input:
            QMessageBox.warning(self, lang["warning"], lang["please_enter_expected"])
            return

        # 获取计算结果（优先批量结果，再次单个文件结果）
        calculated_results = self._get_comparison_results()
        if not calculated_results:
            QMessageBox.warning(self, lang["warning"], lang["please_calculate_hash"])
            return

        # 按行分割预期哈希值
        expected_lines = [
            line.strip() for line in expected_input.split("\n") if line.strip()
        ]

        # 如果预期值只有一行，与第一个结果比较
        if len(expected_lines) == 1:
            return self._compare_single_hash(calculated_results[0], expected_lines[0])

        # 多行比较：每行与对应的计算结果比较
        if len(expected_lines) != len(calculated_results):
            QMessageBox.warning(
                self,
                "警告",
                f"预期哈希值行数 ({len(expected_lines)}) 与计算结果数 ({len(calculated_results)}) 不匹配",
            )
            return

        # 执行逐行比较
        self._compare_multiple_hashes(calculated_results, expected_lines)

    def quick_compare(self):
        """快速比较两个文件的哈希值"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        # 尝试从文件列表中获取文件
        files = self.file_list_widget.get_all_files()

        if len(files) >= 2:
            # 使用文件列表中的前两个文件
            file1 = files[0]
            file2 = files[1]

            # 如果文件列表中有超过两个文件，显示提示信息
            if len(files) > 2:
                QMessageBox.information(self, lang["info"], lang["multiple_files_hint"])
        else:
            # 选择第一个文件
            file1, _ = QFileDialog.getOpenFileName(
                self, f"{lang['select_file']} 1", "", "所有文件 (*.*)"
            )
            if not file1:
                return

            # 选择第二个文件
            file2, _ = QFileDialog.getOpenFileName(
                self, f"{lang['select_file']} 2", "", "所有文件 (*.*)"
            )
            if not file2:
                return

        try:
            # 计算第一个文件的哈希值
            hash1 = self._calculate_quick_hash(file1)
            # 计算第二个文件的哈希值
            hash2 = self._calculate_quick_hash(file2)

            # 比较哈希值
            if hash1 == hash2:
                QMessageBox.information(
                    self,
                    lang["success"],
                    f"✅ {lang['hash_matches']}\n\n文件1: {Path(file1).name}\n文件2: {Path(file2).name}",
                )
            else:
                QMessageBox.warning(
                    self,
                    lang["error"],
                    f"❌ {lang['hash_mismatch']}\n\n文件1: {Path(file1).name}\n文件2: {Path(file2).name}",
                )
        except Exception as e:
            QMessageBox.error(self, lang["error"], f"比较失败: {str(e)}")

    def _calculate_quick_hash(self, file_path):
        """计算文件的快速哈希值，根据文件大小决定计算范围"""
        file_size = Path(file_path).stat().st_size
        max_size = 1 * 1024 * 1024 * 1024  # 1GB
        chunk_size = 8192

        # 创建哈希对象
        hash_obj = hashlib.sha256()

        with open(file_path, "rb") as f:
            if file_size > max_size:
                # 文件大于1GB，只读取前5MB
                bytes_read = 0
                max_read = 5 * 1024 * 1024  # 5MB
                while bytes_read < max_read:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    hash_obj.update(chunk)
                    bytes_read += len(chunk)
            else:
                # 文件小于等于1GB，读取整个文件
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    hash_obj.update(chunk)

        return hash_obj.hexdigest()

    def _get_comparison_results(self):
        """获取用于比较的计算结果"""
        # 优先返回批量处理结果
        if self.batch_manager.results:
            return [
                {
                    "file": result.get("path", ""),
                    "hash": result.get("hash", ""),
                    "status": result.get("status", ""),
                }
                for result in self.batch_manager.results
                if result.get("hash")  # 只返回计算成功的结果
            ]

        # 否则返回单个文件结果
        if self.calculated_hash and self.current_file:
            return [
                {
                    "file": self.current_file,
                    "hash": self.calculated_hash,
                    "status": "success",
                }
            ]

        return []

    def _compare_single_hash(self, result, expected_hash):
        """比较单个哈希值"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        # 验证格式
        if not all(c in "0123456789abcdefABCDEF " for c in expected_hash):
            QMessageBox.warning(
                self,
                lang["warning"],
                "哈希值格式无效，请输入有效的十六进制字符"
                if self.current_language == "zh"
                else "Invalid hash format, please enter valid hexadecimal characters",
            )
            return

        calculated_clean = result["hash"].strip().lower()
        expected_clean = expected_hash.strip().lower().replace(" ", "")

        filename = Path(result["file"]).name
        if calculated_clean == expected_clean:
            QMessageBox.information(
                self,
                "验证结果" if self.current_language == "zh" else "Verification Result",
                f"✓ {filename}\n\n{lang['hash_matches']}",
            )
        else:
            QMessageBox.warning(
                self,
                "验证结果" if self.current_language == "zh" else "Verification Result",
                f"✗ {filename}\n\n{lang['hash_mismatch']}\n\n"
                f"预期: {expected_clean[:32]}...\n"
                f"实际: {calculated_clean[:32]}...",
            )

    def _compare_multiple_hashes(self, results, expected_lines):
        """批量比较多个哈希值"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        comparison_text = f"{lang['comparison_results']}\n\n"
        match_count = 0
        mismatch_count = 0

        for idx, (result, expected) in enumerate(zip(results, expected_lines)):
            # 验证格式
            if not all(c in "0123456789abcdefABCDEF " for c in expected):
                comparison_text += (
                    f"{lang['format_error']}\n"
                    if self.current_language == "en"
                    else f"第 {idx + 1} 行: ✗ {lang['format_error']}\n"
                )
                mismatch_count += 1
                continue

            calculated_clean = result["hash"].strip().lower()
            expected_clean = expected.strip().lower().replace(" ", "")

            filename = Path(result["file"]).name
            if calculated_clean == expected_clean:
                comparison_text += (
                    f"{idx + 1}. ✓ {filename} {lang['match']}\n"
                    if self.current_language == "en"
                    else f"第 {idx + 1} 行: ✓ {filename} {lang['match']}\n"
                )
                match_count += 1
            else:
                comparison_text += (
                    f"{idx + 1}. ✗ {filename} {lang['mismatch']}\n"
                    if self.current_language == "en"
                    else f"第 {idx + 1} 行: ✗ {filename} {lang['mismatch']}\n"
                )
                mismatch_count += 1

        comparison_text += (
            f"\n---\nTotal: {len(results)} | {lang['match']}: {match_count} | {lang['mismatch']}: {mismatch_count}"
            if self.current_language == "en"
            else f"\n---\n总计: {len(results)} | 匹配: {match_count} | 不匹配: {mismatch_count}"
        )

        if mismatch_count == 0:
            QMessageBox.information(
                self,
                "验证结果" if self.current_language == "zh" else "Verification Result",
                comparison_text,
            )
        else:
            QMessageBox.warning(
                self,
                "验证结果" if self.current_language == "zh" else "Verification Result",
                comparison_text,
            )

    def browse_folder(self):
        """浏览文件夹"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        folder_path = QFileDialog.getExistingDirectory(self, lang["select_folder"])
        if folder_path:
            self.file_list_widget._add_files_recursive(folder_path)

    def clear_file_list(self):
        """清空文件列表"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        confirm_text = (
            "确定要清空所有文件吗？"
            if self.current_language == "zh"
            else "Are you sure to clear all files?"
        )
        reply = QMessageBox.question(self, lang["warning"], confirm_text)
        if reply == QMessageBox.Yes:
            self.file_list_widget.clear()
            self.result_display.clear()
            self.copy_button.setEnabled(False)  # 禁用复制结果按钮
            self.pause_button.setEnabled(False)  # 禁用暂停按钮
            self.stop_button.setEnabled(False)  # 禁用取消按钮

    def start_batch_validation(self):
        """开始批量验证"""
        try:
            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]

            files = self.file_list_widget.get_all_files()

            if not files:
                QMessageBox.warning(self, lang["warning"], lang["please_select_file"])
                return

            self.batch_manager.clear()
            self.batch_manager.add_files(files)
            self.batch_start_time = time.time()
            self.is_batch_running = True

            # 更新UI状态
            self.calculate_button.setEnabled(False)
            self.pause_button.setEnabled(True)
            self.stop_button.setEnabled(True)
            self.file_list_widget.reset_colors()
            self.result_display.clear()

            # 显示进度条
            self.progress_bar.setVisible(True)
            self.progress_bar.setValue(0)
            self.progress_label.setText("准备计算...")

            # 开始处理第一个文件
            self._process_next_file()
        except Exception as e:
            error_msg = f"启动批量验证失败: {str(e)}"
            print(f"错误: {error_msg}")
            import traceback

            traceback.print_exc()
            QMessageBox.critical(self, "错误", error_msg)
            self.is_batch_running = False
            self.calculate_button.setEnabled(True)
            self.pause_button.setEnabled(False)
            self.stop_button.setEnabled(False)

    def _process_next_file(self):
        """处理下一个文件"""
        try:
            if self.batch_manager.is_complete():
                self._batch_complete()
                return

            file_path = self.batch_manager.get_current_file()
            if not file_path:
                return

            # 获取当前算法
            current_algo = self._get_current_algorithm()

            # 检查缓存
            cached_hash = self.batch_manager.get_cached_hash(file_path, current_algo)
            if cached_hash:
                # 使用缓存结果
                self._on_file_finished(
                    file_path, current_algo, cached_hash, 0, cached=True
                )
                return

            # 创建计算线程
            self.calculator_thread = HashCalculatorThread(file_path, current_algo)
            self.calculator_thread.progress.connect(self.on_progress_update)
            self.calculator_thread.finished.connect(
                lambda h, t: self._on_file_finished(file_path, current_algo, h, t)
            )
            self.calculator_thread.error.connect(self._on_file_error)
            self.calculator_thread.start()
        except Exception as e:
            error_msg = f"处理文件时出错: {str(e)}"
            print(f"错误: {error_msg}")
            import traceback

            traceback.print_exc()
            QMessageBox.critical(self, "错误", error_msg)
            self.is_batch_running = False
            self.calculate_button.setEnabled(True)

    def _on_file_finished(
        self, file_path, algorithm, hash_value, elapsed_time, cached=False
    ):
        """文件处理完成"""
        try:
            progress, total = self.batch_manager.get_progress()

            # 缓存哈希值
            self.batch_manager.cache_hash(file_path, algorithm, hash_value)

            # 标记为成功
            self.file_list_widget.mark_completed(progress, hash_value, "success")

            # 添加结果
            self.batch_manager.add_result(
                file_path, algorithm, hash_value, "success", elapsed_time
            )

            # 更新结果显示（HTML格式）
            filename = Path(file_path).name
            time_str = f" (耗时: {elapsed_time:.2f}秒)" if elapsed_time > 0 else ""
            cache_note = " [来自缓存]" if cached else ""
            self.result_display.append(
                f"<b>✓ {filename}</b>{cache_note}<br>"
                f"<span style='color:#666; word-break: break-all;'>{hash_value}</span>{time_str}"
            )

            # 更新进度
            progress_text = f"进度: {progress + 1}/{total}"
            self.progress_label.setText(progress_text)
            progress_percent = int((progress + 1) / total * 100)
            self.progress_bar.setValue(progress_percent)
            self.status_bar.showMessage(f"{progress_text} ({progress_percent}%)")

            # 移动到下一个文件
            self.batch_manager.move_to_next()
            self._process_next_file()
        except Exception as e:
            error_msg = f"处理完成时出错: {str(e)}"
            print(f"错误: {error_msg}")
            import traceback

            traceback.print_exc()
            QMessageBox.critical(self, "错误", error_msg)
            self.is_batch_running = False
            self.calculate_button.setEnabled(True)

    def _on_file_error(self, error_msg):
        """文件处理出错"""
        try:
            progress, total = self.batch_manager.get_progress()

            # 标记为错误
            self.file_list_widget.mark_completed(progress, "", "error")

            # 添加结果
            current_file = self.batch_manager.get_current_file()
            self.batch_manager.add_result(
                current_file,
                self._get_current_algorithm(),
                "",
                "error",
                0,
            )

            # 更新结果显示
            if current_file:
                filename = Path(current_file).name
                self.result_display.append(
                    f"<span style='color:#f44336'><b>✗ {filename}</b></span><br>"
                    f"<span style='color:#f44336'>{error_msg}</span>"
                )

            # 继续处理下一个文件
            self.batch_manager.move_to_next()
            self._process_next_file()
        except Exception as e:
            error_detail = f"处理错误时出错: {str(e)}"
            print(f"错误: {error_detail}")
            import traceback

            traceback.print_exc()
            self.batch_manager.move_to_next()
            self._process_next_file()

    def _batch_complete(self):
        """批量处理完成"""
        try:
            self.is_batch_running = False

            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]

            # 计算统计信息
            stats = self.batch_manager.get_statistics()
            total_time = time.time() - self.batch_start_time

            # 显示完成信息
            self.result_display.append(
                f"<hr><span style='color:#409EFF'><b>"
                f"✓ {lang['batch_complete']}</b></span><br>"
                f"<span style='color:#666'>{lang['total_files']}: {stats['total']} | "
                f"{lang['success_count']}: {stats['success']} | "
                f"{lang['error_count']}: {stats['error']}<br>"
                f"{lang['total_time']}: {total_time:.2f}秒</span>"
            )

            # 恢复UI状态
            self.calculate_button.setEnabled(True)
            self.pause_button.setEnabled(False)
            self.stop_button.setEnabled(False)
            self.copy_button.setEnabled(True)  # 启用复制结果按钮
            self.progress_bar.setValue(100)
            self.progress_label.setText(
                f"{lang['completed']}! {lang['total_time']}: {total_time:.2f}秒"
            )
            self.status_bar.showMessage(lang["batch_complete"])
        except Exception as e:
            error_msg = f"完成处理时出错: {str(e)}"
            print(f"错误: {error_msg}")
            import traceback

            traceback.print_exc()
            self.is_batch_running = False
            self.calculate_button.setEnabled(True)
            QMessageBox.critical(self, "错误", error_msg)

    def on_progress_update(self, progress):
        """进度更新回调"""
        try:
            if self.progress_bar:
                self.progress_bar.setValue(progress)
                self.progress_label.setText(f"文件进度: {progress}%")
        except Exception as e:
            print(f"进度更新错误: {e}")

    def toggle_pause(self):
        """暂停/继续"""
        if not self.calculator_thread:
            return

        if self.pause_button.text() == "暂停":
            self.calculator_thread.pause()
            self.pause_button.setText("继续")
        else:
            self.calculator_thread.resume()
            self.pause_button.setText("暂停")

    def stop_batch(self):
        """停止批量处理"""
        if self.calculator_thread and self.calculator_thread.isRunning():
            self.calculator_thread.stop()
            self.calculator_thread.wait()

        self.is_batch_running = False
        self.calculate_button.setEnabled(True)
        self.pause_button.setEnabled(False)
        self.stop_button.setEnabled(False)
        self.copy_button.setEnabled(False)  # 禁用复制结果按钮
        self.pause_button.setText("暂停")
        self.status_bar.showMessage("批量校验已取消")

    def dragEnterEvent(self, event: QDragEnterEvent):
        """拖放事件处理"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        """放置事件处理"""
        if event.mimeData().hasUrls():
            for url in event.mimeData().urls():
                file_path = url.toLocalFile()
                self.file_list_widget._add_files_recursive(file_path)

    def batch_process_folder(self):
        """批量处理文件夹中的所有文件"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        folder_path = QFileDialog.getExistingDirectory(self, lang["select_folder"])
        if not folder_path:
            return

        folder_path = Path(folder_path)
        files = list(folder_path.glob("**/*"))
        files = [f for f in files if f.is_file()]

        if not files:
            QMessageBox.warning(self, lang["warning"], lang["no_files"])
            return

        self.current_batch_files = files
        msg = lang["found_files"].format(count=len(files))
        reply = QMessageBox.question(self, lang["batch_processing"], msg)

        if reply == QMessageBox.Yes:
            self._process_batch_files()

    def _process_batch_files(self):
        """处理批量文件"""
        processing_text = (
            "批量处理中" if self.current_language == "zh" else "Processing files"
        )
        self.status_bar.showMessage(
            f"{processing_text} (0/{len(self.current_batch_files)})"
        )
        results = []

        for idx, file_path in enumerate(self.current_batch_files):
            try:
                # 获取当前算法
                current_algo = None
                for button in self.algorithm_group.buttons():
                    if button.isChecked():
                        algo_id = self.algorithm_group.id(button)
                        current_algo = self.algorithms[algo_id][1]
                        break

                if not current_algo:
                    continue

                # 计算哈希值
                hash_obj = getattr(__import__("hashlib"), current_algo)()
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(8192), b""):
                        hash_obj.update(chunk)

                hash_value = hash_obj.hexdigest()
                results.append(
                    {
                        "path": str(file_path),
                        "algorithm": current_algo,
                        "hash": hash_value,
                        "timestamp": datetime.now().isoformat(),
                    }
                )

                self.status_bar.showMessage(
                    f"{processing_text} ({idx + 1}/{len(self.current_batch_files)})"
                )

            except Exception as e:
                print(f"处理 {file_path} 失败: {e}")

        if results:
            self.current_batch_files = []
            self._show_batch_results(results)

    def _show_batch_results(self, results):
        """显示批量处理结果"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        text = f"{lang['batch_complete']}\n\n"
        for result in results[:10]:  # 显示前 10 个
            filename = Path(result["path"]).name
            text += f"{filename}: {result['hash'][:16]}...\n"

        if len(results) > 10:
            more_text = "还有" if self.current_language == "zh" else "and"
            file_text = "个文件" if self.current_language == "zh" else "more files"
            text += f"\n... {more_text} {len(results) - 10} {file_text}"

        QMessageBox.information(self, lang["batch_processing"], text)

        # 提示保存结果
        export_text = (
            "是否导出结果到文件？"
            if self.current_language == "zh"
            else "Export results to file?"
        )
        reply = QMessageBox.question(self, lang["export_results"], export_text)

        if reply == QMessageBox.Yes:
            self._export_batch_results(results)

    def _export_batch_results(self, results):
        """导出批量处理结果"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        file_filter = (
            "CSV 文件 (*.csv);;JSON 文件 (*.json)"
            if self.current_language == "zh"
            else "CSV Files (*.csv);;JSON Files (*.json)"
        )
        file_path, _ = QFileDialog.getSaveFileName(
            self, lang["save_results"], "", file_filter
        )

        if not file_path:
            return

        if file_path.endswith(".csv"):
            if self.exporter.export_to_csv(results, file_path):
                QMessageBox.information(
                    self, lang["success"], f"{lang['export_success']}\n{file_path}"
                )
                self.status_bar.showMessage(f"{lang['export_success']}: {file_path}")
            else:
                QMessageBox.critical(self, lang["error"], lang["export_failed"])
        elif file_path.endswith(".json"):
            if self.exporter.export_to_json(results, file_path):
                QMessageBox.information(
                    self, lang["success"], f"{lang['export_success']}\n{file_path}"
                )
                self.status_bar.showMessage(f"{lang['export_success']}: {file_path}")
            else:
                QMessageBox.critical(self, lang["error"], lang["export_failed"])

    def export_results(self):
        """导出当前或历史结果 - 支持批量和单个文件结果"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        # 获取可用的结果
        results = self._get_export_results()
        if not results:
            QMessageBox.warning(self, lang["warning"], lang["no_results"])
            return

        file_filter = (
            "CSV 文件 (*.csv);;JSON 文件 (*.json);;验证文件 (*.txt)"
            if self.current_language == "zh"
            else "CSV Files (*.csv);;JSON Files (*.json);;Verification Files (*.txt)"
        )
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            lang["save_results"],
            "",
            file_filter,
        )

        if not file_path:
            return

        if file_path.endswith(".csv"):
            if self.exporter.export_to_csv(results, file_path):
                QMessageBox.information(
                    self, lang["success"], f"{lang['export_success']}\n{file_path}"
                )
            else:
                QMessageBox.critical(self, lang["error"], lang["export_failed"])
        elif file_path.endswith(".json"):
            if self.exporter.export_to_json(results, file_path):
                QMessageBox.information(
                    self, lang["success"], f"{lang['export_success']}\n{file_path}"
                )
            else:
                QMessageBox.critical(self, lang["error"], lang["export_failed"])
        elif file_path.endswith(".txt"):
            # 验证文件只支持单个文件
            if len(results) > 1:
                QMessageBox.warning(
                    self, lang["warning"], lang["verification_file_single"]
                )
                return

            result = results[0]
            if self.exporter.generate_verification_file(
                result["path"], result["algorithm"], result["hash"], file_path
            ):
                QMessageBox.information(
                    self, lang["success"], f"{lang['export_success']}\n{file_path}"
                )
            else:
                QMessageBox.critical(self, lang["error"], lang["export_failed"])

    def _get_export_results(self):
        """获取用于导出的结果"""
        # 优先返回批量处理结果
        if self.batch_manager.results:
            return [
                {
                    "path": result.get("path", ""),
                    "algorithm": result.get("algorithm", ""),
                    "hash": result.get("hash", ""),
                    "timestamp": result.get("timestamp", datetime.now().isoformat()),
                }
                for result in self.batch_manager.results
            ]

        # 否则返回单个文件结果
        if self.calculated_hash and self.current_file:
            return [
                {
                    "path": self.current_file,
                    "algorithm": self._get_current_algorithm(),
                    "hash": self.calculated_hash,
                    "timestamp": datetime.now().isoformat(),
                }
            ]

        return []

    def show_history(self):
        """显示历史记录"""
        history = self.config_manager.get_history(20)

        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        if not history:
            QMessageBox.information(self, lang["history_title"], lang["history_empty"])
            return

        # 创建历史记录对话框

        dialog = QDialog(self)
        dialog.setWindowTitle(lang["history_title"])
        dialog.setGeometry(200, 200, 600, 400)

        layout = QVBoxLayout(dialog)

        list_widget = QListWidget()
        for record in history:
            filename = Path(record["path"]).name
            algo = record["algorithm"].upper()
            timestamp = record["timestamp"][:19]
            item_text = f"[{algo}] {filename}\n  {timestamp}"
            item = QListWidgetItem(item_text)
            item.setData(Qt.UserRole, record)
            list_widget.addItem(item)

        list_widget.itemDoubleClicked.connect(
            lambda item: self._use_history_item(item.data(Qt.UserRole))
        )

        layout.addWidget(QLabel(lang["history_double_click"]))
        layout.addWidget(list_widget)

        # 按钮布局
        button_layout = QHBoxLayout()
        use_button = QPushButton(lang["use_selected"])
        use_button.clicked.connect(
            lambda: self._use_history_item(
                list_widget.currentItem().data(Qt.UserRole)
                if list_widget.currentItem()
                else None
            )
        )
        button_layout.addWidget(use_button)
        button_layout.addStretch()

        layout.addLayout(button_layout)
        dialog.exec_()

    def _use_history_item(self, record):
        """使用历史记录项"""
        if not record:
            return

        self.current_file = record["path"]
        self.calculated_hash = record["hash"]
        self.result_display.setText(record["hash"])

        # 设置算法
        algo = record["algorithm"]
        for idx, (_, algo_name) in enumerate(self.algorithms):
            if algo_name == algo:
                self.algorithm_group.button(idx).setChecked(True)
                break

        self.status_bar.showMessage(f"已加载历史项: {Path(record['path']).name}")

    def _get_current_algorithm(self):
        """获取当前选择的算法"""
        for button in self.algorithm_group.buttons():
            if button.isChecked():
                algo_id = self.algorithm_group.id(button)
                return self.algorithms[algo_id][1]
        return "sha256"

    def clear_history(self):
        """清空历史记录"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        reply = QMessageBox.question(
            self, lang["warning"], lang["clear_history_confirm"]
        )
        if reply == QMessageBox.Yes:
            self.config_manager.history = []
            self.config_manager.save_history()
            QMessageBox.information(self, lang["success"], lang["history_cleared"])

    def import_verification_file(self):
        """导入验证文件"""
        # 获取当前语言的文本映射
        lang = self.language_map[self.current_language]

        file_path, _ = QFileDialog.getOpenFileName(
            self,
            lang["select_folder"],
            "",
            "验证文件 (*.txt *.sha *.md5);;所有文件 (*.*)"
            if self.current_language == "zh"
            else "Verification Files (*.txt *.sha *.md5);;All Files (*.*)",
        )

        if not file_path:
            return

        results = self.exporter.import_verification_file(file_path)
        if not results:
            QMessageBox.warning(self, lang["error"], lang["import_error"])
            return

        msg = f"{lang['import_success'].format(count=len(results))}\n\n"
        for result in results[:5]:
            msg += f"{result['filename']}: {result['hash'][:16]}...\n"
        if len(results) > 5:
            msg += f"\n... {'还有' if self.current_language == 'zh' else 'and'} {len(results) - 5} {'条记录' if self.current_language == 'zh' else 'more records'}"

        QMessageBox.information(self, lang["success"], msg)

    def show_quick_guide(self):
        """显示快速指南"""
        try:
            # 读取quick_start.html文件
            if getattr(sys, "frozen", False):
                # PyInstaller 打包环境
                guide_path = Path(sys._MEIPASS) / "docs" / "quick_start.html"
            else:
                # 开发环境
                guide_path = Path(__file__).parent.parent / "docs" / "quick_start.html"
            if guide_path.exists():
                with open(guide_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # 创建对话框
                dialog = QDialog(self)
                lang = self.language_map[self.current_language]
                dialog.setWindowTitle(f"{lang['menu_guide']} - HashValidatorPlus")
                dialog.resize(900, 700)

                # 创建布局
                layout = QVBoxLayout(dialog)

                # 创建文本浏览器显示HTML内容
                text_browser = QTextBrowser()
                text_browser.setOpenExternalLinks(True)

                # 根据当前主题修改HTML内容
                if self.dark_mode:
                    # 暗黑模式：修改HTML内容，确保所有文本为亮色
                    modified_content = content

                    # 设置整体背景和文本颜色
                    modified_content = modified_content.replace(
                        "<body>",
                        '<body style="background-color: #1a1a1a; color: #ffffff;">',
                    )

                    # 修改所有文本元素的颜色
                    modified_content = modified_content.replace(
                        "<h1>", '<h1 style="color: #4CAF50;">'
                    )
                    modified_content = modified_content.replace(
                        "<h2>", '<h2 style="color: #81C784;">'
                    )
                    modified_content = modified_content.replace(
                        "<h3>", '<h3 style="color: #A5D6A7;">'
                    )
                    modified_content = modified_content.replace(
                        "<p>", '<p style="color: #ffffff;">'
                    )
                    modified_content = modified_content.replace(
                        "<li>", '<li style="color: #ffffff;">'
                    )
                    modified_content = modified_content.replace(
                        "<a href", '<a style="color: #4CAF50;" href'
                    )
                    modified_content = modified_content.replace(
                        "<ul>", '<ul style="color: #ffffff;">'
                    )
                    modified_content = modified_content.replace(
                        "<ol>", '<ol style="color: #ffffff;">'
                    )
                    modified_content = modified_content.replace(
                        "<span>", '<span style="color: #ffffff;">'
                    )

                    # 修改代码块
                    modified_content = modified_content.replace(
                        "<pre>",
                        '<pre style="background-color: #2d2d2d; color: #e0e0e0;">',
                    )
                    modified_content = modified_content.replace(
                        "<code>", '<code style="color: #e0e0e0;">'
                    )

                    # 修改表格
                    modified_content = modified_content.replace(
                        "<table>",
                        '<table style="background-color: #2d2d2d; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        "<th>",
                        '<th style="background-color: #3498db; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        "<td>", '<td style="color: #ffffff;">'
                    )

                    # 修改特殊容器
                    modified_content = modified_content.replace(
                        '<div class="feature-section">',
                        '<div class="feature-section" style="background-color: #2d2d2d; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        '<div class="tip-box">',
                        '<div class="tip-box" style="background-color: #333; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        '<div class="warning-box">',
                        '<div class="warning-box" style="background-color: #333; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        '<div class="info-box">',
                        '<div class="info-box" style="background-color: #333; color: #ffffff;">',
                    )
                    modified_content = modified_content.replace(
                        '<div class="toc">',
                        '<div class="toc" style="background-color: #2d2d2d; color: #ffffff;">',
                    )

                    # 显示修改后的内容
                    text_browser.setHtml(modified_content)
                else:
                    # 明亮模式：直接显示原始内容
                    text_browser.setHtml(content)

                # 添加到布局
                layout.addWidget(text_browser)

                # 添加关闭按钮
                button_box = QDialogButtonBox(QDialogButtonBox.Ok)
                button_box.accepted.connect(dialog.accept)
                layout.addWidget(button_box)

                # 显示对话框
                dialog.exec_()
            else:
                lang = self.language_map[self.current_language]
                QMessageBox.warning(
                    self, lang["error"], "quick_start.html file not found"
                )
        except Exception as e:
            lang = self.language_map[self.current_language]
            QMessageBox.critical(
                self, lang["error"], f"Failed to display quick guide: {e}"
            )

    def toggle_theme(self):
        """切换暗黑模式"""
        try:
            self.dark_mode = not self.dark_mode
            if self.dark_mode:
                self.apply_dark_theme()
                self.config_manager.set_config("theme", "dark")
            else:
                self.apply_light_theme()
                self.config_manager.set_config("theme", "light")
            # 更新导航按钮颜色
            self._update_nav_buttons_color()
            # 更新界面文本
            self.update_ui_text()
        except Exception as e:
            print(f"主题切换错误: {e}")

    def toggle_language(self):
        """切换语言"""
        try:
            # 切换语言
            self.current_language = "en" if self.current_language == "zh" else "zh"

            # 更新语言按钮图标
            self.language_button.setText(
                "🇺🇸" if self.current_language == "en" else "🇨🇳"
            )

            # 保存语言设置
            self.config_manager.set_config("language", self.current_language)

            # 更新界面文本
            self.update_ui_text()
        except Exception as e:
            print(f"语言切换错误: {e}")

    def update_ui_text(self):
        """更新界面文本"""
        try:
            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]

            # 更新窗口标题
            self.setWindowTitle(lang["window_title"])

            # 更新左侧边栏标题
            # 注意：需要找到 app_title 标签并更新
            for widget in self.findChildren(QLabel):
                if (
                    widget.text() == "文件哈希校验工具"
                    or widget.text() == "File Hash Validator"
                ):
                    widget.setText(lang["app_title"])
                    break

            # 更新文件列表标签
            if hasattr(self, "file_list_label"):
                self.file_list_label.setText(lang["file_list_label"])

            # 更新按钮文本
            for widget in self.findChildren(QPushButton):
                current_text = widget.text()
                if current_text == "添加文件" or current_text == "Add Files":
                    widget.setText(lang["add_files"])
                elif current_text == "添加文件夹" or current_text == "Add Folder":
                    widget.setText(lang["add_folder"])
                elif current_text == "清空列表" or current_text == "Clear List":
                    widget.setText(lang["clear_list"])
                elif current_text == "比较哈希值" or current_text == "Compare Hash":
                    widget.setText(lang["compare_hash"])
                elif current_text == "快速比较" or current_text == "Quick Compare":
                    widget.setText(lang["quick_compare"])
                elif (
                    current_text == "开始批量校验"
                    or current_text == "Start Batch Validation"
                ):
                    widget.setText(lang["start_batch"])
                elif current_text == "暂停" or current_text == "Pause":
                    widget.setText(lang["pause"])
                elif current_text == "取消" or current_text == "Stop":
                    widget.setText(lang["stop"])
                elif current_text == "复制结果" or current_text == "Copy Result":
                    widget.setText(lang["copy_result"])
                # 更新导航按钮文本
                elif current_text == "📒 记事本":
                    widget.setText(
                        "📒 Notepad" if self.current_language == "en" else "📒 记事本"
                    )
                elif current_text == "📋 历史记录":
                    widget.setText(
                        "📋 History" if self.current_language == "en" else "📋 历史记录"
                    )
                elif current_text == "⚙️ 设置":
                    widget.setText(
                        "⚙️ Settings" if self.current_language == "en" else "⚙️ 设置"
                    )

            # 更新分组框标题
            for widget in self.findChildren(QGroupBox):
                current_title = widget.title()
                if current_title == "验证哈希值 (可选)":
                    widget.setTitle(lang["verify_group"])
                elif current_title == "计算进度":
                    widget.setTitle(lang["progress_group"])
                elif current_title == "计算结果":
                    widget.setTitle(lang["result_group"])
                elif current_title == "算法":
                    widget.setTitle(lang["algorithms"])

            # 更新所有标签文本
            for widget in self.findChildren(QLabel):
                current_text = widget.text()
                # 应用标题（右侧主标题）
                if (
                    current_text == "文件哈希校验工具"
                    or current_text == "File Hash Validator"
                ):
                    widget.setText(lang["app_title"])
                # 文件列表标签
                elif (
                    current_text == "文件列表（支持拖放多个文件或文件夹）"
                    or current_text
                    == "File List (Supports drag and drop multiple files or folders)"
                ):
                    widget.setText(lang["file_list_label"])
                # 预期哈希值标签
                elif current_text == "预期哈希值:" or current_text == "Expected Hash:":
                    widget.setText(lang["expected_hash"])
                # 快速提示
                elif "快速提示" in current_text or "Quick Tip" in current_text:
                    widget.setText(lang["quick_tip"])
                # 算法组标题
                elif current_text == "算法" or current_text == "Algorithms":
                    widget.setText(lang["algorithms"])
                # 状态栏文本
                elif current_text == "就绪" or current_text == "Ready":
                    widget.setText(lang["ready"])
                # bilibili提示文本
                elif (
                    current_text == "来 B 站找我玩"
                    or current_text == "Come find me on bilibili"
                ):
                    widget.setText(lang["bilibili_prompt"])

            # 更新输入框占位符文本
            for widget in self.findChildren(QTextEdit):
                # 预期哈希值输入框
                if (
                    widget.placeholderText() == "在此粘贴预期的哈希值..."
                    or widget.placeholderText() == "Paste expected hash value here..."
                ):
                    widget.setPlaceholderText(
                        "Paste expected hash value here..."
                        if self.current_language == "en"
                        else "在此粘贴预期的哈希值..."
                    )
                # 计算结果显示框
                elif (
                    widget.placeholderText() == "计算结果将显示在这里..."
                    or widget.placeholderText()
                    == "Calculation result will be displayed here..."
                ):
                    widget.setPlaceholderText(
                        "Calculation result will be displayed here..."
                        if self.current_language == "en"
                        else "计算结果将显示在这里..."
                    )

            # 更新状态栏消息
            if hasattr(self, "status_bar"):
                current_message = self.status_bar.currentMessage()
                if current_message == "就绪" or current_message == "Ready":
                    self.status_bar.showMessage(lang["ready"])

            # 更新所有按钮文本
            for widget in self.findChildren(QPushButton):
                current_text = widget.text()
                # 添加文件按钮
                if current_text == "添加文件" or current_text == "Add Files":
                    widget.setText(lang["add_files"])
                # 添加文件夹按钮
                elif current_text == "添加文件夹" or current_text == "Add Folder":
                    widget.setText(lang["add_folder"])
                # 清空列表按钮
                elif current_text == "清空列表" or current_text == "Clear List":
                    widget.setText(lang["clear_list"])
                # 比较哈希值按钮
                elif current_text == "比较哈希值" or current_text == "Compare Hash":
                    widget.setText(lang["compare_hash"])
                # 开始批量校验按钮
                elif (
                    current_text == "开始批量校验"
                    or current_text == "Start Batch Validation"
                ):
                    widget.setText(lang["start_batch"])
                # 暂停按钮
                elif current_text == "暂停" or current_text == "Pause":
                    widget.setText(lang["pause"])
                # 取消按钮
                elif current_text == "取消" or current_text == "Stop":
                    widget.setText(lang["stop"])
                # 复制结果按钮
                elif current_text == "复制结果" or current_text == "Copy Result":
                    widget.setText(lang["copy_result"])
                # 导航按钮
                elif current_text == "📒 记事本" or current_text == "📒 Notepad":
                    widget.setText(
                        "📒 Notepad" if self.current_language == "en" else "📒 记事本"
                    )
                elif current_text == "📋 历史记录" or current_text == "📋 History":
                    widget.setText(
                        "📋 History" if self.current_language == "en" else "📋 历史记录"
                    )
                elif current_text == "⚙️ 设置" or current_text == "⚙️ Settings":
                    widget.setText(
                        "⚙️ Settings" if self.current_language == "en" else "⚙️ 设置"
                    )

            # 更新所有分组框标题
            for widget in self.findChildren(QGroupBox):
                current_title = widget.title()
                # 验证哈希值分组框
                if (
                    current_title == "验证哈希值 (可选)"
                    or current_title == "Verify Hash (Optional)"
                ):
                    widget.setTitle(lang["verify_group"])
                # 计算进度分组框
                elif (
                    current_title == "计算进度"
                    or current_title == "Calculation Progress"
                ):
                    widget.setTitle(lang["progress_group"])
                # 计算结果分组框
                elif (
                    current_title == "计算结果" or current_title == "Calculation Result"
                ):
                    widget.setTitle(lang["result_group"])
                # 算法分组框
                elif current_title == "算法" or current_title == "Algorithms":
                    widget.setTitle(lang["algorithms"])

            # 更新菜单文本
            if hasattr(self, "menuBar"):
                menubar = self.menuBar()
                # 更新菜单文本
                for action in menubar.actions():
                    if action.text() == "文件(&F)" or action.text() == "File(&F)":
                        action.setText(lang["menu_file"])
                    elif action.text() == "编辑(&E)" or action.text() == "Edit(&E)":
                        action.setText(lang["menu_edit"])
                    elif action.text() == "工具(&T)" or action.text() == "Tools(&T)":
                        action.setText(lang["menu_tools"])
                    elif (
                        action.text() == "快速指南(&G)"
                        or action.text() == "Quick Guide(&G)"
                    ):
                        action.setText(lang["menu_guide"])
                    # 更新子菜单
                    if action.menu():
                        for subaction in action.menu().actions():
                            if (
                                subaction.text() == "打开文件(&O)"
                                or subaction.text() == "Open File(&O)"
                            ):
                                subaction.setText(lang["menu_open"])
                            elif (
                                subaction.text() == "批量处理(&B)"
                                or subaction.text() == "Batch Process(&B)"
                            ):
                                subaction.setText(lang["menu_batch"])
                            elif (
                                subaction.text() == "导出结果(&E)"
                                or subaction.text() == "Export Results(&E)"
                            ):
                                subaction.setText(lang["menu_export"])
                            elif (
                                subaction.text() == "退出(&X)"
                                or subaction.text() == "Exit(&X)"
                            ):
                                subaction.setText(lang["menu_exit"])
                            elif (
                                subaction.text() == "复制哈希值(&C)"
                                or subaction.text() == "Copy Hash(&C)"
                            ):
                                subaction.setText(lang["menu_copy"])
                            elif (
                                subaction.text() == "查看历史记录(&H)"
                                or subaction.text() == "View History(&H)"
                            ):
                                subaction.setText(lang["menu_history"])
                            elif (
                                subaction.text() == "清空历史记录"
                                or subaction.text() == "Clear History"
                            ):
                                subaction.setText(lang["menu_clear_history"])
                            elif (
                                subaction.text() == "导入验证文件"
                                or subaction.text() == "Import Verification File"
                            ):
                                subaction.setText(lang["menu_import_verify"])
        except Exception as e:
            print(f"更新界面文本错误: {e}")

    def apply_light_theme(self):
        """应用亮色主题"""
        light_stylesheet = """
            QMainWindow, QDialog { background-color: #f5f5f5; color: #333; }
            QWidget { background-color: #f5f5f5; color: #333; }
            QListWidget { background-color: #fff; border: 1px solid #ddd; }
            QListWidget::item:alternate { background-color: #fff; color: #000; }
            QListWidget::item { background-color: #f9f9f9; color: #000; }
            QTextEdit { background-color: #fff; color: #333; border: 1px solid #ddd; }
            QPushButton { background-color: #2196F3; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; }
            QPushButton:hover { background-color: #1976D2; }
            QPushButton:pressed { background-color: #1565C0; }
            QGroupBox { color: #333; border: 1px solid #ddd; border-radius: 4px; padding-top: 10px; margin-top: 10px; }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 3px 0 3px; }
            QLabel { color: #333; }
            QProgressBar { border: 2px solid #ddd; border-radius: 5px; background-color: #f0f0f0; padding: 2px; }
            QProgressBar::chunk { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4CAF50, stop:1 #45a049); border-radius: 3px; }
            QRadioButton { color: #333; }
            QRadioButton::indicator { width: 16px; height: 16px; }
            QMessageBox QLabel { color: #333; }
            QComboBox { background-color: #fff; color: #333; border: 1px solid #ddd; padding: 5px; }
            QLineEdit { background-color: #fff; color: #333; border: 1px solid #ddd; padding: 5px; }
        """
        self.setStyleSheet(light_stylesheet)

        # 在Windows系统上，尝试设置窗口为亮色标题栏
        import sys

        if sys.platform == "win32":
            try:
                from ctypes import byref, c_int, windll

                # 设置窗口为亮色模式
                windll.dwmapi.DwmSetWindowAttribute(
                    int(self.winId()),
                    20,  # DWMWA_USE_IMMERSIVE_DARK_MODE
                    byref(c_int(0)),
                    4,
                )
            except Exception:
                # 忽略错误，保持默认行为
                pass

    def apply_dark_theme(self):
        """应用暗黑主题"""
        dark_stylesheet = """
            QMainWindow, QDialog { background-color: #1e1e1e; color: #e0e0e0; }
            QWidget { background-color: #1e1e1e; color: #e0e0e0; }
            QListWidget { background-color: #2d2d2d; border: 1px solid #444; color: #e0e0e0; }
            QListWidget::item { background-color: #2d2d2d; color: #e0e0e0; }
            QListWidget::item:alternate { background-color: #fff; color: #000; }
            QTextEdit { background-color: #2d2d2d; color: #e0e0e0; border: 1px solid #444; }
            QPushButton { background-color: #2196F3; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; }
            QPushButton:hover { background-color: #1976D2; }
            QPushButton:pressed { background-color: #1565C0; }
            QGroupBox { color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding-top: 10px; margin-top: 10px; }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 3px 0 3px; }
            QLabel { color: #e0e0e0; }
            QProgressBar { border: 2px solid #444; border-radius: 5px; background-color: #3a3a3a; padding: 2px; }
            QProgressBar::chunk { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #66BB6A, stop:1 #5aaa5e); border-radius: 3px; }
            QRadioButton { color: #e0e0e0; }
            QRadioButton::indicator { width: 16px; height: 16px; }
            QMessageBox QLabel { color: #e0e0e0; }
            QComboBox { background-color: #2d2d2d; color: #e0e0e0; border: 1px solid #444; padding: 5px; }
            QLineEdit { background-color: #2d2d2d; color: #e0e0e0; border: 1px solid #444; padding: 5px; }
        """
        self.setStyleSheet(dark_stylesheet)

        # 在Windows系统上，尝试设置窗口为暗色标题栏
        import sys

        if sys.platform == "win32":
            try:
                from ctypes import byref, c_int, windll

                # 设置窗口为暗色模式
                windll.dwmapi.DwmSetWindowAttribute(
                    int(self.winId()),
                    20,  # DWMWA_USE_IMMERSIVE_DARK_MODE
                    byref(c_int(1)),
                    4,
                )
            except Exception:
                # 忽略错误，保持默认行为
                pass

    def open_system_notepad(self):
        """打开系统记事本"""
        try:
            import subprocess

            subprocess.Popen("notepad.exe")
        except Exception as e:
            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]
            QMessageBox.warning(
                self, lang["error"], f"{lang['notepad_error'].format(error=e)}"
            )

    def show_settings(self):
        """显示设置对话框"""
        try:
            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]

            dialog = QDialog(self)
            dialog.setWindowTitle(lang["settings_title"])
            dialog.setFixedSize(500, 400)  # 增大窗口大小

            # 计算居中位置
            parent_geometry = self.geometry()
            dialog_geometry = dialog.geometry()
            x = (
                parent_geometry.x()
                + (parent_geometry.width() - dialog_geometry.width()) // 2
            )
            y = (
                parent_geometry.y()
                + (parent_geometry.height() - dialog_geometry.height()) // 2
            )
            dialog.move(x, y)

            layout = QVBoxLayout()

            # 主题设置
            theme_group = QGroupBox(lang["appearance_settings"])
            theme_layout = QVBoxLayout()
            theme_text = lang["dark_mode"] if self.dark_mode else lang["light_mode"]
            theme_label = QLabel(f"{lang['current_theme']} {theme_text}")
            theme_button = QPushButton(
                "切换主题" if self.current_language == "zh" else "Toggle Theme"
            )

            def update_theme_label():
                self.toggle_theme()
                theme_text = lang["dark_mode"] if self.dark_mode else lang["light_mode"]
                theme_label.setText(f"{lang['current_theme']} {theme_text}")

            theme_button.clicked.connect(update_theme_label)
            theme_layout.addWidget(theme_label)
            theme_layout.addWidget(theme_button)
            theme_group.setLayout(theme_layout)

            # 算法设置
            algo_group = QGroupBox(
                "支持的算法"
                if self.current_language == "zh"
                else "Supported Algorithms"
            )
            algo_layout = QVBoxLayout()
            for display_name, algo_id in self.algorithms:
                algo_layout.addWidget(QLabel(f"• {display_name}"))
            algo_group.setLayout(algo_layout)

            # 关于
            about_group = QGroupBox(lang["about_title"])
            about_layout = QVBoxLayout()

            # 创建带有超链接的关于文本
            if self.current_language == "zh":
                about_text = QLabel()
                about_text.setTextFormat(1)  # 1 表示 RichText 格式
                about_text.setText(
                    "HashValidatorPlus v0.1.0<br><br>作者：<a href='https://space.bilibili.com/67221461' style='color: #409EFF; text-decoration: none;'>B站 · 宝藏二哥</a>"
                )
            else:
                about_text = QLabel()
                about_text.setTextFormat(1)  # 1 表示 RichText 格式
                about_text.setText(
                    "HashValidatorPlus v0.1.0<br><br>Author: <a href='https://space.bilibili.com/67221461' style='color: #409EFF; text-decoration: none;'>Bilibili · 宝藏二哥</a>"
                )

            # 启用超链接
            about_text.setOpenExternalLinks(True)
            about_layout.addWidget(about_text)
            about_group.setLayout(about_layout)

            layout.addWidget(theme_group)
            layout.addWidget(algo_group)
            layout.addWidget(about_group)
            layout.addStretch()

            close_button = QPushButton(
                "关闭" if self.current_language == "zh" else "Close"
            )
            close_button.clicked.connect(dialog.close)
            layout.addWidget(close_button)

            dialog.setLayout(layout)
            dialog.exec_()
        except Exception as e:
            # 获取当前语言的文本映射
            lang = self.language_map[self.current_language]
            QMessageBox.warning(
                self, lang["error"], f"{lang['notepad_error'].format(error=e)}"
            )

    def update_time_display(self):
        """更新时间显示"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.time_label.setText(f"  {current_time}")

    def _update_nav_buttons_color(self):
        """更新导航按钮颜色"""
        if self.dark_mode:
            # 暗黑模式：白色文字
            button_color = "#e0e0e0"
        else:
            # 亮色模式：深灰文字
            button_color = "#333333"

        for button in self.nav_buttons.values():
            button.setStyleSheet(
                f"text-align: left; padding: 10px; "
                f"border: none; border-radius: 4px; "
                f"background-color: transparent; font-size: 12px; color: {button_color};"
            )


def main():
    """主函数"""
    app = QApplication(sys.argv)
    # 设置全局字体为Microsoft YaHei
    from PyQt5.QtGui import QFont

    font = QFont()
    font.setFamily("Microsoft YaHei")
    font.setPointSize(10)
    app.setFont(font)
    window = HashValidator()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
