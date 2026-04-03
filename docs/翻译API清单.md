# 翻译 API 清单（免费与付费）

配套执行文档见：[文档总览](./文档总览.md)

## 1. 使用说明
- 本清单只记录主流翻译 API 的官方入口与定价页面，作为后续 Provider 对接的基础索引。
- `免费` 指存在免费额度或免费层，不等于无限免费。
- 价格和额度会调整，最终以各平台官网实时信息为准。

## 2. 免费（含免费额度）API（5 条）
1. `DeepL API Free`
官网与计费说明：
- https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-Free

2. `Azure AI Translator`
官网与计费说明：
- https://azure.microsoft.com/en-us/pricing/details/translator/

3. `Google Cloud Translation`
官网与计费说明：
- https://cloud.google.com/translate/pricing

4. `腾讯云机器翻译 TMT`
官网与计费说明：
- https://cloud.tencent.com/document/product/551/35017

5. `百度翻译开放平台（通用文本翻译）`
官网与产品页：
- https://fanyi-api.baidu.com/product/11

## 3. 付费商用 API（5 条）
1. `Google Cloud Translation`
官网与计费说明：
- https://cloud.google.com/translate/pricing

2. `Amazon Translate`
官网与计费说明：
- https://aws.amazon.com/cn/translate/pricing/

3. `DeepL API Pro`
官网与计费说明：
- https://www.deepl.com/pro-api
- https://support.deepl.com/hc/en-us/articles/360020685720-Character-count-and-billing-in-DeepL-API

4. `腾讯云机器翻译 TMT`
官网与计费说明：
- https://cloud.tencent.com/document/product/551/35017

5. `阿里云机器翻译`
官网与计费说明：
- https://help.aliyun.com/zh/machine-translation/product-overview/pricing-of-machine-translation

## 4. 当前代码对接标识（2026-04-01）
以下为 `src-tauri/src/apiprovider/` 已接入的免费翻译 Provider 标识与环境变量：

1. `youdao_web`（网页端免 key）
- 默认无需用户单独配置 API Key。
- 注意：该方案基于网页端接口行为，接口策略变化时可能失效。
- 可选：`YOUDAO_WEB_REFERER`
- 可选：`YOUDAO_WEB_USER_AGENT`
- 可选：`YOUDAO_WEB_COOKIE`
- 可选：`YOUDAO_WEB_KEY_ENDPOINT`（默认 `https://dict.youdao.com/webtranslate/key`）
- 可选：`YOUDAO_WEB_TRANSLATE_ENDPOINT`（默认 `https://dict.youdao.com/webtranslate`）

2. `deepl_free`
- `DEEPL_API_KEY`
- 可选：`DEEPL_BASE_URL`（默认 `https://api-free.deepl.com/v2/translate`）

3. `azure_translator`
- `AZURE_TRANSLATOR_KEY`
- 可选：`AZURE_TRANSLATOR_REGION`
- 可选：`AZURE_TRANSLATOR_BASE_URL`（默认 `https://api.cognitive.microsofttranslator.com`）

4. `google_translate`
- `GOOGLE_TRANSLATE_API_KEY`
- 可选：`GOOGLE_TRANSLATE_BASE_URL`（默认 `https://translation.googleapis.com/language/translate/v2`）

5. `tencent_tmt`
- `TENCENT_TRANSLATE_SECRET_ID`
- `TENCENT_TRANSLATE_SECRET_KEY`
- 可选：`TENCENT_TRANSLATE_REGION`（默认 `ap-guangzhou`）
- 可选：`TENCENT_TRANSLATE_BASE_URL`（默认 `https://tmt.tencentcloudapi.com`）
- 可选：`TENCENT_TRANSLATE_HOST`（默认 `tmt.tencentcloudapi.com`）

6. `baidu_fanyi`
- `BAIDU_TRANSLATE_APP_ID`
- `BAIDU_TRANSLATE_SECRET`
- 可选：`BAIDU_TRANSLATE_BASE_URL`（默认 `https://fanyi-api.baidu.com/api/trans/vip/translate`）
