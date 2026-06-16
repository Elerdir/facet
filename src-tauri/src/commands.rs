use crate::detect;
use base64::Engine;
use ignore::WalkBuilder;
use regex::RegexBuilder;
use std::fs;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::process::{Command, Stdio};

/// One entry in a directory listing. Serialized as camelCase so it maps
/// directly onto the frontend `TreeEntry` type.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// Metadata used to decide how to open a file (text vs hex, large vs small).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    size: u64,
    binary: bool,
    encoding: String,
}

/// Read a text file, decoding from its detected encoding (UTF-8, UTF-16, common
/// legacy encodings). Lossy rather than failing on undecodable bytes.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Nelze přečíst soubor: {e}"))?;
    Ok(detect::decode(&bytes).0)
}

/// Write a text file to disk, overwriting any existing content. `encoding`
/// (e.g. "utf-16le", "windows-1250") re-encodes the text; default is UTF-8.
#[tauri::command]
pub fn write_text_file(
    path: String,
    contents: String,
    encoding: Option<String>,
) -> Result<(), String> {
    let bytes = match encoding.as_deref() {
        None => contents.into_bytes(),
        Some(label) => detect::encode_text(&contents, label)?,
    };
    fs::write(&path, bytes).map_err(|e| format!("Nelze uložit soubor: {e}"))
}

/// Inspect a file without loading all of it: size, binary flag and encoding,
/// derived from at most an 8 KiB sample.
#[tauri::command]
pub fn file_info(path: String) -> Result<FileInfo, String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("Nelze získat informace: {e}"))?;
    let size = metadata.len();

    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let cap = size.min(8192) as usize;
    let mut sample = vec![0u8; cap];
    let read = file.read(&mut sample).map_err(|e| e.to_string())?;
    sample.truncate(read);

    let binary = detect::is_binary(&sample);
    let encoding = if binary {
        "binary".to_string()
    } else {
        detect::encoding_name(&sample)
    };
    Ok(FileInfo {
        size,
        binary,
        encoding,
    })
}

/// Create an empty file. Fails if a file or folder already exists at the path.
#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        return Err("Soubor nebo složka už existuje".into());
    }
    fs::write(&path, b"").map_err(|e| format!("Nelze vytvořit soubor: {e}"))
}

/// Create a directory (and any missing parents).
#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Nelze vytvořit složku: {e}"))
}

/// Rename or move a file/folder. Fails if the target already exists.
#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    if std::path::Path::new(&to).exists() {
        return Err("Cíl už existuje".into());
    }
    fs::rename(&from, &to).map_err(|e| format!("Nelze přejmenovat: {e}"))
}

/// Move a file/folder to the OS recycle bin (recoverable, not a hard delete).
#[tauri::command]
pub fn trash_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Nelze přesunout do koše: {e}"))
}

/// Read a window of raw bytes from a file (for the hex view), returned as
/// base64. Lets the UI page through huge files without loading them whole.
#[tauri::command]
pub fn read_file_chunk(path: String, offset: u64, length: usize) -> Result<String, String> {
    let mut file = File::open(&path).map_err(|e| format!("Nelze otevřít soubor: {e}"))?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; length];
    let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(read);
    Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
}

/// List one directory level (non-recursive). The frontend lazily requests
/// deeper levels as folders are expanded.
#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let read = fs::read_dir(&path).map_err(|e| format!("Nelze číst složku: {e}"))?;
    for item in read {
        let item = item.map_err(|e| e.to_string())?;
        let file_type = item.file_type().map_err(|e| e.to_string())?;
        entries.push(DirEntry {
            name: item.file_name().to_string_lossy().into_owned(),
            path: item.path().to_string_lossy().into_owned(),
            is_dir: file_type.is_dir(),
        });
    }
    Ok(entries)
}

/// Run an external tool, piping `content` to its stdin and returning stdout.
/// Used for formatters / import organizers (rustfmt, gofmt, black, ruff …).
#[tauri::command]
pub fn run_command_stdio(
    program: String,
    args: Vec<String>,
    content: String,
) -> Result<String, String> {
    let mut child = Command::new(&program)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Nelze spustit '{program}': {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        // stdin dropped here -> EOF for the child.
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Recursively list file paths under `root` (for fuzzy quick-open), skipping
/// heavy / hidden directories and capping the result at `limit`.
#[tauri::command]
pub fn list_files(root: String, limit: usize) -> Result<Vec<String>, String> {
    const SKIP: [&str; 5] = [".git", "node_modules", "target", "dist", ".svelte-kit"];
    let mut out = Vec::new();
    let mut stack = vec![std::path::PathBuf::from(&root)];

    while let Some(dir) = stack.pop() {
        if out.len() >= limit {
            break;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let name = entry.file_name().to_string_lossy().into_owned();
            if file_type.is_dir() {
                if SKIP.contains(&name.as_str()) || name.starts_with('.') {
                    continue;
                }
                stack.push(entry.path());
            } else if file_type.is_file() {
                out.push(entry.path().to_string_lossy().into_owned());
                if out.len() >= limit {
                    break;
                }
            }
        }
    }
    Ok(out)
}

/// A project file's text content (for codebase indexing).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileContent {
    path: String,
    content: String,
}

/// Read text files under `root` (respects .gitignore, skips binaries), capped
/// at `max_files` and `max_bytes` per file. Paths are relative to `root`.
#[tauri::command]
pub fn read_project_files(
    root: String,
    max_files: usize,
    max_bytes: usize,
) -> Result<Vec<ProjectFileContent>, String> {
    let mut out = Vec::new();
    for entry in WalkBuilder::new(&root).require_git(false).build() {
        if out.len() >= max_files {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        match path.metadata() {
            Ok(m) if (m.len() as usize) <= max_bytes => {}
            _ => continue,
        }
        let bytes = match fs::read(path) {
            Ok(b) => b,
            Err(_) => continue,
        };
        if detect::is_binary(&bytes) {
            continue;
        }
        let rel = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        out.push(ProjectFileContent {
            path: rel,
            content: String::from_utf8_lossy(&bytes).into_owned(),
        });
    }
    Ok(out)
}

/// One matching line from a project-wide search.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    path: String,
    line: u32,
    text: String,
}

/// Case-insensitive literal search across a folder, respecting .gitignore and
/// skipping binary files. The query is matched literally (regex-escaped).
#[tauri::command]
pub fn search_in_files(
    root: String,
    query: String,
    max_results: usize,
) -> Result<Vec<SearchMatch>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let re = RegexBuilder::new(&regex::escape(&query))
        .case_insensitive(true)
        .build()
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for entry in WalkBuilder::new(&root).require_git(false).build() {
        if out.len() >= max_results {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let bytes = match fs::read(entry.path()) {
            Ok(b) => b,
            Err(_) => continue,
        };
        if detect::is_binary(&bytes[..bytes.len().min(8192)]) {
            continue;
        }
        let text = String::from_utf8_lossy(&bytes);
        let path = entry.path().to_string_lossy().into_owned();
        for (i, line) in text.lines().enumerate() {
            if re.is_match(line) {
                out.push(SearchMatch {
                    path: path.clone(),
                    line: (i as u32) + 1,
                    text: line.chars().take(400).collect(),
                });
                if out.len() >= max_results {
                    break;
                }
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn read_project_files_skips_binary_and_large_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.ts"), "const x = 1;").unwrap();
        fs::write(dir.path().join("big.txt"), "x".repeat(5000)).unwrap();
        fs::write(dir.path().join("c.bin"), [0u8, 1, 2, 3]).unwrap();

        let files =
            read_project_files(dir.path().to_string_lossy().into(), 100, 1000).unwrap();
        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"a.ts"));
        assert!(!paths.contains(&"big.txt")); // too large
        assert!(!paths.contains(&"c.bin")); // binary
        assert_eq!(files.iter().find(|f| f.path == "a.ts").unwrap().content, "const x = 1;");
    }

    #[test]
    fn run_command_stdio_errors_on_missing_program() {
        let result = run_command_stdio(
            "facet_no_such_program_xyz".into(),
            vec![],
            "x".into(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.txt").to_string_lossy().into_owned();
        write_text_file(path.clone(), "ahoj světe".into(), None).unwrap();
        assert_eq!(read_text_file(path).unwrap(), "ahoj světe");
    }

    #[test]
    fn write_with_encoding_roundtrips_via_detection() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("u16.txt").to_string_lossy().into_owned();
        write_text_file(path.clone(), "Příliš žluťoučký".into(), Some("utf-16le".into()))
            .unwrap();
        assert_eq!(read_text_file(path).unwrap(), "Příliš žluťoučký");
    }

    #[test]
    fn read_text_file_missing_errors() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nope.txt").to_string_lossy().into_owned();
        assert!(read_text_file(path).is_err());
    }

    #[test]
    fn read_dir_lists_files_and_directories() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "x").unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();

        let path = dir.path().to_string_lossy().into_owned();
        let mut entries = read_dir(path).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "a.txt");
        assert!(!entries[0].is_dir);
        assert_eq!(entries[1].name, "sub");
        assert!(entries[1].is_dir);
    }

    #[test]
    fn file_info_flags_text_and_size() {
        let dir = tempdir().unwrap();
        let p = dir.path().join("t.txt");
        fs::write(&p, "hello").unwrap();
        let info = file_info(p.to_string_lossy().into_owned()).unwrap();
        assert_eq!(info.size, 5);
        assert!(!info.binary);
    }

    #[test]
    fn file_info_flags_binary() {
        let dir = tempdir().unwrap();
        let p = dir.path().join("b.bin");
        fs::write(&p, [0u8, 1, 2, 3]).unwrap();
        let info = file_info(p.to_string_lossy().into_owned()).unwrap();
        assert!(info.binary);
    }

    #[test]
    fn read_file_chunk_returns_a_window() {
        let dir = tempdir().unwrap();
        let p = dir.path().join("d.bin");
        fs::write(&p, b"0123456789").unwrap();
        let b64 = read_file_chunk(p.to_string_lossy().into_owned(), 2, 4).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD.decode(b64).unwrap();
        assert_eq!(bytes, b"2345");
    }

    #[test]
    fn list_files_walks_recursively_and_skips_heavy_dirs() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "x").unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("src/main.rs"), "x").unwrap();
        fs::create_dir(dir.path().join("node_modules")).unwrap();
        fs::write(dir.path().join("node_modules/dep.js"), "x").unwrap();

        let files = list_files(dir.path().to_string_lossy().into_owned(), 1000).unwrap();
        assert!(files.iter().any(|f| f.ends_with("a.txt")));
        assert!(files.iter().any(|f| f.ends_with("main.rs")));
        assert!(!files.iter().any(|f| f.contains("node_modules")));
    }

    #[test]
    fn list_files_respects_the_limit() {
        let dir = tempdir().unwrap();
        for i in 0..10 {
            fs::write(dir.path().join(format!("f{i}.txt")), "x").unwrap();
        }
        let files = list_files(dir.path().to_string_lossy().into_owned(), 3).unwrap();
        assert_eq!(files.len(), 3);
    }

    #[test]
    fn search_finds_matches_skips_binary_and_gitignored() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "alpha needle beta\nno match here\n").unwrap();
        fs::write(dir.path().join("b.log"), "needle in a log").unwrap();
        fs::write(dir.path().join(".gitignore"), "*.log\n").unwrap();
        fs::write(dir.path().join("c.bin"), b"needle\0binary").unwrap();

        let root = dir.path().to_string_lossy().into_owned();
        let matches = search_in_files(root, "NEEDLE".into(), 100).unwrap();

        assert!(matches.iter().any(|m| m.path.ends_with("a.txt") && m.line == 1));
        assert!(!matches.iter().any(|m| m.path.ends_with("b.log"))); // gitignored
        assert!(!matches.iter().any(|m| m.path.ends_with("c.bin"))); // binary
    }

    #[test]
    fn create_file_and_dir_and_rename() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("new.txt");
        create_file(file.to_string_lossy().into()).unwrap();
        assert!(file.exists());
        // Creating over an existing path fails.
        assert!(create_file(file.to_string_lossy().into()).is_err());

        let sub = dir.path().join("sub/deep");
        create_dir(sub.to_string_lossy().into()).unwrap();
        assert!(sub.is_dir());

        let renamed = dir.path().join("renamed.txt");
        rename_path(file.to_string_lossy().into(), renamed.to_string_lossy().into()).unwrap();
        assert!(!file.exists());
        assert!(renamed.exists());
    }
}
