# Changelog

All notable changes to LingoFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Rust Clippy warnings: 100% elimination of too_many_arguments warnings**
  - API providers: Bing Web, Youdao Web, Microsoft Translator, Tencent TMT (6 warnings)
  - Orchestrator: OCR execution and translation execution (9 warnings)
  - Platform: Windows capture (png_encoding, script_builder) (2 warnings)
  - Providers: Tesseract JS bridge (1 warning)
  - Total: 18 → 0 warnings eliminated
  - Refactored using context objects for better code organization
- Code quality: all tests pass (52 Rust + 81 frontend = 133 tests)
- TypeScript: already using best practices (unknown + type guards instead of any)

### Added
- Windows platform support (core features)
- Comprehensive test coverage (133 tests total)
- CI/CD: GitHub Actions workflow for automated testing
- LICENSE: MIT License
- CHANGELOG: Following Keep a Changelog format

### Changed
- Documentation: synced README and CLAUDE.md with current project state
- Architecture: improved parameter passing with 15+ context objects

## [0.1.0] - 2026-04-08

### Added
- macOS platform support (V1 complete)
- Selection translate
- Input translate
- Screenshot OCR
- Screenshot translate
- Local HTTP API
- Multiple translation providers (Baidu, DeepL, Google, Microsoft, Tencent, Youdao)
- OCR providers (Apple Vision, OpenAI-compatible, Tesseract.js)
