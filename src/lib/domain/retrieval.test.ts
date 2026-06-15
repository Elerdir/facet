import { describe, it, expect } from "vitest";
import { tokenize, chunkFile, buildIndex, bm25Search } from "./retrieval";

describe("tokenize", () => {
  it("splits camelCase, snake_case and punctuation", () => {
    expect(tokenize("getUserName(user_id)")).toEqual(["get", "user", "name", "user", "id"]);
  });
  it("drops one-character tokens", () => {
    expect(tokenize("a bb ccc")).toEqual(["bb", "ccc"]);
  });
});

describe("chunkFile", () => {
  it("windows a file into line chunks with start lines", () => {
    const content = Array.from({ length: 95 }, (_, i) => `line${i}`).join("\n");
    const chunks = chunkFile("a.ts", content, 40);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[1].startLine).toBe(41);
  });
});

describe("BM25 retrieval", () => {
  it("ranks the chunk matching the query first", () => {
    const index = buildIndex([
      ...chunkFile("auth.ts", "function login(user) { return validatePassword(user); }"),
      ...chunkFile("math.ts", "function add(a, b) { return a + b; }"),
      ...chunkFile("ui.ts", "function render() { drawButton(); }"),
    ]);
    const hits = bm25Search(index, "jak funguje validate password login", 2);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.path).toBe("auth.ts");
  });

  it("returns nothing for a query with no matching terms", () => {
    const index = buildIndex(chunkFile("a.ts", "const greeting = 1;"));
    expect(bm25Search(index, "zzzzzz qqqqqq", 5)).toEqual([]);
  });
});
