# HashValidatorPlus 打包指南

## 项目简介

HashValidatorPlus 是一个使用 Tauri 2 + React + Rust 构建的文件哈希校验工具，支持 SHA256、MD5、SHA1 和 SHA512 算法。

## 前置要求

- Node.js 18+ (用于前端构建)
- Rust 1.75+ (用于后端编译)
- Tauri CLI (如果未安装，运行 `pnpm add -g @tauri-apps/cli`)

## 快速开始

### 开发模式

```bash
cd tauri-app
pnpm install
pnpm run tauri dev
```

### 生产打包

```bash
cd tauri-app
pnpm install
pnpm run tauri build
```

## 打包输出

打包完成后，所有文件会输出到 `tauri-app/src-tauri/target/release/bundle/` 目录：

### Windows 平台

- **独立 exe 文件**：位于 `tauri-app/src-tauri/target/release/hash_validator_plus.exe`
- **NSIS 安装包**：位于 `bundle/nsis/HashValidatorPlus_0.3.0_x64-setup.exe`
- **其他格式**：如果配置了其他 targets，会生成对应的打包文件

## 配置说明

### 1. Cargo.toml (Rust 后端优化)

已配置以下优化：
- `opt-level = "s"`：优化代码体积
- `lto = true`：启用链接时优化
- `codegen-units = 1`：单代码生成单元，优化体积
- `strip = true`：去除调试符号
- `panic = "abort"`：panic 时直接终止，减小体积

### 2. tauri.conf.json (Tauri 配置)

已配置：
- `bundle.targets = "all"`：生成所有支持的打包格式
- NSIS 安装包配置：支持中英文语言选择
- 图标配置：多种尺寸图标已配置

### 3. vite.config.ts (前端优化)

已配置：
- `sourcemap = false`：生产环境不生成 sourcemap
- `minify = "esbuild"`：使用 esbuild 压缩
- 代码分割：将 React 和 i18n 分离到独立 chunk

## 如何打包

### 1. 安装依赖

```bash
cd tauri-app
npm install
```

### 2. 运行打包命令

```bash
npm run tauri build
```

### 3. 获取打包产物

打包完成后，查看：

- **独立 exe**：`src-tauri/target/release/hash_validator_plus.exe`
- **NSIS 安装包**：`src-tauri/target/release/bundle/nsis/HashValidatorPlus_0.3.0_x64-setup.exe`

## 自定义打包配置

### 修改版本号

需要同时修改以下三个文件：
- `tauri-app/package.json`
- `tauri-app/src-tauri/Cargo.toml`
- `tauri-app/src-tauri/tauri.conf.json`

### 修改应用名称

修改 `tauri-app/src-tauri/tauri.conf.json` 中的 `productName` 字段。

### 添加更多打包格式

在 `tauri-app/src-tauri/tauri.conf.json` 的 `bundle.targets` 中添加：
- `"msi"`：MSI 安装包
- `"updater"`：更新包

## 常见问题

### 1. 打包失败：缺少依赖

确保已安装 Node.js 和 Rust，并且版本符合要求。

### 2. 体积过大

已启用所有体积优化选项，如果仍然过大，可以：
- 检查是否引入了不必要的 Rust 依赖
- 检查前端依赖是否可以优化

### 3. Windows 安全警告

这是因为安装包未签名，属于正常现象。

## 下一步

- 测试打包后的应用
- 如果需要发布，考虑对安装包进行签名
