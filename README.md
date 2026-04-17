# LingoFlow

一个轻量桌面翻译器项目，支持 **macOS** 和 **Windows** 平台。

核心功能：

- 划词翻译
- 输入翻译
- 截图 OCR
- 截图翻译
- 本地 HTTP API

## 平台支持状态

- ✅ **macOS**: 完整支持（V1 已完成）
- 🚧 **Windows**: 核心功能已实现，平台集成优化中

## 项目结构

- `docs/`：产品、技术、接口与执行文档
- `frontend/`：React + TypeScript + Vite UI 层
- `src-tauri/`：Rust + Tauri 核心层
- `platform/macos/helper/`：Swift 平台桥接层

## 常用命令

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run check`

## 文档入口

查看 [文档总览](./docs/文档总览.md) 获取完整阅读顺序。
