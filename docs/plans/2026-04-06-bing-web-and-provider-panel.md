# Bing Web And Provider Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增 `bing_web` 翻译 provider，并把后端已有的正式 API provider 全部补到前端设置面板，连同 key 获取入口与说明一起展示。

**Architecture:** 后端沿用现有 `TranslateProvider` 契约新增 `bing_web` 实现，并在 registry 中注册。前端扩展 `settingsTypes` 的 provider 模型，让设置面板覆盖 `youdao_web / bing_web / deepl_free / azure_translator / google_translate / tencent_tmt / baidu_fanyi`，同时提供每个 provider 的字段说明和获取链接。当前回合只补齐现有“运行时从环境变量读配置”的能力和对应 UI，不重做完整的前后端持久化链路。

**Tech Stack:** Rust, Tauri 2, React 19, TypeScript, Vitest

---

### Task 1: 锁定前端 provider 模型与展示需求

**Files:**
- Modify: `frontend/src/tests/features/settingsStorage.test.ts`
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`
- Modify: `frontend/src/features/settings/settingsTypes.ts`
- Modify: `frontend/src/features/settings/settingsStorage.ts`
- Modify: `frontend/src/features/settings/ProviderPanel.tsx`

**Step 1: Write the failing test**

给 `settingsStorage.test.ts` 增加断言，验证默认设置里包含全部翻译 provider。

给 `SettingsPanel.test.tsx` 增加断言，验证工具面板中能看到 `Youdao Web / Bing Web / DeepL / Azure / Google / Tencent / Baidu`，并能看到获取 key 的链接文案。

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/tests/features/settingsStorage.test.ts src/tests/features/SettingsPanel.test.tsx`

Expected: FAIL，原因是当前 provider 类型和默认值只覆盖 `localOcr` 与 `deepLTranslate`。

**Step 3: Write minimal implementation**

扩展 `ToolProviderId`、`ToolProviderDefinition` 和默认 provider 配置。给 definition 增加：

- 展示名
- 分组
- logo
- 是否需要 API Key
- Base URL 占位符
- 获取 key 的文案与链接
- 对于腾讯/百度这类双密钥 provider，补充额外字段定义

同步更新 `settingsStorage.ts` 的解析逻辑，确保旧配置能回填到新默认结构。

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/tests/features/settingsStorage.test.ts src/tests/features/SettingsPanel.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/tests/features/settingsStorage.test.ts frontend/src/tests/features/SettingsPanel.test.tsx frontend/src/features/settings/settingsTypes.ts frontend/src/features/settings/settingsStorage.ts frontend/src/features/settings/ProviderPanel.tsx
git commit -m "feat: expand provider settings panel"
```

### Task 2: 新增 bing_web provider 并注册到后端

**Files:**
- Create: `src-tauri/src/apiprovider/bing_web.rs`
- Modify: `src-tauri/src/apiprovider/mod.rs`
- Modify: `src-tauri/src/providers/registry.rs`
- Test: `src-tauri/src/apiprovider/bing_web.rs`（文件内单元测试）

**Step 1: Write the failing test**

在 `bing_web.rs` 中先写最小单元测试，覆盖：

- provider id 正确返回 `bing_web`
- 语言代码映射覆盖 `auto / zh-CN / en / ja / ko / fr / de`
- 环境变量缺失时 `from_env()` 仍可构造网页 provider

如果实现里需要 token 解析辅助函数，再先写辅助函数测试。

**Step 2: Run test to verify it fails**

Run: `cargo test bing_web --manifest-path src-tauri/Cargo.toml`

Expected: FAIL，原因是模块与实现尚不存在。

**Step 3: Write minimal implementation**

实现 `BingWebProvider`，优先复用 `reqwest::Client`，按当前项目的错误模型映射网络、限流、认证与无效响应错误。Provider 配置项保持最小：

- `BING_WEB_BASE_URL`
- `BING_WEB_TRANSLATOR_URL`
- `BING_WEB_USER_AGENT`

如网页流程需要预热页提取动态参数，明确暴露失败，不做静默回退。

**Step 4: Run test to verify it passes**

Run: `cargo test bing_web --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/apiprovider/bing_web.rs src-tauri/src/apiprovider/mod.rs src-tauri/src/providers/registry.rs
git commit -m "feat: add bing web translate provider"
```

### Task 3: 把新旧 provider 元数据完整渲染到设置面板

**Files:**
- Modify: `frontend/src/features/settings/ProviderPanel.tsx`
- Modify: `frontend/src/features/settings/settingsTypes.ts`
- Modify: `frontend/src/styles/provider-panel.css`
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: Write the failing test**

增加测试覆盖：

- 切换不同 provider 时，表单字段会根据 provider 变化
- `youdao_web` 与 `bing_web` 不显示 API Key 输入，但显示网页源说明
- `azure_translator / google_translate / deepl_free / tencent_tmt / baidu_fanyi` 显示正确的字段标签和 key 获取链接

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/tests/features/SettingsPanel.test.tsx`

Expected: FAIL

**Step 3: Write minimal implementation**

把 `ProviderPanel` 改成基于 provider 元数据渲染字段，不再写死单个 `Token / Base URL` 表单。字段类型最少包含：

- 单密钥
- 双密钥
- Base URL
- Region
- 提示说明
- 获取链接

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/tests/features/SettingsPanel.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/settings/ProviderPanel.tsx frontend/src/features/settings/settingsTypes.ts frontend/src/styles/provider-panel.css frontend/src/tests/features/SettingsPanel.test.tsx
git commit -m "feat: add provider setup links and fields"
```

### Task 4: 更新文档与回归验证

**Files:**
- Modify: `docs/翻译API清单.md`
- Modify: `docs/配置模型.md`
- Modify: `docs/Provider契约.md`

**Step 1: Write the failing test**

这一步不新增自动化测试，改为先列出需要同步的文档点：

- `bing_web` 的配置项
- 前端 provider 列表
- 网页 provider 与正式 API provider 的区分

**Step 2: Run verification before docs edit**

Run: `rg -n "youdao_web|bing_web|deepl_free|azure_translator|google_translate|tencent_tmt|baidu_fanyi" docs src-tauri frontend`

Expected: 能定位所有待同步位置。

**Step 3: Write minimal implementation**

同步文档，避免代码和文档的 provider 清单不一致。

**Step 4: Run final verification**

Run: `npm --prefix frontend test -- src/tests/features/settingsStorage.test.ts src/tests/features/SettingsPanel.test.tsx`

Run: `cargo test bing_web --manifest-path src-tauri/Cargo.toml`

Expected: PASS

**Step 5: Commit**

```bash
git add docs/翻译API清单.md docs/配置模型.md docs/Provider契约.md
git commit -m "docs: update provider configuration references"
```
