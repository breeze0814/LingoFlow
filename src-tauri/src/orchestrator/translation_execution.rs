use std::sync::Arc;

use tokio::task::JoinHandle;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{ProviderTranslationData, TaskData, TaskRequest, TaskResponse};
use crate::orchestrator::service::{Orchestrator, DEFAULT_TRANSLATE_TIMEOUT_MS};
use crate::providers::runtime_translate_factory::TranslateExecutionTarget;
use crate::providers::traits::TranslateRequest;

/// Context for translation operations
struct TranslationContext {
    request: TaskRequest,
    task_id: String,
    text: String,
}

/// Context for provider translation
pub(super) struct ProviderTranslationContext<'a> {
    pub providers: &'a [TranslateExecutionTarget],
    pub text: &'a str,
    pub source_lang: &'a str,
    pub target_lang: &'a str,
}

/// Context for spawning translation task
struct TranslationTaskContext<'a> {
    provider: &'a Arc<dyn crate::providers::traits::TranslateProvider>,
    text: String,
    source_lang: String,
    target_lang: String,
    timeout_ms: u64,
    index: usize,
}

struct PendingTranslationTask {
    index: usize,
    provider_id: String,
    handle: JoinHandle<ProviderTranslationData>,
}

impl Orchestrator {
    pub(super) async fn handle_input_translate(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let text = request.text.clone().unwrap_or_default();
        self.translate_text(TranslationContext {
            request,
            task_id,
            text,
        })
        .await
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
        self.translate_text(TranslationContext {
            request,
            task_id,
            text,
        })
        .await
    }

    async fn translate_text(
        &self,
        ctx: TranslationContext,
    ) -> Result<TaskResponse, AppError> {
        if ctx.text.trim().is_empty() {
            return Ok(Self::failed(
                ctx.task_id,
                AppError::new(ErrorCode::EmptyInput, "Input text is empty", false),
            ));
        }

        let source_lang = ctx
            .request
            .source_lang
            .unwrap_or_else(|| self.config_store.get().app.source_lang);
        let target_lang = ctx
            .request
            .target_lang
            .unwrap_or_else(|| self.config_store.get().app.target_lang);
        let providers = match self.pick_translate_providers(
            ctx.request.translate_provider_id.as_deref(),
            ctx.request.translate_provider_configs.as_deref(),
        ) {
            Ok(providers) => providers,
            Err(error) => return Ok(Self::failed(ctx.task_id, error)),
        };
        let translation_results = self
            .translate_with_providers(ProviderTranslationContext {
                providers: &providers,
                text: &ctx.text,
                source_lang: &source_lang,
                target_lang: &target_lang,
            })
            .await;
        let Some(primary_result) = Self::first_successful_translation(&translation_results) else {
            return Ok(Self::failed(
                ctx.task_id,
                Self::first_translation_error(&translation_results),
            ));
        };

        Ok(Self::success(
            ctx.task_id,
            TaskData {
                provider_id: primary_result.provider_id.clone(),
                source_text: ctx.text,
                translated_text: primary_result.translated_text.clone(),
                recognized_text: None,
                translation_results,
                capture_rect: None,
            },
        ))
    }

    pub(super) async fn translate_with_providers(
        &self,
        ctx: ProviderTranslationContext<'_>,
    ) -> Vec<ProviderTranslationData> {
        let mut results = (0..ctx.providers.len())
            .map(|_| None)
            .collect::<Vec<Option<ProviderTranslationData>>>();
        let mut pending = Vec::new();

        for (index, target) in ctx.providers.iter().enumerate() {
            match target {
                TranslateExecutionTarget::Ready {
                    provider_id: _,
                    provider,
                } => pending.push(Self::spawn_translate_provider_task(TranslationTaskContext {
                    provider,
                    text: ctx.text.to_string(),
                    source_lang: ctx.source_lang.to_string(),
                    target_lang: ctx.target_lang.to_string(),
                    timeout_ms: DEFAULT_TRANSLATE_TIMEOUT_MS,
                    index,
                })),
                TranslateExecutionTarget::BuildError { provider_id, error } => {
                    results[index] = Some(Self::build_provider_error_result(provider_id, error));
                }
            }
        }

        for task in pending {
            let index = task.index;
            results[index] = Some(Self::await_translate_provider_task(task).await);
        }

        results.into_iter().flatten().collect()
    }

    fn build_provider_error_result(provider_id: &str, error: &AppError) -> ProviderTranslationData {
        ProviderTranslationData {
            provider_id: provider_id.to_string(),
            translated_text: None,
            error: Some(error.clone()),
        }
    }

    fn spawn_translate_provider_task(
        ctx: TranslationTaskContext<'_>,
    ) -> PendingTranslationTask {
        let provider_id = ctx.provider.provider_id().to_string();
        let request = TranslateRequest {
            text: ctx.text,
            source_lang: ctx.source_lang,
            target_lang: ctx.target_lang,
            timeout_ms: ctx.timeout_ms,
        };
        let provider = ctx.provider.clone();
        let handle = tokio::spawn(Self::run_translate_provider_task(
            provider_id.clone(),
            provider,
            request,
        ));
        PendingTranslationTask {
            index: ctx.index,
            provider_id,
            handle,
        }
    }

    async fn await_translate_provider_task(task: PendingTranslationTask) -> ProviderTranslationData {
        match task.handle.await {
            Ok(result) => result,
            Err(error) => ProviderTranslationData {
                provider_id: task.provider_id,
                translated_text: None,
                error: Some(AppError::new(
                    ErrorCode::InternalError,
                    format!("Translate provider task failed: {error}"),
                    true,
                )),
            },
        }
    }

    async fn run_translate_provider_task(
        provider_id: String,
        provider: Arc<dyn crate::providers::traits::TranslateProvider>,
        request: TranslateRequest,
    ) -> ProviderTranslationData {
        match provider.translate(request).await {
            Ok(translation) => ProviderTranslationData {
                provider_id,
                translated_text: Some(translation.translated_text),
                error: None,
            },
            Err(error) => ProviderTranslationData {
                provider_id,
                translated_text: None,
                error: Some(error),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    use crate::errors::app_error::AppError;
    use crate::orchestrator::service::Orchestrator;
    use crate::orchestrator::translation_execution::ProviderTranslationContext;
    use crate::providers::registry::ProviderRegistry;
    use crate::providers::runtime_translate_factory::TranslateExecutionTarget;
    use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};
    use crate::storage::config_store::ConfigStore;

    struct SlowTranslateProvider {
        provider_id: &'static str,
        delay: Duration,
    }

    #[async_trait::async_trait]
    impl TranslateProvider for SlowTranslateProvider {
        async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
            std::thread::sleep(self.delay);
            Ok(TranslateResult {
                translated_text: format!("{}:{}", self.provider_id, req.text),
            })
        }

        fn provider_id(&self) -> &'static str {
            self.provider_id
        }
    }

    fn make_orchestrator() -> Orchestrator {
        Orchestrator::new(
            Arc::new(ConfigStore::new_default()),
            Arc::new(ProviderRegistry::new()),
        )
    }

    fn make_target(provider_id: &'static str) -> TranslateExecutionTarget {
        TranslateExecutionTarget::Ready {
            provider_id: provider_id.to_string(),
            provider: Arc::new(SlowTranslateProvider {
                provider_id,
                delay: Duration::from_millis(120),
            }),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 3)]
    async fn translate_with_providers_runs_concurrently_and_keeps_order() {
        let orchestrator = make_orchestrator();
        let providers = vec![
            make_target("provider_a"),
            make_target("provider_b"),
            make_target("provider_c"),
        ];

        let started_at = Instant::now();
        let results = orchestrator
            .translate_with_providers(ProviderTranslationContext {
                providers: &providers,
                text: "hello",
                source_lang: "en",
                target_lang: "zh-CN",
            })
            .await;
        let elapsed = started_at.elapsed();

        assert_eq!(
            results
                .iter()
                .map(|item| item.provider_id.as_str())
                .collect::<Vec<_>>(),
            vec!["provider_a", "provider_b", "provider_c"]
        );
        assert!(
            elapsed < Duration::from_millis(220),
            "expected concurrent execution, got {:?}",
            elapsed
        );
    }
}
