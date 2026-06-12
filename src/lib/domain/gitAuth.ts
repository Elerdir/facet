/** Pure helpers for token-based git auth (GitHub / GitLab over HTTPS). */

export interface GitTokens {
  githubToken: string;
  gitlabToken: string;
  gitlabHost: string;
}

/**
 * Base64 "basic" credential for a remote URL, or null when no token applies.
 * GitHub expects `x-access-token:<PAT>`, GitLab `oauth2:<PAT>`. Used as a
 * per-invocation `http.extraheader` — never written into git config.
 */
export function authHeaderFor(remoteUrl: string | null, tokens: GitTokens): string | null {
  if (!remoteUrl || !/^https?:/i.test(remoteUrl)) return null;
  let host: string;
  try {
    host = new URL(remoteUrl).host.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith("github.com") && tokens.githubToken.trim() !== "") {
    return btoa(`x-access-token:${tokens.githubToken.trim()}`);
  }
  const gitlabHost = (tokens.gitlabHost.trim() || "gitlab.com").toLowerCase();
  if (host.endsWith(gitlabHost) && tokens.gitlabToken.trim() !== "") {
    return btoa(`oauth2:${tokens.gitlabToken.trim()}`);
  }
  return null;
}

/** Repository folder name derived from a clone URL ("…/owner/repo.git" → "repo"). */
export function repoNameFromUrl(url: string): string {
  const cleaned = url.replace(/\/+$/, "").replace(/\.git$/i, "");
  const last = cleaned.split(/[/:]/).pop() ?? "repo";
  return last || "repo";
}
