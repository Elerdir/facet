import type { GithubRepoRef, PullRequestInfo } from "../domain/github";

/** Port for the GitHub REST API (read-only PR listing for now). */
export interface GithubPort {
  listOpenPullRequests(
    ref: GithubRepoRef,
    token: string | null,
  ): Promise<PullRequestInfo[]>;
}
