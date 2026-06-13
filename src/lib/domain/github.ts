/** Pure GitHub helpers: remote parsing and PR shapes. */

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

/** Parse owner/repo from an https or ssh GitHub remote, or null. */
export function parseGithubRemote(url: string | null): GithubRepoRef | null {
  if (!url) return null;
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  author: string;
  url: string;
  draft: boolean;
  headRef: string;
}
