use std::sync::RwLock;

use serde::{Deserialize, Serialize};

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

impl ConfigStore {
    pub fn new_default() -> Self {
        Self {
            config: RwLock::new(Config::default()),
        }
    }

    pub fn get(&self) -> Config {
        self.config.read().expect("config lock poisoned").clone()
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
            .expect("config lock poisoned")
            .http_api
            .enabled
    }

    pub fn set_http_api_enabled(&self, enabled: bool) {
        self.config
            .write()
            .expect("config lock poisoned")
            .http_api
            .enabled = enabled;
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
