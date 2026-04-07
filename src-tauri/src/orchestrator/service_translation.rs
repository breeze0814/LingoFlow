use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{ProviderTranslationData, TaskData, TaskRequest, TaskResponse};
use crate::providers::runtime_translate_factory::{
    build_runtime_translate_targets, TranslateExecutionTarget,
};
use crate::providers::traits::{TranslateProvider, TranslateRequest};

use super::{Orchestrator, DEFAULT_TRANSLATE_TIMEOUT_MS};

impl Orchestrator {
    pub(super) async fn handle_input_translate(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let text = request.text.clone().unwrap_or_default();
        self.translate_text(request, task_id, text).await
    }

    pub(super) async fn handle_selection_translate(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let text = match crate::platform::selection::read_selected_text() {
            Ok(text) => text,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        self.translate_text(request, task_id, text).await
    }

    async fn translate_text(
        &self,
        request: TaskRequest,
        task_id: String,
        text: String,
    ) -> Result<TaskResponse, AppError> {
        if text.trim().is_empty() {
            return Ok(Self::failed(
                task_id,
                AppError::new(ErrorCode::EmptyInput, "Input text is empty", false),
            ));
        }

        let source_lang = request
            .source_lang
            .unwrap_or_else(|| self.config_store.get().app.source_lang);
        let target_lang = request
            .target_lang
            .unwrap_or_else(|| self.config_store.get().app.target_lang);
        let providers = match self.pick_translate_providers(
            request.translate_provider_id.as_deref(),
            request.translate_provider_configs.as_deref(),
        ) {
            Ok(providers) => providers,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };

        let translation_results = self
            .translate_with_providers(
                &providers,
                &text,
                source_lang.as_str(),
                target_lang.as_str(),
            )
            .await;
        let Some(primary_result) = Self::first_successful_translation(&translation_results) else {
            return Ok(Self::failed(
                task_id,
                Self::first_translation_error(&translation_results),
            ));
        };

        Ok(Self::success(
            task_id,
            TaskData {
                provider_id: primary_result.provider_id.clone(),
                source_text: text,
                translated_text: primary_result.translated_text.clone(),
                recognized_text: None,
                translation_results,
                capture_rect: None,
            },
        ))
    }

    pub(super) fn pick_translate_providers(
        &self,
        requested_provider_id: Option<&str>,
        runtime_configs: Option<
            &[crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig],
        >,
    ) -> Result<Vec<TranslateExecutionTarget>, AppError> {
        if let Some(configs) = runtime_configs {
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
            return Ok(providers);
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

    pub(super) async fn translate_with_providers(
        &self,
        providers: &[TranslateExecutionTarget],
        text: &str,
        source_lang: &str,
        target_lang: &str,
    ) -> Vec<ProviderTranslationData> {
        let mut results = Vec::with_capacity(providers.len());
        for target in providers {
            let result = match target {
                TranslateExecutionTarget::Ready {
                    provider_id,
                    provider,
                } => {
                    let request = TranslateRequest {
                        text: text.to_string(),
                        source_lang: source_lang.to_string(),
                        target_lang: target_lang.to_string(),
                        timeout_ms: DEFAULT_TRANSLATE_TIMEOUT_MS,
                    };
                    match provider.translate(request).await {
                        Ok(translation) => ProviderTranslationData {
                            provider_id: provider_id.clone(),
                            translated_text: Some(translation.translated_text),
                            error: None,
                        },
                        Err(error) => ProviderTranslationData {
                            provider_id: provider_id.clone(),
                            translated_text: None,
                            error: Some(error),
                        },
                    }
                }
                TranslateExecutionTarget::BuildError { provider_id, error } => {
                    ProviderTranslationData {
                        provider_id: provider_id.clone(),
                        translated_text: None,
                        error: Some(error.clone()),
                    }
                }
            };
            results.push(result);
        }
        results
    }

    fn pick_translate_provider(
        &self,
        requested_provider_id: Option<&str>,
    ) -> Result<Arc<dyn TranslateProvider>, AppError> {
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

    pub(super) fn first_successful_translation(
        results: &[ProviderTranslationData],
    ) -> Option<&ProviderTranslationData> {
        results.iter().find(|item| item.error.is_none())
    }

    pub(super) fn first_translation_error(results: &[ProviderTranslationData]) -> AppError {
        results
            .iter()
            .find_map(|item| item.error.clone())
            .unwrap_or_else(|| {
                AppError::new(
                    ErrorCode::ProviderNetworkError,
                    "All translate providers failed without returning an explicit error",
                    true,
                )
            })
    }
}
