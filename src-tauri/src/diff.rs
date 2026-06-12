//! Side-by-side line diff. The alignment logic is pure over two strings so it
//! is unit-testable; the command wraps it with encoding-aware file reads.

use crate::detect;
use similar::{ChangeTag, TextDiff};
use std::fs;

/// One aligned row of a side-by-side diff. A `changed` row pairs a removed line
/// on the left with an added line on the right; `added`/`removed` rows have a
/// cell on only one side; `equal` rows match.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffRow {
    pub kind: String,
    pub left_line: Option<u32>,
    pub left: Option<String>,
    pub right_line: Option<u32>,
    pub right: Option<String>,
}

fn flush(
    rows: &mut Vec<DiffRow>,
    del: &mut Vec<(u32, String)>,
    ins: &mut Vec<(u32, String)>,
) {
    let n = del.len().max(ins.len());
    for i in 0..n {
        match (del.get(i), ins.get(i)) {
            (Some((ln, lt)), Some((rn, rt))) => rows.push(DiffRow {
                kind: "changed".into(),
                left_line: Some(*ln),
                left: Some(lt.clone()),
                right_line: Some(*rn),
                right: Some(rt.clone()),
            }),
            (Some((ln, lt)), None) => rows.push(DiffRow {
                kind: "removed".into(),
                left_line: Some(*ln),
                left: Some(lt.clone()),
                right_line: None,
                right: None,
            }),
            (None, Some((rn, rt))) => rows.push(DiffRow {
                kind: "added".into(),
                left_line: None,
                left: None,
                right_line: Some(*rn),
                right: Some(rt.clone()),
            }),
            (None, None) => {}
        }
    }
    del.clear();
    ins.clear();
}

/// Compute aligned side-by-side rows for two texts.
pub fn diff_lines(old: &str, new: &str) -> Vec<DiffRow> {
    let diff = TextDiff::from_lines(old, new);
    let mut rows = Vec::new();
    let mut del: Vec<(u32, String)> = Vec::new();
    let mut ins: Vec<(u32, String)> = Vec::new();
    let mut old_no = 0u32;
    let mut new_no = 0u32;

    for change in diff.iter_all_changes() {
        let text = change.value().trim_end_matches('\n').to_string();
        match change.tag() {
            ChangeTag::Delete => {
                old_no += 1;
                del.push((old_no, text));
            }
            ChangeTag::Insert => {
                new_no += 1;
                ins.push((new_no, text));
            }
            ChangeTag::Equal => {
                flush(&mut rows, &mut del, &mut ins);
                old_no += 1;
                new_no += 1;
                rows.push(DiffRow {
                    kind: "equal".into(),
                    left_line: Some(old_no),
                    left: Some(text.clone()),
                    right_line: Some(new_no),
                    right: Some(text),
                });
            }
        }
    }
    flush(&mut rows, &mut del, &mut ins);
    rows
}

/// Diff two files, reading each with encoding detection.
#[tauri::command]
pub fn diff_files(left: String, right: String) -> Result<Vec<DiffRow>, String> {
    let a = fs::read(&left).map_err(|e| format!("Nelze přečíst {left}: {e}"))?;
    let b = fs::read(&right).map_err(|e| format!("Nelze přečíst {right}: {e}"))?;
    Ok(diff_lines(&detect::decode(&a).0, &detect::decode(&b).0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_files_are_all_equal() {
        let rows = diff_lines("a\nb\n", "a\nb\n");
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().all(|r| r.kind == "equal"));
        assert_eq!(rows[0].left_line, Some(1));
        assert_eq!(rows[1].right_line, Some(2));
    }

    #[test]
    fn pairs_a_replacement_as_changed() {
        let rows = diff_lines("a\nb\nc\n", "a\nB\nc\n");
        let changed = rows.iter().find(|r| r.kind == "changed").unwrap();
        assert_eq!(changed.left.as_deref(), Some("b"));
        assert_eq!(changed.right.as_deref(), Some("B"));
        assert_eq!(changed.left_line, Some(2));
        assert_eq!(changed.right_line, Some(2));
    }

    #[test]
    fn marks_a_pure_insertion_as_added() {
        let rows = diff_lines("a\n", "a\nb\n");
        let added = rows.iter().find(|r| r.kind == "added").unwrap();
        assert_eq!(added.right.as_deref(), Some("b"));
        assert!(added.left.is_none());
    }

    #[test]
    fn marks_a_pure_deletion_as_removed() {
        let rows = diff_lines("a\nb\n", "a\n");
        let removed = rows.iter().find(|r| r.kind == "removed").unwrap();
        assert_eq!(removed.left.as_deref(), Some("b"));
        assert!(removed.right.is_none());
    }
}
