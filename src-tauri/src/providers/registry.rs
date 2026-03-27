use std::collections::HashMap;
use std::sync::Arc;

#[cfg(target_os = "macos")]
use crate::providers::apple_vision_ocr::AppleVisionOcrProvider;
use crate::providers::openai_compatible::OpenAiCompatibleProvider;
use crate::providers::openai_compatible_ocr::OpenAiCompatibleOcrProvider;
use crate::providers::traits::{OcrProvider, TranslateProvider};

pub struct ProviderRegistry {
    translate_providers: HashMap<String, Arc<dyn TranslateProvider>>,
    default_translate_provider_id: Option<String>,
    ocr_providers: HashMap<String, Arc<dyn OcrProvider>>,
    default_ocr_provider_id: Option<String>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        let mut translate_providers: HashMap<String, Arc<dyn TranslateProvider>> = HashMap::new();
        let mut ocr_providers: HashMap<String, Arc<dyn OcrProvider>> = HashMap::new();
        #[cfg(target_os = "macos")]
        let mut default_ocr_provider_id: Option<String> = {
            let apple_provider: Arc<dyn OcrProvider> = Arc::new(AppleVisionOcrProvider::new());
            let apple_provider_id = apple_provider.provider_id().to_string();
            ocr_providers.insert(apple_provider_id.clone(), apple_provider);
            Some(apple_provider_id)
        };

        #[cfg(not(target_os = "macos"))]
        let mut default_ocr_provider_id: Option<String> = None;

        let default_translate_provider_id = OpenAiCompatibleProvider::from_env().map(|provider| {
            let id = provider.provider_id().to_string();
            translate_providers.insert(id.clone(), Arc::new(provider));
            id
        });

        if let Some(provider) = OpenAiCompatibleOcrProvider::from_env() {
            let id = provider.provider_id().to_string();
            ocr_providers.insert(id.clone(), Arc::new(provider));
            if default_ocr_provider_id.is_none() {
                default_ocr_provider_id = Some(id);
            }
        }

        Self {
            translate_providers,
            default_translate_provider_id,
            ocr_providers,
            default_ocr_provider_id,
        }
    }

    pub fn default_translate_provider(&self) -> Option<Arc<dyn TranslateProvider>> {
        let provider_id = self.default_translate_provider_id.clone()?;
        self.translate_provider_by_id(&provider_id)
    }

    pub fn translate_provider_by_id(
        &self,
        provider_id: &str,
    ) -> Option<Arc<dyn TranslateProvider>> {
        self.translate_providers.get(provider_id).cloned()
    }

    pub fn default_ocr_provider(&self) -> Option<Arc<dyn OcrProvider>> {
        let provider_id = self.default_ocr_provider_id.clone()?;
        self.ocr_provider_by_id(&provider_id)
    }

    pub fn ocr_provider_by_id(&self, provider_id: &str) -> Option<Arc<dyn OcrProvider>> {
        self.ocr_providers.get(provider_id).cloned()
    }
}
