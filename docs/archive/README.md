# 文件哈希校验工具

一个基于PyQt5开发的文件哈希值计算和验证工具，支持多种哈希算法，界面简洁友好，操作方便。

## 功能特性

- **多算法支持**：支持SHA-256、MD5、SHA-1、SHA-512等多种哈希算法
- **文件选择**：支持通过浏览按钮选择文件或直接拖放文件
- **哈希值计算**：快速计算文件的哈希值，支持大文件（最大2GB）
- **哈希值验证**：可与预期哈希值进行比对，验证文件完整性
- **实时进度**：计算过程中显示实时进度
- **错误处理**：友好的错误提示
- **响应式界面**：适配不同屏幕尺寸

## 界面预览

![文件哈希校验工具界面](https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=PyQt%20file%20hash%20validator%20tool%20interface%20with%20Chinese%20language%2C%20showing%20file%20drop%20area%2C%20algorithm%20selection%2C%20hash%20verification%20section%20and%20calculation%20button&image_size=landscape_16_9)

## 安装依赖

本工具基于Python和PyQt5开发，需要安装以下依赖：

```bash
pip install PyQt5
```

## 运行工具

### 方式一：直接运行（开发模式）

1. 确保已安装Python 3.6或更高版本
2. 安装PyQt5依赖：
   ```bash
   pip install -r requirements.txt
   ```
3. 运行主脚本：
   ```bash
   python main.py
   ```

### 方式二：安装并运行（生产模式）

```bash
pip install .
hashvalidatorplus
```

## 使用方法

1. **选择文件**：
   - 点击「浏览文件」按钮选择文件
   - 或直接拖放文件到拖放区域

2. **选择算法**：
   - 在左侧边栏选择需要使用的哈希算法（默认为SHA-256）

3. **计算哈希值**：
   - 点击「计算哈希值」按钮
   - 等待计算完成，结果将显示在「计算结果」区域

4. **验证哈希值**（可选）：
   - 在「验证哈希值」区域选择相同的算法
   - 输入预期的哈希值
   - 点击「比较哈希值」按钮
   - 系统将提示哈希值是否匹配

## 技术实现

- **界面框架**：PyQt5
- **哈希计算**：Python内置的hashlib库
- **多线程**：使用QThread实现后台计算，避免界面卡顿
- **拖放功能**：支持文件拖放操作
- **进度显示**：实时显示计算进度

## 注意事项

- 支持的文件大小最大为2GB
- 计算大文件的哈希值可能需要较长时间
- 请确保选择的算法与预期哈希值使用的算法一致

## 许可证

本项目采用MIT许可证，详见LICENSE文件。