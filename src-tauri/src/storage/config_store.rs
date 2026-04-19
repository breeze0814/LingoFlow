use serde::{Deserialize, Serialize};
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpApiConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub version: u32,
    pub app: AppConfig,
    pub http_api: HttpApiConfig,
}

#[derive(Debug, Clone)]
pub struct HttpServerOptions {
    pub host: String,
    pub port: u16,
}

pub struct ConfigStore {
    config: RwLock<Config>,
}

#[cfg_attr(test, allow(dead_code))]
impl ConfigStore {
    pub fn new_default() -> Self {
        Self {
            config: RwLock::new(Config::default()),
        }
    }

    pub fn get(&self) -> Config {
        self.config
            .read()
            .unwrap_or_else(|poisoned| {
                tracing::error!("ConfigStore lock poisoned, returning default config");
                poisoned.into_inner()
            })
            .clone()
    }

    pub fn http_server_options(&self) -> HttpServerOptions {
        let config = self.get();
        HttpServerOptions {
            host: config.http_api.host,
            port: config.http_api.port,
        }
    }

    pub fn http_api_enabled(&self) -> bool {
        self.config
            .read()
            .unwrap_or_else(|poisoned| {
                tracing::error!("ConfigStore lock poisoned, returning default config");
                poisoned.into_inner()
            })
            .http_api
            .enabled
    }

    pub fn set_app_languages(&self, source_lang: String, target_lang: String) {
        match self.config.write() {
            Ok(mut config) => {
                config.app.source_lang = source_lang;
                config.app.target_lang = target_lang;
            }
            Err(poisoned) => {
                tracing::error!("ConfigStore lock poisoned during set_app_languages, recovering");
                let mut config = poisoned.into_inner();
                config.app.source_lang = source_lang;
                config.app.target_lang = target_lang;
            }
        }
    }

    pub fn set_http_api_enabled(&self, enabled: bool) {
        match self.config.write() {
            Ok(mut config) => {
                config.http_api.enabled = enabled;
            }
            Err(poisoned) => {
                tracing::error!(
                    "ConfigStore lock poisoned during set_http_api_enabled, recovering"
                );
                poisoned.into_inner().http_api.enabled = enabled;
            }
        }
    }

    pub fn set_http_api_port(&self, port: u16) {
        match self.config.write() {
            Ok(mut config) => {
                config.http_api.port = port;
            }
            Err(poisoned) => {
                tracing::error!("ConfigStore lock poisoned during set_http_api_port, recovering");
                poisoned.into_inner().http_api.port = port;
            }
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 1,
            app: AppConfig {
                source_lang: "auto".to_string(),
                target_lang: "zh-CN".to_string(),
            },
            http_api: HttpApiConfig {
                enabled: true,
                host: "127.0.0.1".to_string(),
                port: 61928,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ConfigStore;

    #[test]
    fn updates_app_languages() {
        let store = ConfigStore::new_default();

        store.set_app_languages("en".to_string(), "ja".to_string());

        let config = store.get();
        assert_eq!(config.app.source_lang, "en");
        assert_eq!(config.app.target_lang, "ja");
    }

    #[test]
    fn updates_http_api_enabled() {
        let store = ConfigStore::new_default();

        store.set_http_api_enabled(false);

        let config = store.get();
        assert!(!config.http_api.enabled);
    }

    #[test]
    fn updates_http_api_port() {
        let store = ConfigStore::new_default();

        store.set_http_api_port(62000);

        let config = store.get();
        assert_eq!(config.http_api.port, 62000);
    }
}
