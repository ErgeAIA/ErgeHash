#!/usr/bin/env python
"""
重建 EXE 打包脚本
生成优化后的 PyInstaller spec 文件并打包
"""

import subprocess
import sys
from pathlib import Path


def rebuild_spec():
    """重建 spec 文件"""
    spec_content = """# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('app.ico', '.')],
    hiddenimports=[
        'PyQt5.QtCore',
        'PyQt5.QtGui',
        'PyQt5.QtWidgets',
        'PyQt5.QtPrintSupport',
        'hashlib',
        'threading',
        'time',
        'pathlib',
        'datetime',
        'json',
        'csv',
        'sys',
        'traceback',
        'batch_manager',
        'hash_worker',
        'file_list',
        'config',
        'exporter',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludedimports=[],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HashValidatorPlus',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app.ico',
)
"""
    spec_file = Path("HashValidatorPlus.spec")
    spec_file.write_text(spec_content, encoding="utf-8")
    print(f"✓ 已更新 {spec_file}")
    return spec_file


def build_exe(spec_file):
    """使用 PyInstaller 构建 EXE"""
    print("\n开始构建 EXE...")
    print("=" * 60)

    # 运行 PyInstaller
    cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--onefile"]

    try:
        subprocess.run(cmd, check=True)
        print("=" * 60)
        print("✓ 构建成功！")
        print("\n输出文件: dist/HashValidatorPlus.exe")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ 构建失败: {e}")
        return False


def main():
    """主函数"""
    print("HashValidatorPlus 打包脚本")
    print("=" * 60)

    # 检查必要文件
    required_files = ["main.py", "app.py", "hash_worker.py", "batch_manager.py"]
    for file in required_files:
        if not Path(file).exists():
            print(f"✗ 缺少文件: {file}")
            return False

    # 重建 spec
    spec_file = rebuild_spec()

    # 构建 EXE
    if build_exe(spec_file):
        print("\n✓ 打包完成！")
        print("提示:")
        print("  1. 确保已安装 PyInstaller: pip install PyInstaller")
        print("  2. 输出 EXE 位于: dist/HashValidatorPlus.exe")
        print("  3. 程序现在启用了控制台模式来显示错误信息")
        return True
    else:
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
