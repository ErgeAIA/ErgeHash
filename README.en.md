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

![ErgeHash main interface](./docs/screenshots/main.png)

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

Latest release: **v0.9.96**. All artifacts are built automatically by GitHub Actions on three platforms (Windows / macOS / Linux) and available on the [Releases](https://github.com/ErgeAIA/ErgeHash/releases) page.

| Platform | Type                                          | File                                       |
| -------- | --------------------------------------------- | ------------------------------------------ |
| Windows  | NSIS installer (recommended for individuals)  | `ErgeHash_0.9.96_x64-setup.exe`            |
| Windows  | MSI installer (recommended for enterprises)   | `ErgeHash_0.9.96_x64_en-US.msi`            |
| macOS    | DMG (Apple Silicon)                           | `ErgeHash_0.9.96_aarch64.dmg`              |
| macOS    | `.app` archive                                | `ErgeHash_aarch64.app.tar.gz`              |
| Linux    | RPM (Fedora / openSUSE etc.)                  | `ErgeHash-0.9.96-1.x86_64.rpm`             |
| Linux    | DEB (Debian / Ubuntu etc.)                    | `ErgeHash_0.9.96_amd64.deb`                |
| Linux    | AppImage (universal)                          | `ErgeHash_0.9.96_amd64.AppImage`           |
| Source   | Source code (zip / tar.gz)                    | see the bottom of the Release page         |

### macOS notes

- CI currently builds only for **Apple Silicon (aarch64)**; Intel Macs have no native build yet.
- Because macOS code signing is not enabled (free-software policy), open the app the first time via **right-click → Open** to bypass the Gatekeeper prompt. Signing and notarization may be added later with an Apple Developer ID.

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

## Usage

### Basic workflow

1. **Add files**: Click "Open File" / "Open Folder", or drag files into the window.
2. **Select algorithms**: Check the algorithms to compute in the left panel (multi-select).
3. **View results**: The right list shows algorithm / hash / elapsed time per file; click a hash to copy.
4. **Import checksum file**: Click "Import Verification File" and select `.md5` / `.sfv` etc.; the app compares and marks pass / fail by filename.
5. **Export**: Export the current results to CSV from the result area.

### Shortcuts

> Shortcuts work globally; on macOS `Ctrl` is shown as `⌘`, `Alt` as `⌥`, `Shift` as `⇧`.

| Action                 | Shortcut                    |
| ---------------------- | --------------------------- |
| Open file              | `Ctrl + O`                  |
| Open folder            | `Ctrl + Shift + O`          |
| Import checksum file   | `Ctrl + I`                  |
| Start verification     | `Ctrl + Enter`              |
| Copy selected hash     | `Ctrl + Alt + C`            |
| Export results (CSV)   | `Ctrl + E`                  |
| Show history           | `Ctrl + H`                  |
| Clear history          | `Ctrl + Alt + H`            |
| Clear file list        | `Ctrl + Shift + Backspace`  |
| Toggle theme           | `Ctrl + Alt + T`            |
| Toggle language        | `Ctrl + Alt + L`            |
| Toggle sidebar         | `Ctrl + B`                  |
| Open settings          | `Ctrl + ,`                  |
| Quick guide            | `Ctrl + /`                  |
| Quit                   | `Ctrl + Q`                  |

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

## Author

<table>
<tr>
<td align="center" width="200">
<img src="https://github.com/ErgeAIA.png" width="100" style="border-radius: 50%"><br>
<b>宝藏二哥AIA / ErgeAIA</b><br>
<sub>Keep tinkering, never stop</sub>
</td>
<td>

**About me**: Independent developer / Full-stack engineer / ComfyUI enthusiast / Vibe Coding practitioner

**Tech stack**: Tauri · Rust · React · Python · Claude · ZCode · Workbuddy

**Philosophy**: Share without barriers, tricks, or reservations

**Links**:
- 📺 [Bilibili](https://space.bilibili.com/67221461) · [Zhihu](https://www.zhihu.com/people/meli55a/posts) · WeChat Official Account (ErgeAIA)
- 🐙 [GitHub](https://github.com/ErgeAIA) · [Gitee](https://gitee.com/ErgeAIA)
- 📦 Featured projects: [ErgeMD](https://github.com/ErgeAIA/ErgeMD) · [ErgeHash](https://github.com/ErgeAIA/ErgeHash) · [catapult-cn](https://github.com/ErgeAIA/catapult-cn)

</td>
</tr>
</table>

---

<div align="center">
If ErgeHash helped you, a Star would be much appreciated!
</div>

## License

Licensed under the [Apache License 2.0](./LICENSE).
