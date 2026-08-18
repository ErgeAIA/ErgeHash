# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.96] - 2026-08-18

The first release prepared for open source. Formerly named `HashValidatorPlus`, now renamed to `ErgeHash` (Chinese name: 二哈).

### Added

- **Multi-algorithm hashing**: supports MD5 / SHA-1 / SHA-256 / SHA-512 / CRC32 and other common algorithms; a single file can be hashed with multiple algorithms at once
- **Verification file import**: auto-detect, self-heal and bind verification files in formats such as `.md5` / `.sfv` / `.sha256` / `.sha512`
- **Batch generation of standard checksum files**: generate checksum files per selected algorithm, written next to the source files
- **Expected-hash matching**: paste a set of expected hashes to verify; separators and algorithm-name prefixes are normalized automatically
- **Standalone report window**: shows the full verification report in a separate window, with per-row copy and right-click multi-file accumulation
- **Quick Guide / Settings / About pages**: implemented as React components with i18n (Chinese / English)
- **Global shortcut system**: unified, single-source-of-truth shortcut management
- **Theming**: light / dark themes built on CSS variables, following the brand color
- **Drag & drop**: drop files or folders directly to compute
- **Internationalization**: built-in Chinese and English
- **Easter-egg page**: shows the author's Bilibili / WeChat contact info

### Changed

- **Batch verification performance**: switched to a single-pass multi-algorithm read with throttled progress events, greatly improving throughput on large files
- Raised build optimization level to fix a hash-computation performance regression
- Quick Guide migrated from static HTML to a React component, aligned with the design system
- Unified menu-item hover to the brand color; logo text color changed to the brand color

### Fixed

- Report window close button not responding and white flash on startup
- Batch verification progress bar not updating
- Settings page Switch knob overflowing the capsule border
- Expected-hash separator handling (kept the Chinese full stop, collapsed separators to clear-by-space)
- Window drag-and-drop not working

### Removed

- The obsolete `MenuBar` component (replaced by `TitleBar`)
- Removed unreferenced legacy components and redundant dependencies (`dirs`, `svgo`, etc.), reducing bundle size
- Removed the `bundle.targets` restriction to restore default multi-platform (Windows / macOS) packaging

[Unreleased]: https://github.com/ErgeAIA/ErgeHash/compare/v0.9.96...HEAD
[0.9.96]: https://github.com/ErgeAIA/ErgeHash/releases/tag/v0.9.96
