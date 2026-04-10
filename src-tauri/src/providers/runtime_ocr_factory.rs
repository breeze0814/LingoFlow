use std::sync::Arc;

use crate::apiprovider::runtime_config::OcrProviderRuntimeConfig;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::openai_compatible_ocr::OpenAiCompatibleOcrProvider;
use crate::providers::traits::OcrProvider;

pub fn build_runtime_ocr_provider(
    requested_provider_id: &str,
    configs: &[OcrProviderRuntimeConfig],
) -> Result<Arc<dyn OcrProvider>, AppError> {
    let config = configs
        .iter()
        .find(|item| item.id == requested_provider_id)
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderNotEnabled,
                format!("OCR provider `{requested_provider_id}` is not enabled"),
                false,
            )
        })?;

    match requested_provider_id {
        "openai_compatible_ocr" => Ok(Arc::new(OpenAiCompatibleOcrProvider::from_runtime_config(
            config.api_key.clone(),
            config.base_url.clone(),
            config.model.clone(),
        )?)),
        _ => Err(AppError::new(
            ErrorCode::ProviderNotEnabled,
            format!("OCR provider `{requested_provider_id}` is not supported"),
            false,
        )),
    }
}

#[cfg(test)]
mod tests {
    use crate::apiprovider::runtime_config::OcrProviderRuntimeConfig;
    use crate::errors::error_code::ErrorCode;

    use super::build_runtime_ocr_provider;

    #[test]
    fn returns_configuration_error_for_missing_ocr_api_key() {
        let result = build_runtime_ocr_provider(
            "openai_compatible_ocr",
            &[OcrProviderRuntimeConfig::new("openai_compatible_ocr")],
        );

        assert!(matches!(
            result,
            Err(error) if matches!(error.code, ErrorCode::ProviderNotConfigured)
        ));
    }
}
