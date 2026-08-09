#!/usr/bin/env python
"""
快速诊断脚本
检查打包前的环境和配置
"""

import sys
from pathlib import Path


def check_python_version():
    """检查 Python 版本"""
    version = sys.version_info
    print(f"✓ Python 版本: {version.major}.{version.minor}.{version.micro}")
    if version.major < 3 or (version.major == 3 and version.minor < 6):
        print("  ✗ 需要 Python 3.6+")
        return False
    return True


def check_dependencies():
    """检查依赖"""
    deps = ["PyQt5", "pathlib"]
    missing = []

    for dep in deps:
        try:
            __import__(dep)
            print(f"✓ {dep} 已安装")
        except ImportError:
            print(f"✗ {dep} 未安装")
            missing.append(dep)

    if missing:
        print(f"\n需要安装: pip install {' '.join(missing)}")
        return False
    return True


def check_files():
    """检查必要文件"""
    files = [
        "main.py",
        "app.py",
        "hash_worker.py",
        "batch_manager.py",
        "config.py",
        "file_list.py",
        "exporter.py",
        "pyproject.toml",
        "HashValidatorPlus.spec",
        "app.ico",
    ]

    missing = []
    for file in files:
        if Path(file).exists():
            print(f"✓ {file}")
        else:
            print(f"✗ {file} 缺失")
            missing.append(file)

    return len(missing) == 0


def check_syntax():
    """检查 Python 文件语法"""
    import py_compile

    files = [
        "main.py",
        "app.py",
        "hash_worker.py",
        "batch_manager.py",
        "config.py",
        "file_list.py",
        "exporter.py",
    ]

    all_valid = True
    for file in files:
        try:
            py_compile.compile(file, doraise=True)
            print(f"✓ {file} 语法正确")
        except py_compile.PyCompileError as e:
            print(f"✗ {file} 语法错误: {e}")
            all_valid = False

    return all_valid


def check_spec_file():
    """检查 spec 文件"""
    spec_file = Path("HashValidatorPlus.spec")
    if not spec_file.exists():
        print("✗ HashValidatorPlus.spec 不存在")
        return False

    content = spec_file.read_text(encoding="utf-8")

    # 检查关键项
    checks = [
        ("console=True", "console 模式已启用（调试用）"),
        ("'batch_manager'", "batch_manager 在 hiddenimports 中"),
        ("'hash_worker'", "hash_worker 在 hiddenimports 中"),
        ("'file_list'", "file_list 在 hiddenimports 中"),
        ("'config'", "config 在 hiddenimports 中"),
        ("'exporter'", "exporter 在 hiddenimports 中"),
    ]

    all_valid = True
    for check_str, desc in checks:
        if check_str in content:
            print(f"✓ {desc}")
        else:
            print(f"✗ {desc}")
            all_valid = False

    return all_valid


def check_pyinstaller():
    """检查 PyInstaller"""
    try:
        import PyInstaller

        print(f"✓ PyInstaller 已安装 (版本: {PyInstaller.__version__})")
        return True
    except ImportError:
        print("✗ PyInstaller 未安装")
        print("  请运行: pip install PyInstaller")
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("HashValidatorPlus 打包前诊断")
    print("=" * 60)

    results = []

    print("\n[1] Python 版本检查")
    results.append(check_python_version())

    print("\n[2] 依赖检查")
    results.append(check_dependencies())

    print("\n[3] PyInstaller 检查")
    results.append(check_pyinstaller())

    print("\n[4] 文件检查")
    results.append(check_files())

    print("\n[5] Python 语法检查")
    results.append(check_syntax())

    print("\n[6] Spec 文件检查")
    results.append(check_spec_file())

    print("\n" + "=" * 60)
    if all(results):
        print("✓ 所有检查通过！可以开始打包")
        print("\n打包命令:")
        print("  方法1: python rebuild.py")
        print("  方法2: pyinstaller HashValidatorPlus.spec --onefile")
        return 0
    else:
        print("✗ 某些检查失败，请修复后重试")
        return 1


if __name__ == "__main__":
    sys.exit(main())
