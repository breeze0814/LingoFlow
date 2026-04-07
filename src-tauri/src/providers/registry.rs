use std::collections::HashMap;
use std::sync::Arc;

use crate::apiprovider::baidu_fanyi::BaiduFanyiProvider;
use crate::apiprovider::bing_web::BingWebProvider;
use crate::apiprovider::deepl_free::DeepLFreeProvider;
use crate::apiprovider::google_translate::GoogleTranslateProvider;
use crate::apiprovider::microsoft_translator::MicrosoftTranslatorProvider;
use crate::apiprovider::tencent_tmt::TencentTmtProvider;
use crate::apiprovider::youdao_web::YoudaoWebProvider;
#[cfg(target_os = "macos")]
use crate::providers::apple_vision_ocr::AppleVisionOcrProvider;
use crate::providers::openai_compatible_ocr::OpenAiCompatibleOcrProvider;
#[cfg(all(target_os = "windows", not(test)))]
use crate::providers::tesseract_js_bridge::TesseractJsBridge;
#[cfg(all(target_os = "windows", not(test)))]
use crate::providers::tesseract_js_ocr::TesseractJsOcrProvider;
use crate::providers::traits::{OcrProvider, TranslateProvider};

pub struct ProviderRegistry {
    translate_providers: HashMap<String, Arc<dyn TranslateProvider>>,
    default_translate_provider_id: Option<String>,
    ocr_providers: HashMap<String, Arc<dyn OcrProvider>>,
    default_ocr_provider_id: Option<String>,
    #[cfg(all(target_os = "windows", not(test)))]
    tesseract_js_bridge: Arc<TesseractJsBridge>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        let mut translate_providers: HashMap<String, Arc<dyn TranslateProvider>> = HashMap::new();
        let mut ocr_providers: HashMap<String, Arc<dyn OcrProvider>> = HashMap::new();
        let mut default_translate_provider_id: Option<String> = None;
        #[cfg(all(target_os = "windows", not(test)))]
        let tesseract_js_bridge = Arc::new(TesseractJsBridge::new());

        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            YoudaoWebProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            BingWebProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            DeepLFreeProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            MicrosoftTranslatorProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            GoogleTranslateProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            TencentTmtProvider::from_env(),
        );
        register_translate_provider(
            &mut translate_providers,
            &mut default_translate_provider_id,
            BaiduFanyiProvider::from_env(),
        );

        #[cfg(target_os = "macos")]
        let mut default_ocr_provider_id: Option<String> = {
            let apple_provider: Arc<dyn OcrProvider> = Arc::new(AppleVisionOcrProvider::new());
            let apple_provider_id = apple_provider.provider_id().to_string();
            ocr_providers.insert(apple_provider_id.clone(), apple_provider);
            Some(apple_provider_id)
        };

        #[cfg(not(target_os = "macos"))]
        let mut default_ocr_provider_id: Option<String> = None;

        #[cfg(all(target_os = "windows", not(test)))]
        {
            let provider: Arc<dyn OcrProvider> =
                Arc::new(TesseractJsOcrProvider::new(tesseract_js_bridge.clone()));
            let provider_id = provider.provider_id().to_string();
            ocr_providers.insert(provider_id.clone(), provider);
            if default_ocr_provider_id.is_none() {
                default_ocr_provider_id = Some(provider_id);
            }
        }

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
            #[cfg(all(target_os = "windows", not(test)))]
            tesseract_js_bridge,
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

    pub fn all_translate_providers(&self) -> Vec<(String, Arc<dyn TranslateProvider>)> {
        let mut provider_ids: Vec<String> = self.translate_providers.keys().cloned().collect();
        provider_ids.sort();
        provider_ids
            .into_iter()
            .filter_map(|provider_id| {
                self.translate_provider_by_id(&provider_id)
                    .map(|provider| (provider_id, provider))
            })
            .collect()
    }

    pub fn default_ocr_provider(&self) -> Option<Arc<dyn OcrProvider>> {
        let provider_id = self.default_ocr_provider_id.clone()?;
        self.ocr_provider_by_id(&provider_id)
    }

    pub fn ocr_provider_by_id(&self, provider_id: &str) -> Option<Arc<dyn OcrProvider>> {
        self.ocr_providers.get(provider_id).cloned()
    }

    #[cfg(all(target_os = "windows", not(test)))]
    pub fn attach_app_handle(&self, app: tauri::AppHandle) {
        self.tesseract_js_bridge.attach_app(app);
    }

    #[cfg(all(target_os = "windows", not(test)))]
    pub fn tesseract_js_bridge(&self) -> Arc<TesseractJsBridge> {
        self.tesseract_js_bridge.clone()
    }
}

fn register_translate_provider<P>(
    translate_providers: &mut HashMap<String, Arc<dyn TranslateProvider>>,
    default_translate_provider_id: &mut Option<String>,
    provider: Option<P>,
) where
    P: TranslateProvider + 'static,
{
    let Some(provider) = provider else {
        return;
    };
    let id = provider.provider_id().to_string();
    translate_providers.insert(id.clone(), Arc::new(provider));
    if default_translate_provider_id.is_none() {
        *default_translate_provider_id = Some(id);
    }
}
