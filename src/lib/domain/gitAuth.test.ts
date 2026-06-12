import { describe, it, expect } from "vitest";
import { authHeaderFor, repoNameFromUrl } from "./gitAuth";

const tokens = { githubToken: "ghp_abc", gitlabToken: "glpat_xyz", gitlabHost: "" };

describe("authHeaderFor", () => {
  it("builds a GitHub basic credential", () => {
    const header = authHeaderFor("https://github.com/user/repo.git", tokens);
    expect(header).toBe(btoa("x-access-token:ghp_abc"));
  });

  it("builds a GitLab credential (default host)", () => {
    const header = authHeaderFor("https://gitlab.com/user/repo.git", tokens);
    expect(header).toBe(btoa("oauth2:glpat_xyz"));
  });

  it("matches a custom GitLab host", () => {
    const header = authHeaderFor("https://git.firma.cz/user/repo.git", {
      ...tokens,
      gitlabHost: "git.firma.cz",
    });
    expect(header).toBe(btoa("oauth2:glpat_xyz"));
  });

  it("returns null for ssh remotes, unknown hosts and missing tokens", () => {
    expect(authHeaderFor("git@github.com:user/repo.git", tokens)).toBeNull();
    expect(authHeaderFor("https://bitbucket.org/u/r.git", tokens)).toBeNull();
    expect(
      authHeaderFor("https://github.com/u/r.git", { ...tokens, githubToken: "" }),
    ).toBeNull();
    expect(authHeaderFor(null, tokens)).toBeNull();
  });
});

describe("repoNameFromUrl", () => {
  it("derives the folder name from common URL shapes", () => {
    expect(repoNameFromUrl("https://github.com/user/facet.git")).toBe("facet");
    expect(repoNameFromUrl("https://gitlab.com/group/sub/proj")).toBe("proj");
    expect(repoNameFromUrl("git@github.com:user/tool.git")).toBe("tool");
  });
});
