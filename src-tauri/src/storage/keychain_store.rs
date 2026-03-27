use std::collections::HashMap;
use std::sync::Mutex;

pub struct KeychainStore {
    entries: Mutex<HashMap<String, String>>,
}

impl KeychainStore {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }

    #[allow(dead_code)]
    pub fn set(&self, key: &str, value: &str) {
        let mut entries = self.entries.lock().expect("keychain lock poisoned");
        entries.insert(key.to_string(), value.to_string());
    }

    #[allow(dead_code)]
    pub fn get(&self, key: &str) -> Option<String> {
        let entries = self.entries.lock().expect("keychain lock poisoned");
        entries.get(key).cloned()
    }
}
