# Changelog

All notable changes to LingoFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Rust Clippy warnings: reduced function parameters using context objects (Bing Web, Youdao Web, Microsoft Translator, Tencent TMT)
- Code quality: eliminated all too_many_arguments warnings

### Added
- Windows platform support (core features)
- Comprehensive test coverage (50+ tests)
- CI/CD: GitHub Actions workflow for automated testing
- LICENSE: MIT License
- CHANGELOG: Following Keep a Changelog format

### Changed
- Documentation: synced README and CLAUDE.md with current project state

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
