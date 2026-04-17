# LingoFlow 代码质量修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 修复项目中发现的代码质量问题，包括 Rust Clippy 警告、TypeScript 类型安全、文档同步和基础设施缺失

**架构：** 采用渐进式修复策略，优先处理高影响、低风险的问题。每个任务独立可测试，遵循 TDD 原则。修复过程中保持向后兼容，不破坏现有功能。

**技术栈：** Rust (Clippy), TypeScript (strict mode), Prettier, ESLint, Cargo fmt

---

## 阶段 1: 文档同步与基础设施 (高优先级)

### Task 1: 更新项目文档以反映当前状态

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Create: `LICENSE`
- Create: `CHANGELOG.md`

**Step 1: 更新 README.md 反映 Windows 支持现状**

修改 `README.md:3-9`：

```markdown
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
```

**Step 2: 更新 CLAUDE.md 项目概述**

修改 `CLAUDE.md:9`：

```markdown
LingoFlow is a lightweight desktop translator built with **Tauri 2 + React 19 + Rust**. Core features: selection translate, input translate, screenshot OCR, screenshot translate, and local HTTP API. The project supports macOS (V1 complete) and Windows (core features implemented, platform integration in progress).
```

**Step 3: 创建 LICENSE 文件**

创建 `LICENSE`（使用 MIT License）：

```
MIT License

Copyright (c) 2026 LingoFlow Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 4: 创建 CHANGELOG.md**

创建 `CHANGELOG.md`：

```markdown
# Changelog

All notable changes to LingoFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Windows platform support (core features)
- Comprehensive test coverage (50+ tests)

### Fixed
- Desktop build and native settings sync

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
```

**Step 5: 提交文档更新**

```bash
git add README.md CLAUDE.md LICENSE CHANGELOG.md
git commit -m "docs: sync documentation with current project state

- Update README to reflect Windows support status
- Update CLAUDE.md project overview
- Add MIT LICENSE
- Add CHANGELOG.md following Keep a Changelog format"
```

---

### Task 2: 添加 CI/CD 配置

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

**Step 1: 创建 CI workflow**

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable

    - name: Install dependencies
      run: npm run bootstrap

    - name: Run checks
      run: npm run check

    - name: Build
      run: npm run build

  lint:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        components: clippy, rustfmt

    - name: Install dependencies
      run: npm ci

    - name: Check formatting
      run: npm run format:check

    - name: Run linters
      run: npm run lint
```

**Step 2: 验证 CI 配置语法**

```bash
# 使用 GitHub CLI 验证（如果已安装）
gh workflow view ci.yml --yaml 2>&1 || echo "Syntax check: manual review required"
```

**Step 3: 提交 CI 配置**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow

- Run tests on macOS and Windows
- Check formatting and linting
- Build verification"
```

---

## 阶段 2: Rust 代码质量修复 (高优先级)

### Task 3: 重构 BingWebProvider 参数过多问题

**Files:**
- Modify: `src-tauri/src/apiprovider/bing_web.rs:82-89`
- Test: 运行现有测试确保不破坏功能

**Step 1: 创建参数对象结构体**

在 `src-tauri/src/apiprovider/bing_web.rs` 顶部添加：

```rust
/// Request context for Bing translation
struct BingTranslationContext<'a> {
    req: &'a TranslateRequest,
    source_lang: &'a str,
    target_lang: &'a str,
    ig_value: &'a str,
    context: &'a BingPageContext,
}

impl<'a> BingTranslationContext<'a> {
    fn new(
        req: &'a TranslateRequest,
        source_lang: &'a str,
        target_lang: &'a str,
        ig_value: &'a str,
        context: &'a BingPageContext,
    ) -> Self {
        Self {
            req,
            source_lang,
            target_lang,
            ig_value,
            context,
        }
    }
}
```

**Step 2: 重构 request_translation 方法签名**

修改 `src-tauri/src/apiprovider/bing_web.rs:82-89`：

```rust
async fn request_translation(
    &self,
    ctx: BingTranslationContext<'_>,
) -> Result<String, AppError> {
    // 方法体内使用 ctx.req, ctx.source_lang 等访问参数
    let url = format!("{}/ttranslatev3", self.base_url);
    // ... 其余实现保持不变，只是参数访问方式改变
}
```

**Step 3: 更新调用点**

在同文件中找到 `request_translation` 的调用处并更新：

```rust
let ctx = BingTranslationContext::new(
    req,
    &source_lang,
    &target_lang,
    &ig_value,
    &context,
);
let result = self.request_translation(ctx).await?;
```

**Step 4: 运行测试验证**

```bash
cargo test --manifest-path src-tauri/Cargo.toml apiprovider::bing_web --lib
```

预期输出：所有 Bing Web 相关测试通过

**Step 5: 运行 Clippy 检查**

```bash
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

预期：`bing_web.rs:82` 的警告消失

**Step 6: 提交修复**

```bash
git add src-tauri/src/apiprovider/bing_web.rs
git commit -m "refactor(bing_web): reduce function parameters using context object

- Introduce BingTranslationContext to group related parameters
- Fixes Clippy too_many_arguments warning
- No functional changes, all tests pass"
```

---

### Task 4: 重构 YoudaoWebProvider 参数过多问题

**Files:**
- Modify: `src-tauri/src/apiprovider/youdao_web.rs:128-135`
- Modify: `src-tauri/src/apiprovider/youdao_web_support.rs:56`

**Step 1: 创建 Youdao 请求上下文**

在 `src-tauri/src/apiprovider/youdao_web.rs` 添加：

```rust
struct YoudaoTranslationContext<'a> {
    req: &'a TranslateRequest,
    source_lang: &'a str,
    target_lang: &'a str,
    client_key: &'a str,
    secret_key: &'a str,
}

impl<'a> YoudaoTranslationContext<'a> {
    fn new(
        req: &'a TranslateRequest,
        source_lang: &'a str,
        target_lang: &'a str,
        client_key: &'a str,
        secret_key: &'a str,
    ) -> Self {
        Self {
            req,
            source_lang,
            target_lang,
            client_key,
            secret_key,
        }
    }
}
```

**Step 2: 重构 request_translation 方法**

修改 `youdao_web.rs:128-135`：

```rust
async fn request_translation(
    &self,
    ctx: YoudaoTranslationContext<'_>,
) -> Result<String, AppError> {
    // 使用 ctx.req, ctx.source_lang 等
}
```

**Step 3: 重构 generate_sign 函数**

在 `src-tauri/src/apiprovider/youdao_web_support.rs:56` 创建参数结构：

```rust
pub(crate) struct YoudaoSignParams<'a> {
    pub client: &'a str,
    pub product: &'a str,
    pub timestamp: &'a str,
    pub key: &'a str,
}

pub(crate) fn generate_sign(params: YoudaoSignParams<'_>) -> String {
    let sign_str = format!(
        "client={}&mysticTime={}&product={}",
        params.client, params.timestamp, params.product
    );
    // ... 其余实现
}
```

**Step 4: 更新所有调用点**

```bash
# 查找调用点
rg "generate_sign\(" src-tauri/src/apiprovider/
```

更新每个调用点使用新的参数结构

**Step 5: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml apiprovider::youdao_web
```

**Step 6: 提交**

```bash
git add src-tauri/src/apiprovider/youdao_web.rs src-tauri/src/apiprovider/youdao_web_support.rs
git commit -m "refactor(youdao_web): reduce function parameters using context objects

- Introduce YoudaoTranslationContext and YoudaoSignParams
- Fixes Clippy too_many_arguments warnings
- All tests pass"
```

---

### Task 5: 重构 Microsoft Translator 参数过多问题

**Files:**
- Modify: `src-tauri/src/apiprovider/microsoft_translator.rs:109-114`

**Step 1: 创建请求上下文**

```rust
struct MicrosoftTranslateContext<'a> {
    req: &'a TranslateRequest,
    query: &'a [(String, String)],
    timeout_ms: u64,
}
```

**Step 2: 重构方法签名**

```rust
async fn request_translate(
    &self,
    ctx: MicrosoftTranslateContext<'_>,
) -> Result<Vec<AzureTranslateResponseItem>, AppError> {
    // 实现
}
```

**Step 3: 更新调用点并测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml apiprovider::microsoft_translator
```

**Step 4: 提交**

```bash
git add src-tauri/src/apiprovider/microsoft_translator.rs
git commit -m "refactor(microsoft_translator): reduce function parameters

- Introduce MicrosoftTranslateContext
- Fixes Clippy warning"
```

---

### Task 6: 重构 Tencent TMT 参数过多问题

**Files:**
- Modify: `src-tauri/src/apiprovider/tencent_tmt.rs:174-179`
- Modify: `src-tauri/src/apiprovider/tencent_tmt_signer.rs:29-35`

**Step 1: 创建 Tencent 请求上下文**

```rust
struct TencentTranslateContext {
    headers: HeaderMap,
    body_json: String,
    timeout_ms: u64,
}
```

**Step 2: 创建签名参数结构**

在 `tencent_tmt_signer.rs`：

```rust
pub struct TencentAuthParams<'a> {
    pub action: &'a str,
    pub timestamp: i64,
    pub date: &'a str,
    pub payload: &'a str,
}
```

**Step 3: 重构两个方法**

```rust
// tencent_tmt.rs
async fn request_translate(
    &self,
    ctx: TencentTranslateContext,
) -> Result<TencentTranslateApiResponse, AppError>

// tencent_tmt_signer.rs
pub fn build_authorization(
    &self,
    params: TencentAuthParams<'_>,
) -> Result<String, AppError>
```

**Step 4: 测试并提交**

```bash
cargo test --manifest-path src-tauri/Cargo.toml apiprovider::tencent_tmt
git add src-tauri/src/apiprovider/tencent_tmt*.rs
git commit -m "refactor(tencent_tmt): reduce function parameters

- Introduce TencentTranslateContext and TencentAuthParams
- Fixes Clippy warnings"
```

---

### Task 7: 重构 OCR execution 参数过多问题

**Files:**
- Modify: `src-tauri/src/orchestrator/ocr_execution.rs:10`

**Step 1: 查看当前函数签名**

```bash
rg -A 10 "fn.*ocr_execution" src-tauri/src/orchestrator/ocr_execution.rs
```

**Step 2: 创建 OCR 执行上下文**

```rust
pub struct OcrExecutionContext<'a> {
    // 根据实际参数定义字段
}
```

**Step 3: 重构并测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml orchestrator::ocr_execution
```

**Step 4: 提交**

```bash
git add src-tauri/src/orchestrator/ocr_execution.rs
git commit -m "refactor(ocr_execution): reduce function parameters

- Introduce OcrExecutionContext
- Fixes Clippy warning"
```

---

### Task 8: 审查并修复 panic/expect 使用

**Files:**
- Modify: `src-tauri/src/storage/config_store.rs`
- Modify: `src-tauri/src/storage/keychain_store.rs`
- Modify: `src-tauri/src/http_api/controller.rs`
- Modify: `src-tauri/src/apiprovider/bing_web.rs`
- Modify: `src-tauri/src/apiprovider/bing_web_support.rs`
- Modify: `src-tauri/src/providers/runtime_translate_factory.rs`

**Step 1: 查找所有 panic 和 expect 使用**

```bash
rg "panic!|\.expect\(" src-tauri/src --type rust -n
```

**Step 2: 逐个审查并分类**

对每个使用进行分类：
- **合理使用**：测试代码、不可恢复的初始化错误
- **需要修复**：可以返回 Result 的业务逻辑

**Step 3: 修复 config_store.rs 中的 expect**

示例修复（具体根据实际代码）：

```rust
// 修复前
let value = store.get("key").expect("Key must exist");

// 修复后
let value = store.get("key")
    .ok_or_else(|| AppError::ConfigError("Key not found".into()))?;
```

**Step 4: 修复 keychain_store.rs**

```rust
// 将 expect 替换为 ? 操作符和适当的错误处理
```

**Step 5: 运行完整测试套件**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

**Step 6: 提交**

```bash
git add src-tauri/src/storage/*.rs src-tauri/src/http_api/controller.rs
git commit -m "fix: replace panic/expect with proper error handling

- Convert expect() calls to Result returns in storage modules
- Improve error messages and propagation
- Maintains all existing test coverage"
```

---

## 阶段 3: TypeScript 类型安全修复 (中优先级)

### Task 9: 修复 settingsStorage.ts 中的 any 类型

**Files:**
- Modify: `frontend/src/features/settings/settingsStorage.ts`
- Test: `frontend/src/tests/features/settingsStorage.test.ts`

**Step 1: 查看当前 any 使用情况**

```bash
rg ":\s*any" frontend/src/features/settings/settingsStorage.ts -n
```

**Step 2: 为每个 any 定义具体类型**

示例修复：

```typescript
// 修复前
function parseConfig(data: any): Config {
  return data as Config;
}

// 修复后
function parseConfig(data: unknown): Config {
  if (!isValidConfig(data)) {
    throw new Error('Invalid config format');
  }
  return data;
}

function isValidConfig(data: unknown): data is Config {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    typeof data.version === 'string'
  );
}
```

**Step 3: 运行类型检查**

```bash
npm --prefix frontend run typecheck
```

预期：无类型错误

**Step 4: 运行测试**

```bash
npm --prefix frontend run test -- settingsStorage.test.ts
```

**Step 5: 提交**

```bash
git add frontend/src/features/settings/settingsStorage.ts
git commit -m "fix(settings): replace any types with proper type guards

- Add type guards for config validation
- Replace any with unknown + type narrowing
- All tests pass"
```

---

### Task 10: 修复 settingsTypes.ts 中的 any 类型

**Files:**
- Modify: `frontend/src/features/settings/settingsTypes.ts`

**Step 1: 审查类型定义**

```bash
cat frontend/src/features/settings/settingsTypes.ts | grep -n "any"
```

**Step 2: 定义具体类型**

```typescript
// 修复前
export interface ProviderConfig {
  settings: any;
}

// 修复后
export interface ProviderConfig {
  settings: Record<string, string | number | boolean>;
}

// 或者更具体的类型
export type ProviderSettings =
  | BaiduProviderSettings
  | DeepLProviderSettings
  | GoogleProviderSettings;
```

**Step 3: 类型检查并提交**

```bash
npm --prefix frontend run typecheck
git add frontend/src/features/settings/settingsTypes.ts
git commit -m "fix(settings): define specific types for provider settings

- Replace any with discriminated union types
- Improve type safety for provider configurations"
```

---

### Task 11: 修复 bridge 文件中的 any 类型

**Files:**
- Modify: `frontend/src/features/ocr/ocrResultWindowBridge.ts`
- Modify: `frontend/src/features/screenshot/screenshotOverlayBridge.ts`
- Modify: `frontend/src/features/ocr/ocrRuntimeBridge.ts`

**Step 1: 为 Tauri 事件定义类型**

```typescript
// 在 infra/tauri/events.ts 中定义事件类型
export interface TauriEventMap {
  'ocr-result': OcrResultPayload;
  'screenshot-captured': ScreenshotPayload;
  'ocr-progress': OcrProgressPayload;
}

export type TauriEventName = keyof TauriEventMap;
export type TauriEventPayload<T extends TauriEventName> = TauriEventMap[T];
```

**Step 2: 使用类型化的事件监听器**

```typescript
// 修复前
listen('ocr-result', (event: any) => {
  handleResult(event.payload);
});

// 修复后
listen<TauriEventPayload<'ocr-result'>>('ocr-result', (event) => {
  handleResult(event.payload);
});
```

**Step 3: 类型检查并提交**

```bash
npm --prefix frontend run typecheck
git add frontend/src/features/ocr/*.ts frontend/src/features/screenshot/*.ts
git commit -m "fix(bridge): add type safety for Tauri event handlers

- Define TauriEventMap for all event types
- Replace any with specific event payload types
- Improve IDE autocomplete and type checking"
```

---

## 阶段 4: 验证与清理

### Task 12: 运行完整测试套件

**Step 1: 运行所有检查**

```bash
npm run check
```

预期输出：
- ✅ TypeScript 类型检查通过
- ✅ ESLint 无错误
- ✅ Clippy 无警告（或仅剩余合理警告）
- ✅ 所有测试通过

**Step 2: 检查 Clippy 警告数量**

```bash
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets 2>&1 | grep "warning:" | wc -l
```

预期：从 18 个警告降至 0-2 个（仅保留合理警告）

**Step 3: 检查 TypeScript any 使用**

```bash
rg ":\s*any" frontend/src --type ts | wc -l
```

预期：从 56 处降至 10 处以下（仅保留必要的 any）

**Step 4: 生成测试覆盖率报告（可选）**

```bash
# 前端覆盖率
npm --prefix frontend run test -- --coverage

# Rust 覆盖率（需要 cargo-tarpaulin）
cargo tarpaulin --manifest-path src-tauri/Cargo.toml --out Html
```

---

### Task 13: 更新 CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: 添加修复记录**

在 `CHANGELOG.md` 的 `[Unreleased]` 部分添加：

```markdown
### Fixed
- Rust Clippy warnings: reduced function parameters using context objects
- TypeScript type safety: replaced 46+ any types with specific types
- Error handling: replaced panic/expect with proper Result returns
- Documentation: synced README and CLAUDE.md with current project state

### Added
- CI/CD: GitHub Actions workflow for automated testing
- LICENSE: MIT License
- CHANGELOG: Following Keep a Changelog format
```

**Step 2: 提交**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG with code quality fixes"
```

---

## 验收标准

### 代码质量指标

- [ ] Rust Clippy 警告从 18 个降至 ≤ 2 个
- [ ] TypeScript any 使用从 56 处降至 ≤ 10 处
- [ ] 所有测试通过（50+ Rust 测试 + 前端测试）
- [ ] 无新增的类型错误或 lint 错误

### 文档完整性

- [ ] README.md 反映当前平台支持状态
- [ ] CLAUDE.md 更新项目概述
- [ ] 添加 LICENSE 文件
- [ ] 添加 CHANGELOG.md
- [ ] 添加 CI/CD 配置

### 功能完整性

- [ ] 所有现有功能正常工作
- [ ] 无破坏性变更
- [ ] 向后兼容

---

## 预估时间

- **阶段 1 (文档与基础设施)**: 2-3 小时
- **阶段 2 (Rust 代码质量)**: 4-6 小时
- **阶段 3 (TypeScript 类型安全)**: 3-4 小时
- **阶段 4 (验证与清理)**: 1-2 小时

**总计**: 10-15 小时

---

## 风险与注意事项

### 风险

1. **参数重构可能影响性能**: 引入新结构体可能增加栈分配开销
   - **缓解**: 使用引用传递，避免不必要的克隆

2. **类型收紧可能暴露隐藏 bug**: 将 any 改为具体类型可能发现现有的类型不匹配
   - **缓解**: 逐步修复，每个文件独立测试

3. **CI/CD 配置可能需要调整**: 不同平台的构建环境差异
   - **缓解**: 先在本地验证，再推送到 CI

### 注意事项

- 每个 Task 独立提交，便于回滚
- 保持测试覆盖率不下降
- 重构时不添加新功能
- 遵循现有代码风格和命名约定
