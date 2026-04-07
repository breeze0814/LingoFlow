use std::time::{SystemTime, UNIX_EPOCH};

use aes::Aes128;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use serde::Deserialize;

use crate::apiprovider::http_error::invalid_response_error;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

type Aes128CbcDec = cbc::Decryptor<Aes128>;

const PROVIDER_LABEL: &str = "Youdao Web";

#[derive(Deserialize)]
pub(crate) struct YoudaoWebKeyResponse {
    pub code: i32,
    pub msg: Option<String>,
    pub data: Option<YoudaoWebKeyData>,
}

#[derive(Deserialize)]
pub(crate) struct YoudaoWebKeyData {
    #[serde(rename = "secretKey")]
    pub secret_key: String,
    #[serde(rename = "aesKey")]
    pub aes_key: String,
    #[serde(rename = "aesIv")]
    pub aes_iv: String,
}

#[derive(Deserialize)]
pub(crate) struct YoudaoWebTranslateResponse {
    pub code: i32,
    pub msg: Option<String>,
    #[serde(rename = "translateResult")]
    pub translate_result: Option<Vec<Vec<YoudaoWebTranslationItem>>>,
}

#[derive(Deserialize)]
pub(crate) struct YoudaoWebTranslationItem {
    #[serde(rename = "src")]
    pub _src: String,
    pub tgt: String,
}

pub(crate) fn current_millis_string() -> Result<String, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::new(ErrorCode::InternalError, error.to_string(), false))?;
    Ok(now.as_millis().to_string())
}

pub(crate) fn generate_sign(client: &str, product: &str, timestamp: &str, key: &str) -> String {
    let raw = format!("client={client}&mysticTime={timestamp}&product={product}&key={key}");
    format!("{:x}", md5::compute(raw))
}

pub(crate) fn decrypt_payload(
    encrypted_payload: &str,
    aes_key: &str,
    aes_iv: &str,
) -> Result<String, AppError> {
    let normalized = normalize_urlsafe_base64(encrypted_payload.trim());
    let cipher_data = BASE64_STANDARD
        .decode(normalized)
        .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
    let key_hash = md5::compute(aes_key.as_bytes());
    let iv_hash = md5::compute(aes_iv.as_bytes());
    let decryptor = Aes128CbcDec::new_from_slices(&key_hash.0, &iv_hash.0).map_err(|error| {
        invalid_response_error(PROVIDER_LABEL, format!("invalid cipher params: {error}"))
    })?;
    let mut buffer = cipher_data;
    let decrypted = decryptor
        .decrypt_padded_mut::<Pkcs7>(&mut buffer)
        .map_err(|error| {
            invalid_response_error(PROVIDER_LABEL, format!("decrypt failed: {error}"))
        })?;
    String::from_utf8(decrypted.to_vec())
        .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
}

pub(crate) fn flatten_translated_text(
    grouped: Option<Vec<Vec<YoudaoWebTranslationItem>>>,
) -> Result<String, AppError> {
    let groups = grouped.ok_or_else(|| {
        invalid_response_error(PROVIDER_LABEL, "missing translateResult in response")
    })?;
    let mut lines: Vec<String> = Vec::new();
    for group in groups {
        let line = group
            .into_iter()
            .map(|item| item.tgt.trim().to_string())
            .collect::<Vec<String>>()
            .join("");
        if !line.is_empty() {
            lines.push(line);
        }
    }
    if lines.is_empty() {
        return Err(invalid_response_error(
            PROVIDER_LABEL,
            "translated text is empty",
        ));
    }
    Ok(lines.join("\n"))
}

pub(crate) fn source_lang_to_youdao(source_lang: &str) -> String {
    let normalized = source_lang.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized == "auto" {
        return "auto".to_string();
    }
    map_app_to_youdao_lang(&normalized)
}

pub(crate) fn target_lang_to_youdao(target_lang: &str) -> Result<String, AppError> {
    let normalized = target_lang.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized == "auto" {
        return Err(AppError::new(
            ErrorCode::InternalError,
            "Youdao target language cannot be auto",
            false,
        ));
    }
    Ok(map_app_to_youdao_lang(&normalized))
}

fn normalize_urlsafe_base64(input: &str) -> String {
    let mut value = input.replace('-', "+").replace('_', "/");
    let padding = value.len() % 4;
    if padding != 0 {
        value.push_str(&"=".repeat(4 - padding));
    }
    value
}

fn map_app_to_youdao_lang(lang: &str) -> String {
    match lang {
        "zh" | "zh-cn" => "zh-CHS".to_string(),
        "zh-tw" | "zh-hk" => "zh-CHT".to_string(),
        "en" => "en".to_string(),
        "ja" => "ja".to_string(),
        "ko" => "ko".to_string(),
        "fr" => "fr".to_string(),
        "es" => "es".to_string(),
        "pt" => "pt".to_string(),
        "it" => "it".to_string(),
        "de" => "de".to_string(),
        "ru" => "ru".to_string(),
        "ar" => "ar".to_string(),
        "th" => "th".to_string(),
        "nl" => "nl".to_string(),
        "id" => "id".to_string(),
        "vi" => "vi".to_string(),
        other => other.to_string(),
    }
}
