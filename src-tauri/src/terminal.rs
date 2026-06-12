//! Integrated terminal: real PTY sessions (ConPTY on Windows via portable-pty).
//! The frontend renders with xterm.js; this module is just the pipe — spawn a
//! shell, relay its output as `term:data` events, write input back to it.

use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct TermHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct Terminals(pub Mutex<HashMap<String, TermHandle>>);

#[derive(Clone, serde::Serialize)]
struct TermData {
    id: String,
    data: String,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

#[tauri::command]
pub fn term_start(
    app: AppHandle,
    state: State<Terminals>,
    id: String,
    shell: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .contains_key(&id)
    {
        return Ok(());
    }

    let pty = native_pty_system();
    let pair = pty.openpty(size(cols, rows)).map_err(|e| e.to_string())?;

    let program = if cfg!(windows) {
        if shell == "cmd" {
            "cmd.exe"
        } else {
            "powershell.exe"
        }
    } else {
        "/bin/bash"
    };
    let mut cmd = CommandBuilder::new(program);
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Nelze spustit shell: {e}"))?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let id_clone = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    let _ = app_clone.emit("term:exit", id_clone.clone());
                    break;
                }
                Ok(n) => {
                    let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app_clone.emit(
                        "term:data",
                        TermData {
                            id: id_clone.clone(),
                            data,
                        },
                    );
                }
            }
        }
    });

    state.0.lock().map_err(|e| e.to_string())?.insert(
        id,
        TermHandle {
            writer,
            master: pair.master,
            child,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn term_write(state: State<Terminals>, id: String, data: String) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    let handle = map.get_mut(&id).ok_or("Terminál neběží")?;
    handle
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    handle.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn term_resize(state: State<Terminals>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let map = state.0.lock().map_err(|e| e.to_string())?;
    let handle = map.get(&id).ok_or("Terminál neběží")?;
    handle.master.resize(size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn term_kill(state: State<Terminals>, id: String) -> Result<(), String> {
    if let Some(mut handle) = state.0.lock().map_err(|e| e.to_string())?.remove(&id) {
        let _ = handle.child.kill();
    }
    Ok(())
}
