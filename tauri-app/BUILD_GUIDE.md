# HashValidatorPlus 打包指南

## 前置要求

确保已安装以下工具：

- Node.js (v16+)
- Rust (最新稳定版)
- Tauri CLI

## 打包命令

### 开发模式
```bash
pnpm run tauri dev
```

### 生产打包
```bash
pnpm run tauri build
```

## 打包输出

打包完成后，文件将输出到 `src-tauri/target/release/bundle/` 目录：

### Windows 平台

1. **NSIS 安装包** (`nsis/`)
   - `HashValidatorPlus_0.3.0_x64-setup.exe` - 带界面的安装程序
   - 包含中文/英文语言选择
   - 自动创建桌面快捷方式和开始菜单项

2. **MSI 安装包** (`msi/`)
   - `HashValidatorPlus_0.3.0_x64_en-US.msi` - MSI 安装程序
   - 适合企业环境部署

3. **独立 EXE** (`msi/` 或直接在 `release/` 中)
   - `HashValidatorPlus.exe` - 独立可执行文件
   - 无需安装，双击即可运行

## 配置说明

### Cargo.toml 优化

当前配置已启用以下优化：

```toml
[profile.release]
opt-level = "s"      # 优化大小而非速度
lto = true           # 链接时优化
codegen-units = 1    # 单个代码生成单元（更好优化）
strip = true         # 去除调试符号
panic = "abort"      # 发生 panic 时直接终止
```

### Tauri 配置

主要配置在 `tauri.conf.json` 中：

- `identifier`: `com.hashvalidatorplus.app` (反向域名格式)
- `targets`: `["nsis", "msi", "updater"]` (打包类型)
- 图标: 已配置多种尺寸的图标
- 安全: CSP 已禁用（如需更严格安全可启用）

## 体积优化说明

### 前端优化

1. **代码分割** - `vite.config.ts` 中配置了 manualChunks
2. **压缩** - 生产构建启用了代码压缩
3. **Source Maps** - 生产环境已禁用

### 后端优化

1. **LTO** - 链接时优化
2. **Strip** - 去除调试符号
3. **Opt Level "s"** - 优化文件大小

## 打包问题排查

### 如果 MSI 打包失败

- 可能需要安装 WiX Toolset
- 或仅使用 NSIS 打包（删除 `msi` 从 targets）

### 独立 EXE

独立 exe 位于 `src-tauri/target/release/` 目录，文件名通常是 `hash_validator_plus.exe` 或 `HashValidatorPlus.exe`

## 发布前检查清单

- [ ] 版本号已更新（所有配置文件一致）
- [ ] 图标已正确配置
- [ ] 测试打包后的程序功能正常
- [ ] 检查文件大小是否合理
- [ ] 测试安装和卸载流程（NSIS/MSI）
- [ ] 验证语言切换功能正常

## 下一步

构建成功后，可将以下文件分发给用户：

- `HashValidatorPlus_0.3.0_x64-setup.exe` (推荐)
- 或独立的 `HashValidatorPlus.exe`
