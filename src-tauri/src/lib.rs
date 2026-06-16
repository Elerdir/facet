mod commands;
mod dap;
mod detect;
mod diff;
mod history;
mod lsp;
mod secrets;
mod terminal;
mod vcs;
mod watch;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Open (and create) the local-history database in the app data dir.
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = rusqlite::Connection::open(dir.join("history.db"))?;
            history::init(&conn)?;
            app.manage(history::HistoryDb(std::sync::Mutex::new(conn)));
            app.manage(lsp::LspProcesses::default());
            app.manage(dap::DapProcesses::default());
            app.manage(watch::FsWatcher::default());
            app.manage(terminal::Terminals::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::write_text_file,
            commands::file_info,
            commands::read_file_chunk,
            commands::read_dir,
            commands::create_file,
            commands::create_dir,
            commands::rename_path,
            commands::trash_path,
            commands::run_command_stdio,
            commands::list_files,
            commands::read_project_files,
            commands::search_in_files,
            commands::replace_in_files,
            diff::diff_files,
            history::history_append,
            history::history_list,
            history::history_get,
            history::history_prune,
            vcs::git_status,
            vcs::git_diff_head,
            vcs::git_head_content,
            vcs::git_stage,
            vcs::git_unstage,
            vcs::git_commit,
            vcs::git_branches,
            vcs::git_checkout,
            vcs::git_create_branch,
            vcs::git_sync,
            vcs::git_log,
            vcs::git_blame,
            vcs::git_staged_diff,
            vcs::git_clone,
            vcs::git_unstaged_diff,
            vcs::git_apply_cached,
            vcs::git_init,
            vcs::git_remote_url,
            vcs::git_get_identity,
            vcs::git_set_identity,
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            dap::dap_start,
            dap::dap_send,
            dap::dap_stop,
            watch::watch_folder,
            terminal::term_start,
            terminal::term_write,
            terminal::term_resize,
            terminal::term_kill,
            secrets::secret_get,
            secrets::secret_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
