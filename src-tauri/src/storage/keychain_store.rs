#![cfg_attr(test, allow(dead_code))]

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

#[cfg(test)]
use std::collections::{HashMap, HashSet};
#[cfg(test)]
use std::sync::Mutex;

#[cfg(not(test))]
pub struct KeychainStore {
    service_name: String,
}

#[cfg(test)]
pub struct KeychainStore {
    entries: Mutex<HashMap<String, String>>,
    failures: Mutex<KeychainFailures>,
}

#[cfg(test)]
#[derive(Default)]
struct KeychainFailures {
    set: HashSet<String>,
    delete: HashSet<String>,
}

impl KeychainStore {
    #[cfg(not(test))]
    pub fn new(service_name: impl Into<String>) -> Self {
        Self {
            service_name: service_name.into(),
        }
    }

    #[cfg(test)]
    pub fn new(_service_name: impl Into<String>) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            failures: Mutex::new(KeychainFailures::default()),
        }
    }

    #[cfg(not(test))]
    pub fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        let entry = keyring::Entry::new(&self.service_name, key).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to create keychain entry `{key}`: {error}"),
                false,
            )
        })?;
        entry.set_password(value).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to write keychain entry `{key}`: {error}"),
                false,
            )
        })
    }

    #[cfg(test)]
    pub fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        if self.should_fail_set(key) {
            return Err(AppError::new(
                ErrorCode::InternalError,
                format!("Injected keychain set failure for `{key}`"),
                false,
            ));
        }
        let mut entries = self.entries.lock().expect("keychain lock poisoned");
        entries.insert(key.to_string(), value.to_string());
        Ok(())
    }

    #[cfg(not(test))]
    pub fn get(&self, key: &str) -> Result<Option<String>, AppError> {
        let entry = keyring::Entry::new(&self.service_name, key).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to create keychain entry `{key}`: {error}"),
                false,
            )
        })?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(AppError::new(
                ErrorCode::InternalError,
                format!("Failed to read keychain entry `{key}`: {error}"),
                false,
            )),
        }
    }

    #[cfg(test)]
    pub fn get(&self, key: &str) -> Result<Option<String>, AppError> {
        let entries = self.entries.lock().expect("keychain lock poisoned");
        Ok(entries.get(key).cloned())
    }

    #[cfg(not(test))]
    pub fn delete(&self, key: &str) -> Result<(), AppError> {
        let entry = keyring::Entry::new(&self.service_name, key).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to create keychain entry `{key}`: {error}"),
                false,
            )
        })?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(AppError::new(
                ErrorCode::InternalError,
                format!("Failed to delete keychain entry `{key}`: {error}"),
                false,
            )),
        }
    }

    #[cfg(test)]
    pub fn delete(&self, key: &str) -> Result<(), AppError> {
        if self.should_fail_delete(key) {
            return Err(AppError::new(
                ErrorCode::InternalError,
                format!("Injected keychain delete failure for `{key}`"),
                false,
            ));
        }
        let mut entries = self.entries.lock().expect("keychain lock poisoned");
        entries.remove(key);
        Ok(())
    }

    #[cfg(test)]
    pub fn fail_on_set(&self, key: &str) {
        let mut failures = self
            .failures
            .lock()
            .expect("keychain failure lock poisoned");
        failures.set.insert(key.to_string());
    }

    #[cfg(test)]
    fn should_fail_set(&self, key: &str) -> bool {
        let failures = self
            .failures
            .lock()
            .expect("keychain failure lock poisoned");
        failures.set.contains(key)
    }

    #[cfg(test)]
    fn should_fail_delete(&self, key: &str) -> bool {
        let failures = self
            .failures
            .lock()
            .expect("keychain failure lock poisoned");
        failures.delete.contains(key)
    }
}
