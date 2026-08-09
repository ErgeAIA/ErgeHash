#!/usr/bin/env python
"""
PyInstaller 打包脚本
将 HashValidatorPlus 打包成单个 EXE 文件
"""

from pathlib import Path


def create_spec():
    """创建 PyInstaller spec 文件内容"""
    spec_content = """# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('bilibili.png', '.'),
        ('quick_start.html', '.'),
        ('app.ico', '.')
    ],
    hiddenimports=['PyQt5.QtCore', 'PyQt5.QtGui', 'PyQt5.QtWidgets', 'hashlib'],
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
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app.ico'
)
"""
    return spec_content


if __name__ == "__main__":
    spec_file = Path("HashValidatorPlus.spec")
    spec_content = create_spec()
    spec_file.write_text(spec_content)
    print(f"✓ 已创建 {spec_file}")
    print("\n现在运行以下命令来打包:")
    print("  pyinstaller HashValidatorPlus.spec --onefile")
