use std::sync::Arc;

use reqwest::Url;

use crate::apiprovider::baidu_fanyi::{
    BaiduFanyiConfig, BaiduFanyiProvider, DEFAULT_BASE_URL as BAIDU_BASE_URL,
};
use crate::apiprovider::bing_web::BingWebProvider;
use crate::apiprovider::deepl_free::{
    DeepLConfig, DeepLFreeProvider, DEFAULT_BASE_URL as DEEPL_BASE_URL,
};
use crate::apiprovider::google_translate::{
    GoogleTranslateConfig, GoogleTranslateProvider, DEFAULT_BASE_URL as GOOGLE_BASE_URL,
};
use crate::apiprovider::microsoft_translator::{
    MicrosoftTranslatorConfig, MicrosoftTranslatorProvider, DEFAULT_BASE_URL as AZURE_BASE_URL,
};
use crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig;
use crate::apiprovider::tencent_tmt::{
    TencentTmtConfig, TencentTmtProvider, DEFAULT_BASE_URL as TENCENT_BASE_URL,
    DEFAULT_HOST as TENCENT_HOST, DEFAULT_REGION as TENCENT_REGION,
};
use crate::apiprovider::tencent_tmt_signer::TencentTmtSigner;
use crate::apiprovider::youdao_web::YoudaoWebProvider;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::openai_compatible::OpenAiCompatibleProvider;
use crate::providers::traits::TranslateProvider;

pub enum TranslateExecutionTarget {
    Ready {
        provider_id: String,
        provider: Arc<dyn TranslateProvider>,
    },
    BuildError {
        provider_id: String,
        error: AppError,
    },
}

impl TranslateExecutionTarget {
    pub fn provider_id(&self) -> &str {
        match self {
            Self::Ready { provider_id, .. } | Self::BuildError { provider_id, .. } => provider_id,
        }
    }
}

pub fn build_runtime_translate_targets(
    configs: &[TranslateProviderRuntimeConfig],
) -> Vec<TranslateExecutionTarget> {
    configs.iter().map(build_target).collect()
}

fn build_target(config: &TranslateProviderRuntimeConfig) -> TranslateExecutionTarget {
    let provider_id = config.id.clone();
    let provider = match provider_id.as_str() {
        "youdao_web" => Ok(Arc::new(
            YoudaoWebProvider::from_env().expect("youdao web provider should be constructible"),
        ) as Arc<dyn TranslateProvider>),
        "bing_web" => Ok(Arc::new(
            BingWebProvider::from_env().expect("bing web provider should be constructible"),
        ) as Arc<dyn TranslateProvider>),
        "openai_compatible" => build_openai_compatible(config),
        "deepl_free" => build_deepl(config),
        "azure_translator" => build_azure(config),
        "google_translate" => build_google(config),
        "tencent_tmt" => build_tencent(config),
        "baidu_fanyi" => build_baidu(config),
        _ => Err(AppError::new(
            ErrorCode::ProviderNotEnabled,
            format!("Translate provider `{provider_id}` is not supported"),
            false,
        )),
    };
    match provider {
        Ok(provider) => TranslateExecutionTarget::Ready {
            provider_id,
            provider,
        },
        Err(error) => TranslateExecutionTarget::BuildError { provider_id, error },
    }
}

fn build_deepl(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    let api_key = required_field(&config.id, "api_key", config.api_key.as_deref())?;
    Ok(Arc::new(DeepLFreeProvider {
        config: DeepLConfig {
            api_key,
            base_url: optional_or_default(config.base_url.as_deref(), DEEPL_BASE_URL),
        },
        client: reqwest::Client::new(),
    }))
}

fn build_openai_compatible(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    Ok(Arc::new(OpenAiCompatibleProvider::from_runtime_config(
        config.api_key.clone(),
        config.base_url.clone(),
        config.model.clone(),
    )?))
}

fn build_azure(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    let api_key = required_field(&config.id, "api_key", config.api_key.as_deref())?;
    Ok(Arc::new(MicrosoftTranslatorProvider {
        config: MicrosoftTranslatorConfig {
            api_key,
            region: optional_string(config.region.as_deref()),
            base_url: optional_or_default(config.base_url.as_deref(), AZURE_BASE_URL),
        },
        client: reqwest::Client::new(),
    }))
}

fn build_google(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    let api_key = required_field(&config.id, "api_key", config.api_key.as_deref())?;
    Ok(Arc::new(GoogleTranslateProvider {
        config: GoogleTranslateConfig {
            api_key,
            base_url: optional_or_default(config.base_url.as_deref(), GOOGLE_BASE_URL),
        },
        client: reqwest::Client::new(),
    }))
}

fn build_tencent(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    let secret_id = required_field(&config.id, "secret_id", config.secret_id.as_deref())?;
    let secret_key = required_field(&config.id, "secret_key", config.secret_key.as_deref())?;
    let base_url = optional_or_default(config.base_url.as_deref(), TENCENT_BASE_URL);
    let host = derive_host(&base_url);
    Ok(Arc::new(TencentTmtProvider {
        config: TencentTmtConfig {
            region: optional_or_default(config.region.as_deref(), TENCENT_REGION),
            base_url,
            host: host.clone(),
            signer: TencentTmtSigner::new(secret_id, secret_key, host),
        },
        client: reqwest::Client::new(),
    }))
}

fn build_baidu(
    config: &TranslateProviderRuntimeConfig,
) -> Result<Arc<dyn TranslateProvider>, AppError> {
    let app_id = required_field(&config.id, "app_id", config.app_id.as_deref())?;
    let app_secret = required_field(&config.id, "app_secret", config.app_secret.as_deref())?;
    Ok(Arc::new(BaiduFanyiProvider {
        config: BaiduFanyiConfig {
            app_id,
            secret: app_secret,
            base_url: optional_or_default(config.base_url.as_deref(), BAIDU_BASE_URL),
        },
        client: reqwest::Client::new(),
    }))
}

fn required_field(
    provider_id: &str,
    field_name: &str,
    value: Option<&str>,
) -> Result<String, AppError> {
    let normalized = optional_string(value);
    normalized.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderNotConfigured,
            format!("Translate provider `{provider_id}` missing required field `{field_name}`"),
            false,
        )
    })
}

fn optional_string(value: Option<&str>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn optional_or_default(value: Option<&str>, default_value: &str) -> String {
    optional_string(value).unwrap_or_else(|| default_value.to_string())
}

fn derive_host(base_url: &str) -> String {
    Url::parse(base_url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| TENCENT_HOST.to_string())
}

#[cfg(test)]
mod tests {
    use crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig;
    use crate::errors::error_code::ErrorCode;

    use super::{build_runtime_translate_targets, TranslateExecutionTarget};

    #[test]
    fn builds_ready_target_for_enabled_web_provider() {
        let targets =
            build_runtime_translate_targets(&[TranslateProviderRuntimeConfig::new("youdao_web")]);

        assert!(matches!(
            targets.first(),
            Some(TranslateExecutionTarget::Ready { provider_id, .. }) if provider_id == "youdao_web"
        ));
    }

    #[test]
    fn builds_ready_target_for_openai_compatible_with_runtime_config() {
        let mut config = TranslateProviderRuntimeConfig::new("openai_compatible");
        config.api_key = Some("openai-key".to_string());
        let targets = build_runtime_translate_targets(&[config]);

        assert!(matches!(
            targets.first(),
            Some(TranslateExecutionTarget::Ready { provider_id, .. }) if provider_id == "openai_compatible"
        ));
    }

    #[test]
    fn returns_configuration_error_for_missing_api_key() {
        let targets =
            build_runtime_translate_targets(&[TranslateProviderRuntimeConfig::new("deepl_free")]);

        assert!(matches!(
            targets.first(),
            Some(TranslateExecutionTarget::BuildError { provider_id, error })
                if provider_id == "deepl_free" && matches!(error.code, ErrorCode::ProviderNotConfigured)
        ));
    }
}
