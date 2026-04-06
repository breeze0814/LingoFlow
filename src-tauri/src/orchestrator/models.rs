use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig;
use crate::errors::app_error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCommandPayload {
    pub text: Option<String>,
    pub source_lang: Option<String>,
    pub source_lang_hint: Option<String>,
    pub target_lang: Option<String>,
    pub provider_id: Option<String>,
    pub ocr_provider_id: Option<String>,
    pub translate_provider_configs: Option<Vec<TranslateProviderRuntimeConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskType {
    SelectionTranslate,
    InputTranslate,
    OcrRecognize,
    OcrTranslate,
    OpenInputPanel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRequest {
    pub task_id: String,
    pub task_type: TaskType,
    pub text: Option<String>,
    pub source_lang: Option<String>,
    pub source_lang_hint: Option<String>,
    pub target_lang: Option<String>,
    pub translate_provider_id: Option<String>,
    pub ocr_provider_id: Option<String>,
    pub translate_provider_configs: Option<Vec<TranslateProviderRuntimeConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TranslateTaskOptions {
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
    pub provider_id: Option<String>,
    pub provider_configs: Option<Vec<TranslateProviderRuntimeConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OcrTranslateTaskOptions {
    pub source_lang: Option<String>,
    pub source_lang_hint: Option<String>,
    pub target_lang: Option<String>,
    pub provider_id: Option<String>,
    pub ocr_provider_id: Option<String>,
    pub provider_configs: Option<Vec<TranslateProviderRuntimeConfig>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Success,
    Failure,
    Cancelled,
    Accepted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTranslationData {
    pub provider_id: String,
    pub translated_text: Option<String>,
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskData {
    pub provider_id: String,
    pub source_text: String,
    pub translated_text: Option<String>,
    pub recognized_text: Option<String>,
    #[serde(default)]
    pub translation_results: Vec<ProviderTranslationData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_rect: Option<CaptureRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    pub ok: bool,
    pub task_id: String,
    pub status: TaskStatus,
    pub data: Option<TaskData>,
    pub error: Option<AppError>,
}

impl TaskRequest {
    pub fn selection(target_lang: Option<String>, provider_id: Option<String>) -> Self {
        Self::new(
            TaskType::SelectionTranslate,
            TaskRequestOptions {
                target_lang,
                translate_provider_id: provider_id,
                ..TaskRequestOptions::default()
            },
        )
    }

    pub fn input(text: Option<String>, options: TranslateTaskOptions) -> Self {
        Self::new(
            TaskType::InputTranslate,
            TaskRequestOptions {
                text,
                source_lang: options.source_lang,
                target_lang: options.target_lang,
                translate_provider_id: options.provider_id,
                translate_provider_configs: options.provider_configs,
                ..TaskRequestOptions::default()
            },
        )
    }

    pub fn ocr_recognize(source_lang_hint: Option<String>, provider_id: Option<String>) -> Self {
        Self::new(
            TaskType::OcrRecognize,
            TaskRequestOptions {
                source_lang_hint,
                ocr_provider_id: provider_id,
                ..TaskRequestOptions::default()
            },
        )
    }

    pub fn ocr_translate(options: OcrTranslateTaskOptions) -> Self {
        Self::new(
            TaskType::OcrTranslate,
            TaskRequestOptions {
                source_lang: options.source_lang,
                source_lang_hint: options.source_lang_hint,
                target_lang: options.target_lang,
                translate_provider_id: options.provider_id,
                ocr_provider_id: options.ocr_provider_id,
                translate_provider_configs: options.provider_configs,
                ..TaskRequestOptions::default()
            },
        )
    }

    fn new(task_type: TaskType, options: TaskRequestOptions) -> Self {
        Self {
            task_id: Uuid::new_v4().to_string(),
            task_type,
            text: options.text,
            source_lang: options.source_lang,
            source_lang_hint: options.source_lang_hint,
            target_lang: options.target_lang,
            translate_provider_id: options.translate_provider_id,
            ocr_provider_id: options.ocr_provider_id,
            translate_provider_configs: options.translate_provider_configs,
        }
    }
}

#[derive(Debug, Default)]
struct TaskRequestOptions {
    text: Option<String>,
    source_lang: Option<String>,
    source_lang_hint: Option<String>,
    target_lang: Option<String>,
    translate_provider_id: Option<String>,
    ocr_provider_id: Option<String>,
    translate_provider_configs: Option<Vec<TranslateProviderRuntimeConfig>>,
}
