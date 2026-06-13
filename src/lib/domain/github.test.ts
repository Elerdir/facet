import { describe, it, expect } from "vitest";
import { parseGithubRemote } from "./github";

describe("parseGithubRemote", () => {
  it("parses https remotes with and without .git", () => {
    expect(parseGithubRemote("https://github.com/Elerdir/facet.git")).toEqual({
      owner: "Elerdir",
      repo: "facet",
    });
    expect(parseGithubRemote("https://github.com/user/proj")).toEqual({
      owner: "user",
      repo: "proj",
    });
  });

  it("parses ssh remotes", () => {
    expect(parseGithubRemote("git@github.com:user/tool.git")).toEqual({
      owner: "user",
      repo: "tool",
    });
  });

  it("returns null for non-GitHub or missing remotes", () => {
    expect(parseGithubRemote("https://gitlab.com/u/r.git")).toBeNull();
    expect(parseGithubRemote(null)).toBeNull();
  });
});
