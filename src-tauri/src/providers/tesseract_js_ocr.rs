use std::sync::Arc;

use async_trait::async_trait;

use crate::errors::app_error::AppError;
use crate::providers::tesseract_js_bridge::TesseractJsBridge;
use crate::providers::traits::{OcrProvider, OcrRequest, OcrResult};

const PROVIDER_ID: &str = "tesseract_js_ocr";

pub struct TesseractJsOcrProvider {
    bridge: Arc<TesseractJsBridge>,
}

impl TesseractJsOcrProvider {
    pub fn new(bridge: Arc<TesseractJsBridge>) -> Self {
        Self { bridge }
    }
}

#[async_trait]
impl OcrProvider for TesseractJsOcrProvider {
    async fn recognize(&self, req: OcrRequest) -> Result<OcrResult, AppError> {
        let recognized_text = self.bridge.recognize(req).await?;
        Ok(OcrResult {
            provider_id: PROVIDER_ID.to_string(),
            recognized_text,
        })
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}
