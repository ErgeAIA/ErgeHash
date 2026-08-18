# ErgeHash (Er Ha)

A lightweight, cross-platform **desktop file hash verification tool**. Core philosophy: **local-first, zero upload, blazing-fast batch hashing, and clear, traceable results**.

[![BILIBILI](https://img.shields.io/badge/BILIBILI-%E5%AE%9D%E8%97%8F%E4%BA%8C%E5%93%A5AIA-00A4FF?style=for-the-badge&logo=bilibili&logoColor=white)](https://space.bilibili.com/67221461)
[![GitHub stars](https://img.shields.io/github/stars/ErgeAIA/ErgeHash?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ErgeAIA/ErgeHash)
[![License](https://img.shields.io/badge/License-Apache%202.0-2E7D32?style=for-the-badge&logo=apache&logoColor=white)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/ErgeAIA/ErgeHash?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ErgeAIA/ErgeHash/releases)
[![Downloads](https://img.shields.io/github/downloads/ErgeAIA/ErgeHash/total?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ErgeAIA/ErgeHash/releases)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-stable-DEA584?style=for-the-badge&logo=rust&logoColor=black)](https://www.rust-lang.org)
[![pnpm](https://img.shields.io/badge/pnpm-8+-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io)

[中文 README](./README.md)

![ErgeHash](./public/ergehash-logo-horizontal.svg)

## Features

- **Multi-algorithm hashing**: SHA-256, SHA-1, MD5, CRC32 and more, computed simultaneously.
- **Batch verification**: Batch hashing for multiple files and recursively for folders. The backend reads each file **once** to compute all selected algorithms, avoiding redundant disk IO.
- **Drag & drop**: Drop files or folders into the window to start hashing (native Tauri drag-and-drop).
- **Checksum file import & compare**: Import standard checksum files such as `.md5` / `.sfv` / `.sha256`; files are grouped by name and compared entry-by-entry, clearly showing pass / fail.
- **Traceable results**: A tree-style list shows algorithm / hash / elapsed time per file, with single-item copy and CSV export.
- **Cross-platform**: Built on Tauri 2, native on Windows and macOS (Apple Silicon), with no platform-specific hard dependencies in code.
- **Theme & i18n**: Built-in light/dark themes, with Chinese / English UI switching.
- **Local-first**: All computation runs locally; files are never uploaded and there is no telemetry.

## Download

Latest release: **v0.9.96**. All artifacts are built automatically by GitHub Actions and available on the [Releases](https://github.com/ErgeAIA/ErgeHash/releases) page.

> Note: The filenames below are expected artifacts; refer to the actual files listed on the Release page.

| Platform | Type                  | Expected download                       |
| -------- | --------------------- | --------------------------------------- |
| Windows  | NSIS installer (recommended for individuals) | `ErgeHash_0.9.96_x64-setup.exe`        |
| Windows  | MSI installer (recommended for enterprises)   | `ErgeHash_0.9.96_x64_en-US.msi`        |
| macOS   | DMG (Apple Silicon)   | `ErgeHash_0.9.96_aarch64.dmg`          |

### macOS notes

- CI currently builds only for **Apple Silicon (aarch64)**; Intel Macs have no native build yet.
- Because macOS code signing is not enabled (free-software policy), open the app the first time via **right-click → Open** to bypass the Gatekeeper prompt. Signing and notarization may be added later with an Apple Developer ID.

## Build from source

### Prerequisites

- Node.js 18+
- Rust (stable, 1.77+ recommended)
- pnpm 8+

### Build

```bash
# Install frontend dependencies
pnpm install

# Development mode (hot reload)
pnpm tauri dev

# Production build (compiles frontend + Rust, produces installers)
pnpm tauri build
```

### Frontend check

```bash
# Type check + frontend build
pnpm run build
```

## Tech Stack

| Layer    | Technology                             | Version constraint        |
| -------- | -------------------------------------- | ------------------------- |
| Desktop  | Tauri 2                                | = 2.11.0                  |
| Frontend | React 19 + TypeScript                  | React ^19, TS ~5.8        |
| Build    | Vite 7                                 | ^7.0                      |
| State    | Zustand 5                              | ^5.0                      |
| Styling  | Tailwind CSS 4 + CSS variable theming  | ^4.3                      |
| i18n     | i18next + react-i18next                | i18next ^26               |
| Icons    | lucide-react                           | ^1.16                     |
| Hashing  | sha2 / md-5 / sha1 / crc32fast (Rust)  | 0.10 / 0.10 / 0.10 / 1    |
| Traversal| walkdir + csv (Rust)                   | 2 / 1                     |
| Backend  | Rust                                   | edition 2021              |
| PM       | pnpm                                   | >= 8                      |

## Key Architecture Decisions

| Decision                    | Reason                                                       |
| --------------------------- | ------------------------------------------------------------ |
| Tauri 2 over Electron       | Smaller installers, native performance, Rust safety         |
| Strict frontend/backend split | Rust handles all file IO and computation; frontend is UI only |
| Single-pass multi-algorithm | Read each file once to compute all selected algorithms       |
| CSS variable theming        | Zero re-render on theme switch, dynamic light/dark support   |
| Self-hosted woff2 subsets   | Avoid huge CJK font bundles; CJK falls back to system fonts  |

## Usage

### Basic workflow

1. **Add files**: Click "Open File" / "Open Folder", or drag files into the window.
2. **Select algorithms**: Check the algorithms to compute in the left panel (multi-select).
3. **View results**: The right list shows algorithm / hash / elapsed time per file; click a hash to copy.
4. **Import checksum file**: Click "Import Verification File" and select `.md5` / `.sfv` etc.; the app compares and marks pass / fail by filename.
5. **Export**: Export the current results to CSV from the result area.

## Documentation

| Document                                   | Description                       |
| ------------------------------------------ | --------------------------------- |
| [CHANGELOG.md](./CHANGELOG.md)             | Chinese changelog                 |
| [CHANGELOG.en.md](./CHANGELOG.en.md)       | English changelog                 |
| [docs/design-system.md](./docs/design-system.md) | Design system spec          |
| [AGENTS.md](./AGENTS.md)                   | Development conventions & decisions |

## Roadmap

- [x] Windows / macOS (Apple Silicon) dual-platform CI build
- [ ] Intel Mac native build (cross-compilation)

> Note: The current macOS build targets Apple Silicon (aarch64) only and is not code-signed or notarized. Intel Macs cannot run it. On unsigned builds, macOS users must right-click → Open to bypass the Gatekeeper prompt. Official distribution requires an Apple Developer ID and notarization.
- [ ] macOS code signing & notarization
- [ ] Linux build evaluation (TBD): no platform-specific blockers in code; requires adding `ubuntu-latest` runner and webkit2gtk system deps in CI
- [ ] More checksum formats (`.sha512`, detached `.asc` signature verification)

## Author

**宝藏二哥AIA / ErgeAIA** — independent developer. Philosophy: share without barriers, tricks, or reservations.

- Video: [Bilibili](https://space.bilibili.com/67221461) · [Zhihu](https://www.zhihu.com/people/meli55a/posts)
- Code: [GitHub](https://github.com/ErgeAIA) · [Gitee](https://gitee.com/ErgeAIA)
- Email: ergeaia@agent.qq.com

---

<div align="center">
If ErgeHash helped you, a Star would be much appreciated!
</div>

## License

Licensed under the [Apache License 2.0](./LICENSE).
