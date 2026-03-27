# 轻量桌面翻译器 HTTP API 契约
## 1. 目标
定义 localhost API 的行为边界，确保本地脚本、PopClip 类工具和主程序走同一套任务编排。

## 2. 基本约束
- V1 仅监听 `127.0.0.1`。
- 默认端口：`61928`。
- 端口可配置。
- V1 不开放远程访问。
- V1 不做鉴权。
- V1 不做 WebSocket。

## 3. 通用响应格式
### 3.1 成功
```json
{
  "ok": true,
  "task_id": "task_123",
  "status": "success",
  "data": {}
}
```

### 3.2 失败
```json
{
  "ok": false,
  "task_id": "task_123",
  "status": "failure",
  "error": {
    "code": "provider_timeout",
    "message": "Translate request timed out",
    "retryable": true
  }
}
```

### 3.3 取消
```json
{
  "ok": false,
  "task_id": "task_123",
  "status": "cancelled",
  "error": {
    "code": "user_cancelled",
    "message": "The user cancelled the task",
    "retryable": true
  }
}
```

## 4. 路由定义
### 4.1 `POST /translate`
直接翻译给定文本。

请求体：
```json
{
  "text": "hello world",
  "source_lang": "auto",
  "target_lang": "zh-CN",
  "provider_id": "openai_compatible"
}
```

成功响应 `200`：
```json
{
  "ok": true,
  "task_id": "task_123",
  "status": "success",
  "data": {
    "source_text": "hello world",
    "translated_text": "你好，世界",
    "detected_source_lang": "en",
    "target_lang": "zh-CN",
    "provider_id": "openai_compatible"
  }
}
```

### 4.2 `GET /selection_translate`
读取当前前台应用选中文本并翻译。

可选查询参数：
- `target_lang`
- `provider_id`

成功响应 `200`，失败或取消按通用结构返回。

### 4.3 `GET /input_translate`
打开输入面板。

可选查询参数：
- `text`
- `target_lang`

响应 `202`：
```json
{
  "ok": true,
  "status": "accepted",
  "data": {
    "command": "open_input_panel"
  }
}
```

### 4.4 `GET /ocr_recognize`
启动交互式截图 OCR。

可选查询参数：
- `source_lang_hint`
- `provider_id`

用户完成截图后返回最终结果。

### 4.5 `GET /ocr_translate`
启动交互式截图翻译。

可选查询参数：
- `target_lang`
- `translate_provider_id`
- `ocr_provider_id`

用户完成截图后返回最终结果。

## 5. HTTP 状态码
- `200`：任务成功完成。
- `202`：命令已接收，但不等待终态。
- `400`：参数错误。
- `409`：当前状态不允许执行该请求。
- `500`：内部错误。

用户取消截图或输入，不返回 `500`，而返回 `200` 搭配 `status=cancelled`。

## 6. 参数规则
- `text` 不能为空字符串。
- `source_lang` 默认 `auto`。
- `target_lang` 缺失时使用配置默认值。
- `provider_id` 缺失时使用当前默认 Provider。

## 7. 非目标
- V1 不支持上传二进制图片做 OCR。
- V1 不支持从外部截图文件路径读取。
- V1 不支持批量任务。
- V1 不支持订阅任务进度。

## 8. 兼容要求
- HTTP API 调用和桌面 UI 必须复用同一个 orchestrator。
- 返回字段一旦对外发布，不在 V1 内随意重命名。
