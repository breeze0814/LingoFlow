use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::service::Orchestrator;
use crate::providers::runtime_ocr_factory::build_runtime_ocr_provider;
use crate::providers::runtime_translate_factory::{
    build_runtime_translate_targets, TranslateExecutionTarget,
};

impl Orchestrator {
    pub(super) fn pick_translate_provider(
        &self,
        requested_provider_id: Option<&str>,
    ) -> Result<Arc<dyn crate::providers::traits::TranslateProvider>, AppError> {
        if let Some(provider_id) = requested_provider_id {
            if let Some(provider) = self.providers.translate_provider_by_id(provider_id) {
                return Ok(provider);
            }
            return Err(AppError::new(
                ErrorCode::ProviderNotEnabled,
                format!("Translate provider `{provider_id}` is not enabled"),
                false,
            ));
        }
        self.providers.default_translate_provider().ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No translate provider configured. Please configure at least one API provider key.",
                false,
            )
        })
    }

    pub(super) fn pick_translate_providers(
        &self,
        requested_provider_id: Option<&str>,
        runtime_configs: Option<
            &[crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig],
        >,
    ) -> Result<Vec<TranslateExecutionTarget>, AppError> {
        if let Some(configs) = runtime_configs {
            return self.pick_runtime_translate_providers(requested_provider_id, configs);
        }
        if let Some(provider_id) = requested_provider_id {
            let provider = self.pick_translate_provider(Some(provider_id))?;
            return Ok(vec![TranslateExecutionTarget::Ready {
                provider_id: provider_id.to_string(),
                provider,
            }]);
        }
        let providers = self.providers.all_translate_providers();
        if providers.is_empty() {
            return Err(AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No translate provider configured. Please configure at least one API provider key.",
                false,
            ));
        }
        Ok(providers
            .into_iter()
            .map(|(provider_id, provider)| TranslateExecutionTarget::Ready {
                provider_id,
                provider,
            })
            .collect())
    }

    pub(super) fn pick_ocr_provider(
        &self,
        requested_provider_id: Option<&str>,
        runtime_configs: Option<&[crate::apiprovider::runtime_config::OcrProviderRuntimeConfig]>,
    ) -> Result<Arc<dyn crate::providers::traits::OcrProvider>, AppError> {
        if let (Some(provider_id), Some(configs)) = (requested_provider_id, runtime_configs) {
            return build_runtime_ocr_provider(provider_id, configs);
        }
        if let Some(provider_id) = requested_provider_id {
            if let Some(provider) = self.providers.ocr_provider_by_id(provider_id) {
                return Ok(provider);
            }
            return Err(AppError::new(
                ErrorCode::ProviderNotEnabled,
                format!("OCR provider `{provider_id}` is not enabled"),
                false,
            ));
        }
        self.providers.default_ocr_provider().ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No OCR provider configured.",
                false,
            )
        })
    }

    fn pick_runtime_translate_providers(
        &self,
        requested_provider_id: Option<&str>,
        configs: &[crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig],
    ) -> Result<Vec<TranslateExecutionTarget>, AppError> {
        let providers = if let Some(provider_id) = requested_provider_id {
            let targets = build_runtime_translate_targets(configs);
            let filtered = targets
                .into_iter()
                .filter(|target| target.provider_id() == provider_id)
                .collect::<Vec<TranslateExecutionTarget>>();
            if filtered.is_empty() {
                return Err(AppError::new(
                    ErrorCode::ProviderNotEnabled,
                    format!("Translate provider `{provider_id}` is not enabled"),
                    false,
                ));
            }
            filtered
        } else {
            build_runtime_translate_targets(configs)
        };
        if providers.is_empty() {
            return Err(AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No translate provider configured.",
                false,
            ));
        }
        Ok(providers)
    }
}
