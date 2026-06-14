//! Version control as a pluggable provider.
//!
//! `VersionControl` is the seam: the built-in `GitVcs` implements it with
//! libgit2 (local operations only), and a custom provider (e.g. one that shells
//! out to an external tool over a JSON protocol) can implement the same trait
//! without touching the editor. The Git logic is unit-tested against temporary
//! repositories.

use crate::{detect, diff};
use git2::{Repository, Status, StatusOptions};
use std::path::Path;
use std::process::Command;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    path: String,
    status: String,
    staged: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    is_repo: bool,
    branch: Option<String>,
    files: Vec<FileStatus>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Branches {
    current: Option<String>,
    all: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    hash: String,
    message: String,
    author: String,
    time: i64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    line: u32,
    hash: String,
    author: String,
}

/// The contract every version-control backend implements.
pub trait VersionControl {
    fn status(&self, repo: &str) -> RepoStatus;
    fn diff_head(&self, repo: &str, file: &str) -> Result<Vec<diff::DiffRow>, String>;
    fn stage(&self, repo: &str, file: &str) -> Result<(), String>;
    fn unstage(&self, repo: &str, file: &str) -> Result<(), String>;
    fn commit(&self, repo: &str, message: &str) -> Result<(), String>;
    fn branches(&self, repo: &str) -> Result<Branches, String>;
    fn checkout(&self, repo: &str, name: &str) -> Result<(), String>;
    fn create_branch(&self, repo: &str, name: &str) -> Result<(), String>;
    fn log(&self, repo: &str, limit: usize) -> Result<Vec<Commit>, String>;
    fn blame(&self, repo: &str, file: &str) -> Result<Vec<BlameLine>, String>;
    fn staged_diff(&self, repo: &str) -> Result<String, String>;
}

/// Built-in Git backend (libgit2, local operations).
pub struct GitVcs;

fn index_status(s: Status) -> &'static str {
    if s.contains(Status::INDEX_NEW) {
        "added"
    } else if s.contains(Status::INDEX_DELETED) {
        "deleted"
    } else if s.contains(Status::INDEX_RENAMED) {
        "renamed"
    } else {
        "modified"
    }
}

fn worktree_status(s: Status) -> &'static str {
    if s.contains(Status::WT_NEW) {
        "untracked"
    } else if s.contains(Status::WT_DELETED) {
        "deleted"
    } else if s.contains(Status::WT_RENAMED) {
        "renamed"
    } else {
        "modified"
    }
}

fn head_branch(repo: &Repository) -> Option<String> {
    repo.head().ok()?.shorthand().map(|s| s.to_string())
}

fn head_blob_content(repo: &Repository, file: &str) -> Option<String> {
    let tree = repo.head().ok()?.peel_to_tree().ok()?;
    let entry = tree.get_path(Path::new(file)).ok()?;
    let object = entry.to_object(repo).ok()?;
    let blob = object.as_blob()?;
    Some(detect::decode(blob.content()).0)
}

impl VersionControl for GitVcs {
    fn status(&self, repo: &str) -> RepoStatus {
        let repository = match Repository::open(repo) {
            Ok(r) => r,
            Err(_) => {
                return RepoStatus {
                    is_repo: false,
                    branch: None,
                    files: Vec::new(),
                }
            }
        };

        let branch = head_branch(&repository);
        let mut options = StatusOptions::new();
        options.include_untracked(true).recurse_untracked_dirs(true);

        let mut files = Vec::new();
        if let Ok(statuses) = repository.statuses(Some(&mut options)) {
            for entry in statuses.iter() {
                let s = entry.status();
                let path = entry.path().unwrap_or_default().to_string();

                if s.intersects(
                    Status::INDEX_NEW
                        | Status::INDEX_MODIFIED
                        | Status::INDEX_DELETED
                        | Status::INDEX_RENAMED
                        | Status::INDEX_TYPECHANGE,
                ) {
                    files.push(FileStatus {
                        path: path.clone(),
                        status: index_status(s).to_string(),
                        staged: true,
                    });
                }
                if s.intersects(
                    Status::WT_NEW
                        | Status::WT_MODIFIED
                        | Status::WT_DELETED
                        | Status::WT_RENAMED
                        | Status::WT_TYPECHANGE,
                ) {
                    files.push(FileStatus {
                        path,
                        status: worktree_status(s).to_string(),
                        staged: false,
                    });
                }
            }
        }

        RepoStatus {
            is_repo: true,
            branch,
            files,
        }
    }

    fn diff_head(&self, repo: &str, file: &str) -> Result<Vec<diff::DiffRow>, String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let head = head_blob_content(&repository, file).unwrap_or_default();
        let workdir = repository.workdir().ok_or("Repozitář nemá pracovní adresář")?;
        let working = std::fs::read(workdir.join(file)).unwrap_or_default();
        Ok(diff::diff_lines(&head, &detect::decode(&working).0))
    }

    fn stage(&self, repo: &str, file: &str) -> Result<(), String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let mut index = repository.index().map_err(|e| e.to_string())?;
        let path = Path::new(file);
        let exists = repository
            .workdir()
            .map(|w| w.join(path).exists())
            .unwrap_or(false);
        if exists {
            index.add_path(path).map_err(|e| e.to_string())?;
        } else {
            index.remove_path(path).map_err(|e| e.to_string())?;
        }
        index.write().map_err(|e| e.to_string())
    }

    fn unstage(&self, repo: &str, file: &str) -> Result<(), String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let head_commit = repository.head().ok().and_then(|h| h.peel_to_commit().ok());
        match head_commit {
            Some(commit) => repository
                .reset_default(Some(commit.as_object()), [Path::new(file)])
                .map_err(|e| e.to_string()),
            None => {
                // No commits yet: just drop the entry from the index.
                let mut index = repository.index().map_err(|e| e.to_string())?;
                let _ = index.remove_path(Path::new(file));
                index.write().map_err(|e| e.to_string())
            }
        }
    }

    fn commit(&self, repo: &str, message: &str) -> Result<(), String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let mut index = repository.index().map_err(|e| e.to_string())?;
        let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
        let tree = repository.find_tree(tree_oid).map_err(|e| e.to_string())?;
        let signature = repository
            .signature()
            .or_else(|_| git2::Signature::now("Facet", "facet@local"))
            .map_err(|e| e.to_string())?;

        let parent = repository.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();

        repository
            .commit(Some("HEAD"), &signature, &signature, message, &tree, &parents)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn branches(&self, repo: &str) -> Result<Branches, String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let current = head_branch(&repository);
        let mut all = Vec::new();
        let iter = repository
            .branches(Some(git2::BranchType::Local))
            .map_err(|e| e.to_string())?;
        for item in iter {
            let (branch, _) = item.map_err(|e| e.to_string())?;
            if let Ok(Some(name)) = branch.name() {
                all.push(name.to_string());
            }
        }
        Ok(Branches { current, all })
    }

    fn checkout(&self, repo: &str, name: &str) -> Result<(), String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let (object, reference) = repository.revparse_ext(name).map_err(|e| e.to_string())?;
        repository
            .checkout_tree(&object, None)
            .map_err(|e| e.to_string())?;
        match reference {
            Some(r) => {
                let ref_name = r.name().ok_or("Neplatná reference")?;
                repository.set_head(ref_name).map_err(|e| e.to_string())
            }
            None => repository
                .set_head_detached(object.id())
                .map_err(|e| e.to_string()),
        }
    }

    fn create_branch(&self, repo: &str, name: &str) -> Result<(), String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let head = repository
            .head()
            .and_then(|h| h.peel_to_commit())
            .map_err(|e| e.to_string())?;
        repository
            .branch(name, &head, false)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn log(&self, repo: &str, limit: usize) -> Result<Vec<Commit>, String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let mut revwalk = repository.revwalk().map_err(|e| e.to_string())?;
        if revwalk.push_head().is_err() {
            return Ok(Vec::new()); // unborn HEAD (no commits yet)
        }
        let mut out = Vec::new();
        for oid in revwalk.take(limit) {
            let oid = oid.map_err(|e| e.to_string())?;
            let commit = repository.find_commit(oid).map_err(|e| e.to_string())?;
            out.push(Commit {
                hash: oid.to_string().chars().take(7).collect(),
                message: commit.summary().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                time: commit.time().seconds(),
            });
        }
        Ok(out)
    }

    fn blame(&self, repo: &str, file: &str) -> Result<Vec<BlameLine>, String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let blame = repository
            .blame_file(Path::new(file), None)
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for hunk in blame.iter() {
            let start = hunk.final_start_line();
            let count = hunk.lines_in_hunk();
            let author = hunk.final_signature().name().unwrap_or("").to_string();
            let hash: String = hunk.final_commit_id().to_string().chars().take(7).collect();
            for i in 0..count {
                out.push(BlameLine {
                    line: (start + i) as u32,
                    hash: hash.clone(),
                    author: author.clone(),
                });
            }
        }
        out.sort_by_key(|b| b.line);
        Ok(out)
    }

    /// Unified diff of the index (staged changes) against HEAD.
    fn staged_diff(&self, repo: &str) -> Result<String, String> {
        let repository = Repository::open(repo).map_err(|e| e.to_string())?;
        let head_tree = repository.head().ok().and_then(|h| h.peel_to_tree().ok());
        let diff = repository
            .diff_tree_to_index(head_tree.as_ref(), None, None)
            .map_err(|e| e.to_string())?;
        let mut out = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            match line.origin() {
                '+' | '-' | ' ' => out.push(line.origin()),
                _ => {}
            }
            out.push_str(&String::from_utf8_lossy(line.content()));
            true
        })
        .map_err(|e| e.to_string())?;
        Ok(out)
    }
}

// --- Tauri commands (dispatch to the built-in Git provider) ----------------

#[tauri::command]
pub fn git_status(repo: String) -> RepoStatus {
    GitVcs.status(&repo)
}

#[tauri::command]
pub fn git_diff_head(repo: String, file: String) -> Result<Vec<diff::DiffRow>, String> {
    GitVcs.diff_head(&repo, &file)
}

#[tauri::command]
pub fn git_stage(repo: String, file: String) -> Result<(), String> {
    GitVcs.stage(&repo, &file)
}

#[tauri::command]
pub fn git_unstage(repo: String, file: String) -> Result<(), String> {
    GitVcs.unstage(&repo, &file)
}

#[tauri::command]
pub fn git_commit(repo: String, message: String) -> Result<(), String> {
    GitVcs.commit(&repo, &message)
}

#[tauri::command]
pub fn git_branches(repo: String) -> Result<Branches, String> {
    GitVcs.branches(&repo)
}

#[tauri::command]
pub fn git_checkout(repo: String, name: String) -> Result<(), String> {
    GitVcs.checkout(&repo, &name)
}

#[tauri::command]
pub fn git_create_branch(repo: String, name: String) -> Result<(), String> {
    GitVcs.create_branch(&repo, &name)
}

/// Network operations (fetch/pull/push) via the `git` CLI — the bundled libgit2
/// is built without networking. `auth` is an optional base64 basic credential
/// (GitHub/GitLab token) injected per-invocation, never written to config.
#[tauri::command]
pub fn git_sync(repo: String, op: String, auth: Option<String>) -> Result<String, String> {
    if !matches!(op.as_str(), "fetch" | "pull" | "push") {
        return Err(format!("Neznámá operace: {op}"));
    }
    let mut cmd = Command::new("git");
    if let Some(b64) = &auth {
        cmd.arg("-c")
            .arg(format!("http.extraheader=AUTHORIZATION: basic {b64}"));
    }
    let output = cmd
        .arg(&op)
        .current_dir(&repo)
        .output()
        .map_err(|e| format!("Nelze spustit git: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Clone a repository via the `git` CLI; auth handled like in `git_sync`.
#[tauri::command]
pub fn git_clone(url: String, target: String, auth: Option<String>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    if let Some(b64) = &auth {
        cmd.arg("-c")
            .arg(format!("http.extraheader=AUTHORIZATION: basic {b64}"));
    }
    let output = cmd
        .arg("clone")
        .arg(&url)
        .arg(&target)
        .output()
        .map_err(|e| format!("Nelze spustit git: {e}"))?;
    if output.status.success() {
        // git clone reports progress on stderr even on success
        Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Unstaged unified diff of one file (working tree vs index), for hunk staging.
#[tauri::command]
pub fn git_unstaged_diff(repo: String, file: String) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .arg("diff")
        .arg("--")
        .arg(&file)
        .output()
        .map_err(|e| format!("Nelze spustit git: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Apply a patch to the index only (`git apply --cached`) — stages a hunk.
#[tauri::command]
pub fn git_apply_cached(repo: String, patch: String) -> Result<(), String> {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .arg("apply")
        .arg("--cached")
        .arg("--whitespace=nowarn")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Nelze spustit git: {e}"))?;
    child
        .stdin
        .as_mut()
        .ok_or("git nemá stdin")?
        .write_all(patch.as_bytes())
        .map_err(|e| e.to_string())?;
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Initialize a new git repository in the given folder.
#[tauri::command]
pub fn git_init(path: String) -> Result<(), String> {
    Repository::init(&path).map_err(|e| e.to_string())?;
    Ok(())
}

/// URL of the `origin` remote, or null when there is none.
#[tauri::command]
pub fn git_remote_url(repo: String) -> Result<Option<String>, String> {
    let repository = Repository::open(&repo).map_err(|e| e.to_string())?;
    Ok(repository
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|u| u.to_string())))
}

#[derive(serde::Serialize)]
pub struct GitIdentity {
    name: String,
    email: String,
}

/// Read the global git identity (user.name / user.email).
#[tauri::command]
pub fn git_get_identity() -> Result<GitIdentity, String> {
    let config = git2::Config::open_default().map_err(|e| e.to_string())?;
    Ok(GitIdentity {
        name: config.get_string("user.name").unwrap_or_default(),
        email: config.get_string("user.email").unwrap_or_default(),
    })
}

/// Set the global git identity used for commits.
#[tauri::command]
pub fn git_set_identity(name: String, email: String) -> Result<(), String> {
    let mut config = git2::Config::open_default().map_err(|e| e.to_string())?;
    config.set_str("user.name", &name).map_err(|e| e.to_string())?;
    config.set_str("user.email", &email).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_log(repo: String, limit: usize) -> Result<Vec<Commit>, String> {
    GitVcs.log(&repo, limit)
}

#[tauri::command]
pub fn git_blame(repo: String, file: String) -> Result<Vec<BlameLine>, String> {
    GitVcs.blame(&repo, &file)
}

#[tauri::command]
pub fn git_staged_diff(repo: String) -> Result<String, String> {
    GitVcs.staged_diff(&repo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn init_repo(path: &Path) -> Repository {
        let repo = Repository::init(path).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
        repo
    }

    #[test]
    fn reports_non_repo() {
        let dir = tempdir().unwrap();
        let status = GitVcs.status(&dir.path().to_string_lossy());
        assert!(!status.is_repo);
    }

    #[test]
    fn tracks_untracked_stage_commit_and_modify() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "v1\n").unwrap();

        let st = GitVcs.status(&p);
        assert!(st.is_repo);
        assert!(st
            .files
            .iter()
            .any(|f| f.path == "a.txt" && f.status == "untracked" && !f.staged));

        GitVcs.stage(&p, "a.txt").unwrap();
        assert!(GitVcs.status(&p).files.iter().any(|f| f.path == "a.txt" && f.staged));

        GitVcs.commit(&p, "init").unwrap();
        assert!(GitVcs.status(&p).files.is_empty());

        std::fs::write(dir.path().join("a.txt"), "v2\n").unwrap();
        let st = GitVcs.status(&p);
        assert!(st
            .files
            .iter()
            .any(|f| f.path == "a.txt" && f.status == "modified" && !f.staged));

        let rows = GitVcs.diff_head(&p, "a.txt").unwrap();
        assert!(rows.iter().any(|r| r.kind == "changed"));
    }

    #[test]
    fn unstage_moves_file_back_to_worktree() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "x\n").unwrap();

        GitVcs.stage(&p, "a.txt").unwrap();
        assert!(GitVcs.status(&p).files.iter().any(|f| f.staged));
        GitVcs.unstage(&p, "a.txt").unwrap();
        assert!(GitVcs.status(&p).files.iter().all(|f| !f.staged));
    }

    #[test]
    fn lists_creates_and_switches_branches() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "x").unwrap();
        GitVcs.stage(&p, "a.txt").unwrap();
        GitVcs.commit(&p, "init").unwrap();

        GitVcs.create_branch(&p, "feature").unwrap();
        assert!(GitVcs.branches(&p).unwrap().all.contains(&"feature".to_string()));

        GitVcs.checkout(&p, "feature").unwrap();
        assert_eq!(
            GitVcs.branches(&p).unwrap().current.as_deref(),
            Some("feature")
        );
    }

    #[test]
    fn log_and_blame_report_history() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "one\ntwo\n").unwrap();
        GitVcs.stage(&p, "a.txt").unwrap();
        GitVcs.commit(&p, "first").unwrap();

        let log = GitVcs.log(&p, 10).unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!(log[0].message, "first");
        assert_eq!(log[0].author, "Test");

        let blame = GitVcs.blame(&p, "a.txt").unwrap();
        assert_eq!(blame.len(), 2);
        assert_eq!(blame[0].line, 1);
        assert_eq!(blame[0].author, "Test");
    }

    #[test]
    fn init_creates_a_repo_and_remote_url_reads_origin() {
        let dir = tempdir().unwrap();
        let p = dir.path().to_string_lossy().to_string();
        git_init(p.clone()).unwrap();
        let repo = Repository::open(dir.path()).unwrap();
        assert!(GitVcs.status(&p).is_repo);
        assert_eq!(git_remote_url(p.clone()).unwrap(), None);
        repo.remote("origin", "https://github.com/user/proj.git").unwrap();
        assert_eq!(
            git_remote_url(p).unwrap().as_deref(),
            Some("https://github.com/user/proj.git")
        );
    }

    #[test]
    fn staged_diff_shows_index_changes() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "v1\n").unwrap();
        GitVcs.stage(&p, "a.txt").unwrap();
        GitVcs.commit(&p, "init").unwrap();

        std::fs::write(dir.path().join("a.txt"), "v2\n").unwrap();
        assert!(GitVcs.staged_diff(&p).unwrap().is_empty()); // not staged yet

        GitVcs.stage(&p, "a.txt").unwrap();
        let diff = GitVcs.staged_diff(&p).unwrap();
        assert!(diff.contains("+v2"));
        assert!(diff.contains("-v1"));
    }

    #[test]
    fn unstaged_diff_and_apply_cached_stage_a_change() {
        let dir = tempdir().unwrap();
        let _repo = init_repo(dir.path());
        let p = dir.path().to_string_lossy().to_string();
        std::fs::write(dir.path().join("a.txt"), "one\ntwo\nthree\n").unwrap();
        GitVcs.stage(&p, "a.txt").unwrap();
        GitVcs.commit(&p, "init").unwrap();

        std::fs::write(dir.path().join("a.txt"), "one\nTWO\nthree\n").unwrap();
        let diff = git_unstaged_diff(p.clone(), "a.txt".into()).unwrap();
        assert!(diff.contains("+TWO"));
        assert!(diff.contains("-two"));

        // Nothing staged yet, then apply the patch to the index.
        assert!(GitVcs.status(&p).files.iter().all(|f| !f.staged));
        git_apply_cached(p.clone(), diff).unwrap();
        assert!(GitVcs.status(&p).files.iter().any(|f| f.staged));
    }
}
