//! Local history: a SQLite-backed log of saved file revisions.
//!
//! The store functions are pure over a `rusqlite::Connection`, so they can be
//! unit-tested against an in-memory database without Tauri. The command wrappers
//! adapt them to a managed connection.

use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// Managed SQLite connection for the local-history database.
pub struct HistoryDb(pub Mutex<Connection>);

/// Metadata about a stored revision (content fetched separately on demand).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionMeta {
    pub id: i64,
    pub created_at: i64,
    pub size: i64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Create the schema if it does not exist.
pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS revisions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            path       TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rev_path_time
            ON revisions(path, created_at DESC);",
    )
}

/// Append a revision, skipping it when it is identical to the latest one for
/// the path. Returns the new revision id, or None when deduplicated.
pub fn append(
    conn: &Connection,
    path: &str,
    content: &str,
    created_at: i64,
) -> rusqlite::Result<Option<i64>> {
    let latest: Option<String> = conn
        .query_row(
            "SELECT content FROM revisions WHERE path = ?1 ORDER BY created_at DESC LIMIT 1",
            params![path],
            |row| row.get(0),
        )
        .optional()?;
    if latest.as_deref() == Some(content) {
        return Ok(None);
    }
    conn.execute(
        "INSERT INTO revisions (path, content, created_at) VALUES (?1, ?2, ?3)",
        params![path, content, created_at],
    )?;
    Ok(Some(conn.last_insert_rowid()))
}

/// Revisions for a path, newest first.
pub fn list(conn: &Connection, path: &str) -> rusqlite::Result<Vec<RevisionMeta>> {
    let mut stmt = conn.prepare(
        "SELECT id, created_at, length(content) FROM revisions
         WHERE path = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![path], |row| {
        Ok(RevisionMeta {
            id: row.get(0)?,
            created_at: row.get(1)?,
            size: row.get(2)?,
        })
    })?;
    rows.collect()
}

/// Full content of a revision.
pub fn get(conn: &Connection, id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT content FROM revisions WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .optional()
}

/// Delete revisions older than the cutoff (unix ms). Returns the number removed.
pub fn prune(conn: &Connection, older_than_ms: i64) -> rusqlite::Result<usize> {
    conn.execute(
        "DELETE FROM revisions WHERE created_at < ?1",
        params![older_than_ms],
    )
}

// --- Tauri commands --------------------------------------------------------

#[tauri::command]
pub fn history_append(
    state: State<HistoryDb>,
    path: String,
    content: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    append(&conn, &path, &content, now_ms()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn history_list(state: State<HistoryDb>, path: String) -> Result<Vec<RevisionMeta>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    list(&conn, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_get(state: State<HistoryDb>, id: i64) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    get(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_prune(state: State<HistoryDb>, cutoff: i64) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    prune(&conn, cutoff).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init(&conn).unwrap();
        conn
    }

    #[test]
    fn appends_and_lists_newest_first() {
        let conn = db();
        let v1 = append(&conn, "/a", "v1", 1000).unwrap();
        let v2 = append(&conn, "/a", "v2", 2000).unwrap();
        assert!(v1.is_some() && v2.is_some());

        let revisions = list(&conn, "/a").unwrap();
        assert_eq!(revisions.len(), 2);
        assert_eq!(revisions[0].id, v2.unwrap());
        assert_eq!(revisions[0].size, 2);
    }

    #[test]
    fn deduplicates_identical_consecutive_content() {
        let conn = db();
        append(&conn, "/a", "same", 1000).unwrap();
        assert!(append(&conn, "/a", "same", 1001).unwrap().is_none());
        assert_eq!(list(&conn, "/a").unwrap().len(), 1);
    }

    #[test]
    fn gets_revision_content() {
        let conn = db();
        let id = append(&conn, "/a", "hello", 1000).unwrap().unwrap();
        assert_eq!(get(&conn, id).unwrap().as_deref(), Some("hello"));
        assert_eq!(get(&conn, 9999).unwrap(), None);
    }

    #[test]
    fn prunes_old_revisions() {
        let conn = db();
        append(&conn, "/a", "old", 1000).unwrap();
        append(&conn, "/a", "new", 3000).unwrap();
        let removed = prune(&conn, 2000).unwrap();
        assert_eq!(removed, 1);
        let revisions = list(&conn, "/a").unwrap();
        assert_eq!(revisions.len(), 1);
        assert_eq!(revisions[0].size, 3);
    }
}
