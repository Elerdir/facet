import { Workspace } from "../application/workspace";
import { TauriFileSystem } from "./tauriFileSystem";
import { TauriDialog } from "./tauriDialog";
import { TauriHistory } from "./tauriHistory";
import { TauriDiff } from "./tauriDiff";
import { TauriVcs } from "./tauriVcs";
import { TauriFormatter } from "./tauriFormatter";
import { TauriLsp } from "./tauriLsp";
import { TauriDap } from "./tauriDap";
import { TauriWatcher } from "./tauriWatcher";
import { TauriSecrets } from "./tauriSecrets";
import { GithubApi } from "./githubApi";
import { ClaudeAi } from "./claudeAi";

/**
 * Composition root: the single production Workspace, wired to the Tauri
 * adapters. Components receive this via Svelte context (see application/context).
 */
export const workspace = new Workspace(
  new TauriFileSystem(),
  new TauriDialog(),
  new TauriHistory(),
  new TauriDiff(),
  new TauriVcs(),
  new TauriFormatter(),
  new TauriLsp(),
  new ClaudeAi(),
  new TauriWatcher(),
  new TauriSecrets(),
  new GithubApi(),
  new TauriDap(),
);
