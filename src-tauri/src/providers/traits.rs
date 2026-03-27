use async_trait::async_trait;

use crate::errors::app_error::AppError;

#[derive(Debug, Clone)]
pub struct TranslateRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct TranslateResult {
    pub provider_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub detected_source_lang: String,
}

#[derive(Debug, Clone)]
pub struct OcrRequest {
    pub image_path: String,
    pub source_lang_hint: Option<String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct OcrResult {
    pub provider_id: String,
    pub recognized_text: String,
}

#[async_trait]
pub trait TranslateProvider: Send + Sync {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError>;
    fn provider_id(&self) -> &'static str;
}

#[async_trait]
pub trait OcrProvider: Send + Sync {
    async fn recognize(&self, req: OcrRequest) -> Result<OcrResult, AppError>;
    fn provider_id(&self) -> &'static str;
}
