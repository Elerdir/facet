import type { GithubPort } from "../ports/github";
import type { GithubRepoRef, PullRequestInfo } from "../domain/github";

/** GithubPort over the public REST API (token optional for public repos). */
export class GithubApi implements GithubPort {
  async listOpenPullRequests(
    ref: GithubRepoRef,
    token: string | null,
  ): Promise<PullRequestInfo[]> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (token && token.trim() !== "") headers.Authorization = `Bearer ${token.trim()}`;

    const response = await fetch(
      `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls?state=open&per_page=30`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub API: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as Array<{
      number: number;
      title: string;
      html_url: string;
      draft: boolean;
      user: { login: string } | null;
      head: { ref: string };
    }>;
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? "",
      url: pr.html_url,
      draft: pr.draft,
      headRef: pr.head.ref,
    }));
  }
}
