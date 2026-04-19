use serde_json::{Map, Value};

use crate::apiprovider::runtime_config::{
    OcrProviderRuntimeConfig, TranslateProviderRuntimeConfig,
};
use crate::errors::app_error::AppError;
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::SettingsStore;

const TRANSLATE_PROVIDER_ORDER: [&str; 8] = [
    "openai_compatible",
    "youdao_web",
    "bing_web",
    "deepl_free",
    "azure_translator",
    "google_translate",
    "tencent_tmt",
    "baidu_fanyi",
];
const OPENAI_OCR_PROVIDER_ID: &str = "openai_compatible_ocr";

#[derive(Debug, Clone, Default)]
pub struct RuntimeProviderSettings {
    pub default_translate_provider: Option<String>,
    pub default_ocr_provider: Option<String>,
    pub translate_provider_configs: Vec<TranslateProviderRuntimeConfig>,
    pub ocr_provider_configs: Vec<OcrProviderRuntimeConfig>,
}

impl RuntimeProviderSettings {
    pub fn load(
        settings_store: &SettingsStore,
        keychain_store: &KeychainStore,
    ) -> Result<Self, AppError> {
        let Some(settings) =
            crate::settings_persistence::load_settings(settings_store, keychain_store)?
        else {
            return Ok(Self::default());
        };
        Ok(parse_runtime_provider_settings(&settings))
    }

    pub fn translate_provider_configs_option(&self) -> Option<Vec<TranslateProviderRuntimeConfig>> {
        if self.translate_provider_configs.is_empty() {
            return None;
        }
        Some(self.translate_provider_configs.clone())
    }

    pub fn ocr_provider_configs_option(&self) -> Option<Vec<OcrProviderRuntimeConfig>> {
        if self.ocr_provider_configs.is_empty() {
            return None;
        }
        Some(self.ocr_provider_configs.clone())
    }

    pub fn default_runtime_ocr_provider_id(&self) -> Option<String> {
        if self.default_ocr_provider.as_deref() == Some(OPENAI_OCR_PROVIDER_ID) {
            return Some(OPENAI_OCR_PROVIDER_ID.to_string());
        }
        None
    }
}

fn parse_runtime_provider_settings(settings: &Value) -> RuntimeProviderSettings {
    let providers = settings
        .as_object()
        .and_then(|item| item.get("providers"))
        .and_then(Value::as_object);

    RuntimeProviderSettings {
        default_translate_provider: parse_trimmed_string(settings, "defaultTranslateProvider"),
        default_ocr_provider: parse_trimmed_string(settings, "defaultOcrProvider"),
        translate_provider_configs: build_translate_configs(providers),
        ocr_provider_configs: build_ocr_configs(providers),
    }
}

fn build_translate_configs(
    providers: Option<&Map<String, Value>>,
) -> Vec<TranslateProviderRuntimeConfig> {
    let Some(providers) = providers else {
        return Vec::new();
    };
    TRANSLATE_PROVIDER_ORDER
        .iter()
        .filter_map(|provider_id| build_translate_config(providers, provider_id))
        .collect()
}

fn build_ocr_configs(providers: Option<&Map<String, Value>>) -> Vec<OcrProviderRuntimeConfig> {
    let Some(providers) = providers else {
        return Vec::new();
    };
    let Some(provider) = provider_object(providers, OPENAI_OCR_PROVIDER_ID) else {
        return Vec::new();
    };
    if !provider_enabled(provider) {
        return Vec::new();
    }
    vec![OcrProviderRuntimeConfig {
        id: OPENAI_OCR_PROVIDER_ID.to_string(),
        api_key: parse_trimmed_string_from_map(provider, "apiKey"),
        base_url: parse_trimmed_string_from_map(provider, "baseUrl"),
        model: parse_trimmed_string_from_map(provider, "model"),
    }]
}

fn build_translate_config(
    providers: &Map<String, Value>,
    provider_id: &str,
) -> Option<TranslateProviderRuntimeConfig> {
    let provider = provider_object(providers, provider_id)?;
    if !provider_enabled(provider) {
        return None;
    }
    let mut config = TranslateProviderRuntimeConfig {
        id: provider_id.to_string(),
        api_key: None,
        base_url: None,
        model: None,
        region: None,
        secret_id: None,
        secret_key: None,
        app_id: None,
        app_secret: None,
    };
    config.api_key = parse_trimmed_string_from_map(provider, "apiKey");
    config.base_url = parse_trimmed_string_from_map(provider, "baseUrl");
    config.model = parse_trimmed_string_from_map(provider, "model");
    config.region = parse_trimmed_string_from_map(provider, "region");
    config.secret_id = parse_trimmed_string_from_map(provider, "secretId");
    config.secret_key = parse_trimmed_string_from_map(provider, "secretKey");
    config.app_id = parse_trimmed_string_from_map(provider, "appId");
    config.app_secret = parse_trimmed_string_from_map(provider, "appSecret");
    Some(config)
}

fn provider_object<'a>(
    providers: &'a Map<String, Value>,
    provider_id: &str,
) -> Option<&'a Map<String, Value>> {
    providers.get(provider_id).and_then(Value::as_object)
}

fn provider_enabled(provider: &Map<String, Value>) -> bool {
    provider
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn parse_trimmed_string(settings: &Value, key: &str) -> Option<String> {
    settings
        .as_object()
        .and_then(|object| object.get(key))
        .and_then(Value::as_str)
        .and_then(trimmed_non_empty)
}

fn parse_trimmed_string_from_map(provider: &Map<String, Value>, key: &str) -> Option<String> {
    provider
        .get(key)
        .and_then(Value::as_str)
        .and_then(trimmed_non_empty)
}

fn trimmed_non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_runtime_provider_settings;

    #[test]
    fn parses_enabled_runtime_provider_configs_from_settings_payload() {
        let payload = json!({
            "defaultTranslateProvider": "youdao_web",
            "defaultOcrProvider": "openai_compatible_ocr",
            "providers": {
                "openai_compatible_ocr": {"enabled": true, "apiKey": "ocr-key", "baseUrl": " https://api.openai.com/v1 ", "model": " gpt-4o-mini "},
                "openai_compatible": {"enabled": true, "apiKey": "translate-key", "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
                "youdao_web": {"enabled": true},
                "bing_web": {"enabled": false},
                "deepl_free": {"enabled": true, "apiKey": "deepl-key"},
                "azure_translator": {"enabled": false},
                "google_translate": {"enabled": false},
                "tencent_tmt": {"enabled": false},
                "baidu_fanyi": {"enabled": false}
            }
        });

        let runtime = parse_runtime_provider_settings(&payload);

        assert_eq!(
            runtime.default_translate_provider.as_deref(),
            Some("youdao_web")
        );
        assert_eq!(
            runtime.default_ocr_provider.as_deref(),
            Some("openai_compatible_ocr")
        );
        assert_eq!(
            runtime
                .translate_provider_configs
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            vec!["openai_compatible", "youdao_web", "deepl_free"]
        );
        assert_eq!(
            runtime.ocr_provider_configs[0].api_key.as_deref(),
            Some("ocr-key")
        );
        assert_eq!(
            runtime.ocr_provider_configs[0].base_url.as_deref(),
            Some("https://api.openai.com/v1")
        );
        assert_eq!(
            runtime.ocr_provider_configs[0].model.as_deref(),
            Some("gpt-4o-mini")
        );
    }
}
