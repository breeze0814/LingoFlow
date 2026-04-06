use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateProviderRuntimeConfig {
    pub id: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub region: Option<String>,
    pub secret_id: Option<String>,
    pub secret_key: Option<String>,
    pub app_id: Option<String>,
    pub app_secret: Option<String>,
}

impl TranslateProviderRuntimeConfig {
    #[cfg(test)]
    pub fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            api_key: None,
            base_url: None,
            region: None,
            secret_id: None,
            secret_key: None,
            app_id: None,
            app_secret: None,
        }
    }
}
