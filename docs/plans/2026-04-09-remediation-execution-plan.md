# Project Remediation Execution Plan

**Goal:** 系统修复当前项目已确认的功能正确性问题、平台可交付风险、配置链路分裂和工程门禁缺口，让桌面 UI、HTTP API、平台桥接与文档重新对齐。

**Architecture:** 先补契约回归测试锁住高风险断点，再修复会直接影响真实行为的 P0/P1 问题，然后收敛 settings/provider 单一事实源与运行时切换逻辑，最后处理平台 helper 发布模型、阻塞调用与工程门禁。执行过程中坚持“失败显式暴露、不引入静默 fallback”。

**Tech Stack:** Vitest, React 19, TypeScript, Tauri 2, Rust, Axum, Swift Package Manager, keychain/keyring

---

### Task 1: 落地回归测试，锁定当前高风险契约

**Files:**
- Create: `frontend/src/tests/features/permissionStatusStorage.test.ts`
- Modify: `frontend/src/tests/task/taskService.test.ts`
- Modify: `src-tauri/src/http_api/controller.rs`
- Modify: `src-tauri/src/commands/runtime_settings.rs`
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `frontend/src/tests/features/ScreenshotOverlayApp.test.tsx`

**Step 1: 写失败测试**

- 增加前端测试，覆盖权限 payload 的真实序列化形状。
- 增加 `taskService` 测试，覆盖 `accepted`、`cancelled`、异常分支。
- 增加 Rust HTTP API 测试，断言 `/ocr_recognize` 会正确消费 `ocr_provider_id`。
- 增加 Rust 命令测试，断言 `runtime_settings` 切换失败时不会把已有 HTTP 服务状态破坏。
- 增加 Rust 设置测试，断言 `save_settings` 在非法 payload 下不会产生部分提交副作用。
- 增加截图 Overlay 测试，断言桌面运行时不会从脱敏 `localStorage` 读取 OCR 凭据。

**Step 2: 运行测试确认失败**

Run:
- `npm --prefix frontend run test -- src/tests/task/taskService.test.ts src/tests/features/ScreenshotOverlayApp.test.tsx src/tests/features/permissionStatusStorage.test.ts`
- `cargo test http_api::controller --manifest-path src-tauri/Cargo.toml`
- `cargo test runtime_settings --manifest-path src-tauri/Cargo.toml`
- `cargo test settings --manifest-path src-tauri/Cargo.toml`

**Step 3: 验收**

- 测试能稳定暴露当前已知问题。
- 没有新增不相关失败。

---

### Task 2: 修复首批 P0/P1 正确性问题

**Files:**
- Modify: `frontend/src/features/settings/permissionStatus.ts`
- Modify: `frontend/src/features/settings/permissionStatusStorage.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/app/useAppActions.ts`
- Modify: `frontend/src/features/screenshot/ScreenshotOverlayApp.tsx`
- Modify: `frontend/src/features/settings/nativeSettingsStorage.ts`
- Modify: `frontend/src/features/task/taskService.ts`
- Modify: `src-tauri/src/http_api/routes.rs`

**Step 1: 修复权限状态字段命名不一致**

- 统一 `screen_recording` / `screenRecording` 的桥接形状。
- 保证前端只消费一套明确类型。

**Step 2: 修复 HTTP `/ocr_recognize` 参数路由**

- 让 HTTP API 优先消费 `ocr_provider_id`，必要时兼容历史 `provider_id`。

**Step 3: 修复 Windows 截图 OCR 设置来源**

- Overlay 优先走 native settings 或后端真源。
- `localStorage` 仅保留非敏感缓存用途。

**Step 4: 修复快捷键动作隐式默认分发**

- 用显式穷举代替默认落到 `ocr_recognize`。

**Step 5: 明确 `taskService` 协议语义**

- 正确处理 `accepted`、`cancelled`、`success` 与异常。

**Step 6: 验收**

Run:
- `npm --prefix frontend run test -- src/tests/task/taskService.test.ts src/tests/features/ScreenshotOverlayApp.test.tsx src/tests/features/permissionStatusStorage.test.ts`
- `cargo test http_api::controller --manifest-path src-tauri/Cargo.toml`
- `npm run typecheck`

---

### Task 3: 收敛 settings/provider 配置链路

**Files:**
- Modify: `frontend/src/features/settings/settingsTypes.ts`
- Modify: `frontend/src/features/settings/settingsStorage.ts`
- Modify: `frontend/src/features/settings/translateProviderRequest.ts`
- Modify: `frontend/src/features/settings/ocrProviderRequest.ts`
- Modify: `frontend/src/infra/tauri/commands.ts`
- Modify: `src-tauri/src/apiprovider/runtime_config.rs`
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/http_api/routes.rs`
- Modify: `src-tauri/src/orchestrator/provider_selection.rs`
- Modify: `src-tauri/src/providers/runtime_translate_factory.rs`
- Modify: `src-tauri/src/providers/runtime_ocr_factory.rs`

**Step 1: 收敛 provider 元数据与 runtime config**

- 减少前端、桥接、Rust runtime factory 的重复字段定义。
- 明确 secret/non-secret 字段与默认值来源。

**Step 2: 统一桌面 UI 与 HTTP API 的 provider 配置来源**

- 避免“桌面能用、HTTP API 不能用”的双轨能力。

**Step 3: 处理 provider 编辑高频落盘**

- 拆分草稿态与提交态，或对持久化做节流。

**Step 4: 验收**

Run:
- `npm run test:frontend`
- `npm run test:rust`
- `npm run typecheck`

---

### Task 4: 修复运行时切换与持久化一致性

**Files:**
- Modify: `src-tauri/src/commands/runtime_settings.rs`
- Modify: `src-tauri/src/http_api/controller.rs`
- Modify: `src-tauri/src/storage/settings_store.rs`
- Modify: `src-tauri/src/app_state.rs`
- Modify: `src-tauri/src/commands/settings.rs`

**Step 1: 让 HTTP server 切换具备事务性**

- 新配置成功后再替换旧服务。
- 失败时保留当前可用监听。

**Step 2: 避免 settings/save 的部分副作用提交**

- 先完整校验 payload，再提交 keychain 与文件写入。

**Step 3: 提升 settings 文件读写健壮性**

- 采用临时文件 + rename 的原子写入方式。
- 对损坏配置提供显式恢复路径。

**Step 4: 验收**

Run:
- `cargo test runtime_settings --manifest-path src-tauri/Cargo.toml`
- `cargo test settings --manifest-path src-tauri/Cargo.toml`
- `npm run test:rust`

---

### Task 5: 修复平台运行模型与 async 阻塞点

**Files:**
- Modify: `src-tauri/src/platform/macos_helper.rs`
- Modify: `platform/macos/helper/Package.swift`
- Modify: `src-tauri/src/platform/selection.rs`
- Modify: `src-tauri/src/platform/permissions.rs`
- Modify: `src-tauri/src/platform/capture.rs`
- Modify: `src-tauri/src/orchestrator/translation_execution.rs`
- Modify: `src-tauri/src/orchestrator/ocr_execution.rs`
- Modify: `src-tauri/src/apiprovider/bing_web.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 重构 macOS helper 发布模型**

- helper 改为预编译并打包分发。
- Rust 端直接调用随应用发布的二进制。

**Step 2: 清理 async 路径中的阻塞调用**

- 进程调用、文件 I/O、平台同步接口迁移到阻塞执行层。

**Step 3: 处理 `ocr_*_region` 平台暴露边界**

- macOS 若未实现 region capture，就不要继续暴露伪可用命令。

**Step 4: 验收**

Run:
- `npm run test:rust`
- `npm run build:app`
- 平台手测：权限读取、划词翻译、截图 OCR

---

### Task 6: 工程门禁与文档对齐

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/文档总览.md`
- Modify: `docs/需求边界.md`
- Modify: `docs/HTTP-API契约.md`
- Modify: `docs/项目结构约定.md`
- Modify: `prettier.config.mjs`
- Remove or keep only one of: `package-lock.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`

**Step 1: 补齐质量门禁**

- 把 `swift test` 纳入 macOS 环境检查。
- 让 `check` 覆盖至少一条构建链路。
- 修复当前 `format:check` 红灯。

**Step 2: 对齐文档口径**

- 明确正式支持平台与实验支持平台。
- 让 HTTP API 契约与当前实现一致。
- 让结构约定与代码边界重新同步。

**Step 3: 统一包管理器信号**

- 只保留一套锁文件与工作区定义。

**Step 4: 最终验收**

Run:
- `npm run check`
- `npm run build:app`
- `swift test --package-path platform/macos/helper`

Expected:
- 质量门禁全绿
- 桌面 UI、HTTP API、平台桥接与文档口径一致

---

### Task 7: 2026-04-10 深度审查增补修复窗口（Window A）

**Goal:** 优先消除“配置回写污染、配置双轨、并发竞态”三类高风险问题，再推进性能与工程门禁收口。

**P0（立即执行）**

1. 阻断 native 配置加载失败后的默认值回写
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/tests/app/App.test.tsx`
- 要求：native load 失败时禁止 shortcut/runtime sync 与 native save，避免覆盖用户配置与密钥。

2. 收敛运行时配置与持久化配置的双写路径
- Modify: `src-tauri/src/commands/runtime_settings.rs`
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/runtime_settings_sync.rs`
- 要求：统一配置提交入口，保证“校验 -> 持久化 -> runtime 应用”一致。

3. 统一桌面命令与 HTTP API 的 provider 配置来源
- Modify: `src-tauri/src/commands/translation.rs`
- Modify: `src-tauri/src/commands/ocr.rs`
- Modify: `src-tauri/src/http_api/routes.rs`
- Modify: `src-tauri/src/http_api/state.rs`
- 要求：只保留一套 provider 真源，避免入口行为分裂。

**P1（P0 后执行）**

4. 修复 `syncRuntimeSettings` 并发竞态
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/features/settings/runtimeSettingsSyncService.ts`

5. 修复 ScreenshotOverlay ready 握手与 waiter 累积
- Modify: `frontend/src/features/screenshot/screenshotOverlayService.ts`
- Modify: `frontend/src/features/screenshot/ScreenshotOverlayApp.tsx`

6. 修复 `taskService` 异常路径 `taskId` 复用
- Modify: `frontend/src/features/task/taskService.ts`
- Modify: `frontend/src/tests/task/taskService.test.ts`

7. 清理 Windows OCR async 阻塞 I/O
- Modify: `src-tauri/src/providers/tesseract_js_bridge.rs`

**P2（收尾）**

8. 工程门禁与文档一致性
- Modify: `package.json`（`check` 纳入 `build:app`）
- Modify: `docs/HTTP-API契约.md`（`provider_id` 缺省行为与实现对齐）
- Modify: `scripts/run-swift-tests.mjs`（增加超时控制）

**Window A 当前进度**
- [x] P0-1 已开始并落地：阻断“加载失败即默认回写”并补回归测试
- [x] P1-4 已开始并落地：`syncRuntimeSettings` 改为串行队列并补回归测试
- [x] P1-5 已开始并落地首版：修复 Overlay ready 等待重置导致的固定超时与 waiter 清理问题
- [x] P1-5 稳定性补强：仅在 overlay 窗口新建时重置 `overlayReady`，并新增窗口重建场景回归测试，确保重建后会重新等待 ready 事件
- [x] P1-6 已开始并落地：修复 `taskService` 异常路径 `taskId` 复用并补回归测试
- [x] P1-7 已开始并落地：Windows `tesseract_js_bridge` 读取 OCR 图片改为 `spawn_blocking`，避免 async 路径直接阻塞文件 I/O
- [x] P0-2 已开始并落地首版：`save_settings` 改为“持久化后同步 runtime，失败回滚 file + keychain”
- [x] P0-3 已开始并落地首版：桌面 `translation/ocr` 命令默认切换到 runtime settings 真源（与 HTTP 同源）
- [x] P2-8 已开始并落地首版：`check` 纳入 `build:app`、HTTP 契约文档修正、Swift 测试增加 60s 超时
- [x] P2-8 稳定性补强：`run-swift-tests` 抽取 `waitForChildExit`，超时测试从真实计时竞争改为确定性断言，消除 `killedWithSignal === null` 间歇失败
- [x] Window A 回归验收（2026-04-10）：`npm run test:scripts`、`npm run typecheck`、`npm run lint`、`npm run test:rust`、`npm run check` 全部通过（仅保留既有 clippy warnings）
