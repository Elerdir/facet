//! File-system watcher: watches the opened folder recursively and forwards
//! change events to the frontend (`fs:change` with the affected paths). The
//! frontend debounces and decides what to do (reload clean buffers, refresh
//! git status). Noisy directories are filtered here to avoid event storms.

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// The single active watcher; replaced (and thereby dropped) on folder change.
#[derive(Default)]
pub struct FsWatcher(pub Mutex<Option<RecommendedWatcher>>);

/// Paths whose churn should never reach the frontend.
pub fn is_noise(path: &str) -> bool {
    let p = path.replace('\\', "/");
    ["/.git/", "/node_modules/", "/target/", "/dist/", "/.svelte-kit/"]
        .iter()
        .any(|seg| p.contains(seg))
}

#[tauri::command]
pub fn watch_folder(app: AppHandle, state: State<FsWatcher>, root: String) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| format!("Nelze sledovat složku: {e}"))?;

    std::thread::spawn(move || {
        for res in rx {
            if let Ok(event) = res {
                let paths: Vec<String> = event
                    .paths
                    .iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .filter(|p| !is_noise(p))
                    .collect();
                if !paths.is_empty() {
                    let _ = app.emit("fs:change", paths);
                }
            }
        }
        // Channel closed (watcher dropped) -> thread ends.
    });

    // Dropping the previous watcher closes its channel and stops its thread.
    *state.0.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noise_filter_skips_heavy_directories() {
        assert!(is_noise("E:\\proj\\.git\\index"));
        assert!(is_noise("/proj/node_modules/dep/index.js"));
        assert!(is_noise("/proj/target/debug/foo"));
        assert!(!is_noise("/proj/src/main.rs"));
        assert!(!is_noise("E:\\proj\\README.md"));
    }
}
