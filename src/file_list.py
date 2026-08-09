"""
拖放文件列表 Widget
支持多文件拖放、排序、删除等操作
"""

from pathlib import Path

from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor
from PyQt5.QtWidgets import QListWidget, QListWidgetItem, QMenu, QMessageBox


class DragDropFileListWidget(QListWidget):
    """支持拖放的文件列表 Widget"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent_widget = parent
        self.setAcceptDrops(True)
        self.setAlternatingRowColors(True)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self._show_context_menu)

    def dragEnterEvent(self, event):
        """拖进事件"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            self.setStyleSheet("border: 2px dashed #4CAF50; background-color: #f0f8ff;")
        else:
            event.ignore()

    def dragLeaveEvent(self, event):
        """拖离事件"""
        self.setStyleSheet("")

    def dragMoveEvent(self, event):
        """拖动移动事件"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        """放置事件"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            self.setStyleSheet("")

            files_added = 0
            for url in event.mimeData().urls():
                file_path = url.toLocalFile()
                added = self._add_files_recursive(file_path)
                files_added += added

            if files_added > 0:
                msg = f"已添加 {files_added} 个文件"
                if self.parent_widget:
                    self.parent_widget.status_bar.showMessage(msg)
        else:
            event.ignore()

    def _add_files_recursive(self, path):
        """递归添加文件"""
        files_added = 0
        path_obj = Path(path)

        if path_obj.is_file():
            self._add_file_to_list(str(path_obj))
            files_added += 1
        elif path_obj.is_dir():
            # 递归添加所有子文件
            for file_path in path_obj.rglob("*"):
                if file_path.is_file():
                    self._add_file_to_list(str(file_path))
                    files_added += 1

        return files_added

    def _add_file_to_list(self, file_path):
        """添加单个文件到列表"""
        # 检查是否已存在
        for i in range(self.count()):
            if self.item(i).text() == file_path:
                return

        item = QListWidgetItem(file_path)
        item.setData(Qt.UserRole, {"path": file_path, "status": "pending", "hash": ""})
        self.addItem(item)

    def _show_context_menu(self, position):
        """显示右键菜单"""
        menu = QMenu()

        remove_action = menu.addAction("删除选中项")
        remove_action.triggered.connect(self._remove_selected)

        clear_action = menu.addAction("清空列表")
        clear_action.triggered.connect(self._clear_list)

        menu.addSeparator()

        copy_action = menu.addAction("复制文件路径")
        copy_action.triggered.connect(self._copy_path)

        menu.exec_(self.mapToGlobal(position))

    def _remove_selected(self):
        """删除选中的项"""
        for item in self.selectedItems():
            self.takeItem(self.row(item))

    def _clear_list(self):
        """清空列表"""
        reply = QMessageBox.question(self, "确认", "确定要清空所有文件吗？")
        if reply == QMessageBox.Yes:
            self.clear()

    def _copy_path(self):
        """复制文件路径到剪贴板"""
        current_item = self.currentItem()
        if current_item:
            import subprocess
            import sys

            file_path = current_item.text()
            if sys.platform == "win32":
                process = subprocess.Popen(["clip"], stdin=subprocess.PIPE)
                process.communicate(file_path.encode("utf-8"))
            else:
                try:
                    subprocess.run(
                        ["xclip", "-selection", "clipboard"],
                        input=file_path.encode("utf-8"),
                        check=True,
                    )
                except Exception:
                    subprocess.run(
                        ["xsel", "-bi"], input=file_path.encode("utf-8"), check=True
                    )

            if self.parent_widget:
                self.parent_widget.status_bar.showMessage("已复制到剪贴板")

    def get_all_files(self):
        """获取列表中的所有文件"""
        files = []
        for i in range(self.count()):
            item = self.item(i)
            files.append(item.text())
        return files

    def mark_completed(self, row, hash_value, status="success"):
        """标记文件为已完成"""
        if 0 <= row < self.count():
            item = self.item(row)
            data = item.data(Qt.UserRole)
            data["status"] = status
            data["hash"] = hash_value
            item.setData(Qt.UserRole, data)

            # 改变背景色
            if status == "success":
                item.setBackground(QColor(200, 230, 201))  # 浅绿色
            elif status == "mismatch":
                item.setBackground(QColor(255, 205, 210))  # 浅红色
            elif status == "error":
                item.setBackground(QColor(255, 224, 178))  # 浅橙色

    def reset_colors(self):
        """重置所有颜色"""
        for i in range(self.count()):
            item = self.item(i)
            item.setBackground(QColor())
