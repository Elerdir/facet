//! Transport for Language Server Protocol servers: spawns a server as a child
//! process and relays its stdout to the frontend (base64 chunks over Tauri
//! events), and the frontend's messages to its stdin. The protocol framing and
//! all LSP logic live on the frontend (in tested pure modules); this module is
//! just a pipe.

use base64::Engine;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, serde::Serialize)]
struct LspData {
    id: String,
    data: String,
}

/// Running language servers, keyed by a frontend-chosen id (one per serverId).
#[derive(Default)]
pub struct LspProcesses(pub Mutex<HashMap<String, Child>>);

#[tauri::command]
pub fn lsp_start(
    app: AppHandle,
    state: State<LspProcesses>,
    id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
) -> Result<(), String> {
    if state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .contains_key(&id)
    {
        return Ok(()); // already running
    }

    let mut child = Command::new(&command)
        .args(&args)
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Nelze spustit jazykový server '{command}': {e}"))?;

    let stdout = child.stdout.take().ok_or("Server nemá stdout")?;
    let app_clone = app.clone();
    let id_clone = id.clone();
    std::thread::spawn(move || {
        let mut reader = stdout;
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => {
                    let _ = app_clone.emit("lsp:exit", id_clone.clone());
                    break;
                }
                Ok(n) => {
                    let data = base64::engine::general_purpose::STANDARD.encode(&buffer[..n]);
                    let _ = app_clone.emit(
                        "lsp:data",
                        LspData {
                            id: id_clone.clone(),
                            data,
                        },
                    );
                }
            }
        }
    });

    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, child);
    Ok(())
}

#[tauri::command]
pub fn lsp_send(state: State<LspProcesses>, id: String, data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| e.to_string())?;
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    let child = map.get_mut(&id).ok_or("Server neběží")?;
    let stdin = child.stdin.as_mut().ok_or("Server nemá stdin")?;
    stdin.write_all(&bytes).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lsp_stop(state: State<LspProcesses>, id: String) -> Result<(), String> {
    if let Some(mut child) = state.0.lock().map_err(|e| e.to_string())?.remove(&id) {
        let _ = child.kill();
    }
    Ok(())
}
