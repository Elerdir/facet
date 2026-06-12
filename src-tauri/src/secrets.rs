//! Secrets in the OS credential store (Windows Credential Manager / macOS
//! Keychain) via the `keyring` crate — tokens never live in settings.json.

use keyring::Entry;

const SERVICE: &str = "com.ladik.facet";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

/// Read a secret; returns null when it doesn't exist.
#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    match entry(&name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Store a secret; an empty value deletes it.
#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    let e = entry(&name)?;
    if value.is_empty() {
        match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        }
    } else {
        e.set_password(&value).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_get_delete_roundtrip() {
        let name = "facet-test-secret".to_string();
        secret_set(name.clone(), "tajemstvi".into()).unwrap();
        assert_eq!(secret_get(name.clone()).unwrap().as_deref(), Some("tajemstvi"));
        secret_set(name.clone(), "".into()).unwrap(); // empty deletes
        assert_eq!(secret_get(name).unwrap(), None);
    }
}
