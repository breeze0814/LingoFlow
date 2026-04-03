use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const ALGORITHM: &str = "TC3-HMAC-SHA256";
const SERVICE: &str = "tmt";
const REQUEST_SCOPE_SUFFIX: &str = "tc3_request";
const SIGNED_HEADERS: &str = "content-type;host;x-tc-action";
const CONTENT_TYPE_VALUE: &str = "application/json; charset=utf-8";

#[derive(Clone)]
pub struct TencentTmtSigner {
    secret_id: String,
    secret_key: String,
    host: String,
}

impl TencentTmtSigner {
    pub fn new(secret_id: String, secret_key: String, host: String) -> Self {
        Self {
            secret_id,
            secret_key,
            host,
        }
    }

    pub fn build_authorization(
        &self,
        action: &str,
        timestamp: i64,
        date: &str,
        payload: &str,
    ) -> Result<String, AppError> {
        let action_lower = action.to_ascii_lowercase();
        let credential_scope = format!("{date}/{SERVICE}/{REQUEST_SCOPE_SUFFIX}");
        let canonical_request = self.build_canonical_request(&action_lower, payload);
        let string_to_sign =
            build_string_to_sign(timestamp, &credential_scope, canonical_request.as_bytes());
        let signing_key = self.build_signing_key(date)?;
        let signature = hmac_sha256_hex(&signing_key, string_to_sign.as_bytes())?;
        Ok(format!(
            "{ALGORITHM} Credential={}/{credential_scope}, SignedHeaders={SIGNED_HEADERS}, Signature={signature}",
            self.secret_id
        ))
    }

    fn build_canonical_request(&self, action_lower: &str, payload: &str) -> String {
        let canonical_headers = format!(
            "content-type:{CONTENT_TYPE_VALUE}\nhost:{}\nx-tc-action:{action_lower}\n",
            self.host
        );
        let payload_hash = sha256_hex(payload.as_bytes());
        format!("POST\n/\n\n{canonical_headers}\n{SIGNED_HEADERS}\n{payload_hash}")
    }

    fn build_signing_key(&self, date: &str) -> Result<Vec<u8>, AppError> {
        let secret_date = hmac_sha256(
            format!("TC3{}", self.secret_key).as_bytes(),
            date.as_bytes(),
        )?;
        let secret_service = hmac_sha256(&secret_date, SERVICE.as_bytes())?;
        hmac_sha256(&secret_service, REQUEST_SCOPE_SUFFIX.as_bytes())
    }
}

fn build_string_to_sign(
    timestamp: i64,
    credential_scope: &str,
    canonical_request: &[u8],
) -> String {
    let canonical_request_hash = sha256_hex(canonical_request);
    format!("{ALGORITHM}\n{timestamp}\n{credential_scope}\n{canonical_request_hash}")
}

fn sha256_hex(input: &[u8]) -> String {
    let digest = Sha256::digest(input);
    hex::encode(digest)
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Tencent signer init failed: {error}"),
            false,
        )
    })?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hmac_sha256_hex(key: &[u8], data: &[u8]) -> Result<String, AppError> {
    let signed = hmac_sha256(key, data)?;
    Ok(hex::encode(signed))
}
