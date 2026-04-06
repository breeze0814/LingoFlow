# 轻量桌面翻译器 Provider 契约
## 1. 目标
统一翻译和 OCR Provider 的接入方式，避免业务层直接依赖具体服务实现。

## 2. Provider 分类
- `translate`
- `ocr`

V1 不定义 `tts`、`dictionary`、`wordbook` Provider。

## 3. 通用原则
- Provider 必须是纯能力适配层。
- Provider 不负责 UI。
- Provider 不负责权限申请。
- Provider 不直接读写全局配置。
- Provider 返回结构化结果，不返回“半成功”。

## 4. 翻译 Provider 契约
### 4.1 请求结构
```ts
type TranslateRequest = {
  taskId: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  timeoutMs: number;
};
```

### 4.2 响应结构
```ts
type TranslateResult = {
  providerId: string;
  detectedSourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  durationMs: number;
};
```

## 5. OCR Provider 契约
### 5.1 请求结构
```ts
type OcrRequest = {
  taskId: string;
  imagePath: string;
  sourceLangHint?: string;
  timeoutMs: number;
};
```

### 5.2 响应结构
```ts
type OcrResult = {
  providerId: string;
  recognizedText: string;
  durationMs: number;
};
```

## 6. Provider 元信息
每个 Provider 必须声明：
```ts
type ProviderMeta = {
  id: string;
  kind: "translate" | "ocr";
  displayName: string;
  requiresNetwork: boolean;
  requiresSecret: boolean;
  enabledByDefault: boolean;
};
```

## 7. 错误结构
Provider 必须返回统一错误结构：
```ts
type ProviderError = {
  code:
    | "provider_not_configured"
    | "provider_not_enabled"
    | "provider_timeout"
    | "provider_network_error"
    | "provider_auth_error"
    | "provider_rate_limited"
    | "provider_invalid_response"
    | "provider_execution_failed";
  message: string;
  retryable: boolean;
};
```

## 8. 业务层接口约定
Rust 侧建议维持等价接口：
```rust
async fn translate(request: TranslateRequest) -> Result<TranslateResult, ProviderError>;
async fn recognize(request: OcrRequest) -> Result<OcrResult, ProviderError>;
```

## 9. 调用规则
- 业务层必须显式指定 Provider。
- 如果默认 Provider 不可用，直接失败，不自动切换。
- V1 不做并行 Provider 聚合。
- V1 不做自动重试。
- 超时由 orchestrator 传入，不由 Provider 自行决定。

## 10. 文本边界
- 空文本不得进入翻译 Provider。
- OCR 识别为空时返回失败，不返回空成功。
- 输入文本必须保留原始内容，不在 Provider 内做静默清洗。
- 文本预处理如果存在，必须在 orchestrator 或独立 normalizer 完成。

## 11. Provider 配置边界
- 非敏感配置存 Store。
- 密钥放 Keychain。
- Provider 只能接收已经解析好的配置，不自己读取配置源。

## 12. V1 推荐 Provider
- 翻译：`youdao_web`、`bing_web`、`deepl_free`、`azure_translator`、`google_translate`、`tencent_tmt`、`baidu_fanyi`
- OCR：`apple_vision`
