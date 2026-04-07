# Project Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复当前项目已确认的集成红灯、配置漂移和契约不一致问题，使构建、测试、设置持久化与文档重新对齐。

**Architecture:** 先修复可复现的交付阻断项，再收敛设置存储与运行时配置源，最后把 HTTP API / Provider / 任务状态机文档更新为与当前实现一致的正式契约。运行时设置采用“桌面环境走 Tauri 原生存储，非桌面测试环境走显式浏览器适配”的方式，避免继续把桌面配置真源留在 `localStorage`。

**Tech Stack:** Node.js test runner, Vitest, React 19, TypeScript, Tauri 2, Rust, `keyring`, `tauri-plugin-store`

---

### Task 1: 修复构建与 Rust 测试执行红灯

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `scripts/run-rust-tests.mjs`
- Modify: `scripts/run-rust-tests.test.mjs`
- Create: `scripts/tauri-config.test.mjs`
- Modify: `package.json`

**Step 1: 写失败测试**

- 为 `run-rust-tests.mjs` 增加断言：执行 Rust 测试时必须设置独立 `CARGO_TARGET_DIR`。
- 新增 `scripts/tauri-config.test.mjs`，断言 `src-tauri/tauri.conf.json` 的 `frontendDist` 能解析到仓库根目录下真实存在的 `frontend/dist`。

**Step 2: 运行测试确认失败**

Run: `node --test scripts/run-rust-tests.test.mjs scripts/tauri-config.test.mjs`
Expected: 失败，指出缺少隔离 target 目录且 `frontendDist` 解析错误。

**Step 3: 最小实现**

- 修正 `tauri.conf.json` 的 `frontendDist`。
- 调整 bundle identifier，移除不推荐的 `.app` 后缀。
- 让 `run-rust-tests.mjs` 自动注入隔离 `CARGO_TARGET_DIR`。
- 把新测试接入 `npm run test:scripts`。

**Step 4: 运行验证**

Run:
- `npm run test:scripts`
- `npm run test:rust`
- `npm run build:app`

Expected:
- 脚本测试通过
- Rust 测试不再受运行中的 `lingoflow.exe` 影响
- Tauri 构建成功找到前端产物

### Task 2: 修复 Provider 设置面板与支持列表漂移

**Files:**
- Modify: `frontend/src/features/settings/settingsTypes.ts`
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: 写失败测试**

- 给 `SettingsPanel.test.tsx` 增加断言：工具面板必须显示 `Azure 翻译`，并能展示对应配置字段与链接。

**Step 2: 运行测试确认失败**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: FAIL，界面缺少 Azure provider。

**Step 3: 最小实现**

- 在 `TOOL_PROVIDER_DEFINITIONS` 中补齐 `azure_translator`。
- 让默认配置、渲染定义和测试重新一致。

**Step 4: 运行验证**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: PASS

### Task 3: 收敛桌面设置持久化与运行时同步

**Files:**
- Modify: `frontend/src/features/settings/settingsStorage.ts`
- Modify: `frontend/src/features/settings/runtimeSettingsSyncService.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/infra/tauri/commands.ts`
- Modify: `src-tauri/src/storage/config_store.rs`
- Modify: `src-tauri/src/storage/keychain_store.rs`
- Modify: `src-tauri/src/app_state.rs`
- Modify: `src-tauri/src/commands/runtime_settings.rs`
- Create: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `frontend/src/tests/features/settingsStorage.test.ts`

**Step 1: 写失败测试**

- 增加前端测试，断言桌面运行时会优先走原生命令读写设置。
- 增加 Rust 单元测试，断言 `ConfigStore` 可更新语言配置与 HTTP 配置；`KeychainStore` 可保存/读取 provider 密钥。

**Step 2: 运行测试确认失败**

Run:
- `npm --prefix frontend run test -- src/tests/features/settingsStorage.test.ts`
- `cargo test settings --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，当前仍走 `localStorage` 且 Rust 无完整设置接口。

**Step 3: 最小实现**

- 引入原生设置命令：加载、保存普通设置；加载、保存敏感 provider 字段。
- 让桌面环境的前端设置层改走 Tauri 命令，浏览器测试环境显式保留 `localStorage` 适配。
- 让 Rust `ConfigStore` 真正保存 `source_lang` / `target_lang` / `http_api` 等普通设置。
- 让 `KeychainStore` 使用真实系统凭据存储，而不是进程内 `HashMap`。
- 扩展 `sync_runtime_settings`，同步语言偏好与 HTTP API 开关。

**Step 4: 运行验证**

Run:
- `npm --prefix frontend run test -- src/tests/features/settingsStorage.test.ts`
- `cargo test settings --manifest-path src-tauri/Cargo.toml`
- `npm run typecheck`

Expected: PASS

### Task 4: 对齐 HTTP API、Provider 与任务状态机契约

**Files:**
- Modify: `docs/HTTP-API契约.md`
- Modify: `docs/Provider契约.md`
- Modify: `docs/任务状态机.md`
- Modify: `frontend/src/features/task/taskTypes.ts`
- Modify: `frontend/src/features/task/taskReducer.ts`
- Modify: `frontend/src/features/task/TaskStatusBar.tsx`
- Modify: `src-tauri/src/tray.rs`
- Modify: `frontend/src/app/useAppActions.ts`

**Step 1: 写失败测试**

- 为任务状态类型增加测试，明确只保留当前真实使用的状态集合。
- 为托盘动作增加测试，明确 `check_update` 要么有实现，要么不再暴露。

**Step 2: 运行测试确认失败**

Run:
- `npm --prefix frontend run test -- src/tests/task/taskReducer.test.ts`
- `cargo test tray --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，状态类型与托盘动作和最终设计不一致。

**Step 3: 最小实现**

- 删除或实现无效入口，避免死菜单项。
- 让前端任务类型只保留真实流转，去掉未使用的 `collecting_input` 表述，或者为其补齐真实实现；本轮优先采用“移除未使用状态并更新文档”的方案。
- 更新三份文档，使其明确当前多 provider 聚合、当前 HTTP API 结构和当前任务流转。

**Step 4: 运行验证**

Run:
- `npm --prefix frontend run test`
- `npm run test:rust`
- `npm run check`

Expected: 全部通过，文档与实现一致
