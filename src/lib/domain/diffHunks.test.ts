import { describe, it, expect } from "vitest";
import { parseUnifiedDiff, buildPatch, hunkLineKind } from "./diffHunks";

const PATCH = `diff --git a/a.txt b/a.txt
index 111..222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,3 +1,3 @@
 first
-second
+SECOND
 third
@@ -10,2 +10,3 @@
 ten
+eleven
 twelve
`;

describe("parseUnifiedDiff", () => {
  it("splits the file header from the hunks", () => {
    const parsed = parseUnifiedDiff(PATCH)!;
    expect(parsed.fileHeader).toContain("diff --git a/a.txt b/a.txt");
    expect(parsed.fileHeader).toContain("+++ b/a.txt");
    expect(parsed.hunks).toHaveLength(2);
    expect(parsed.hunks[0].header).toBe("@@ -1,3 +1,3 @@");
    expect(parsed.hunks[1].header).toBe("@@ -10,2 +10,3 @@");
    expect(parsed.hunks[0].text).toContain("+SECOND");
  });

  it("returns null for empty input or a header without hunks", () => {
    expect(parseUnifiedDiff("")).toBeNull();
    expect(parseUnifiedDiff("diff --git a/x b/x\n--- a/x\n+++ b/x\n")).toBeNull();
  });

  it("buildPatch with one hunk reconstructs an applyable patch", () => {
    const parsed = parseUnifiedDiff(PATCH)!;
    const patch = buildPatch(parsed.fileHeader, [parsed.hunks[1]]);
    expect(patch).toContain("diff --git a/a.txt b/a.txt");
    expect(patch).toContain("@@ -10,2 +10,3 @@");
    expect(patch).not.toContain("+SECOND"); // first hunk excluded
    expect(patch.endsWith("\n")).toBe(true);
  });

  it("round-trips all hunks back to the original patch", () => {
    const parsed = parseUnifiedDiff(PATCH)!;
    expect(buildPatch(parsed.fileHeader, parsed.hunks)).toBe(PATCH);
  });
});

describe("hunkLineKind", () => {
  it("classifies body lines", () => {
    expect(hunkLineKind("+added")).toBe("add");
    expect(hunkLineKind("-removed")).toBe("del");
    expect(hunkLineKind(" context")).toBe("context");
    expect(hunkLineKind("@@ -1 +1 @@")).toBe("meta");
    expect(hunkLineKind("\\ No newline at end of file")).toBe("meta");
  });
});
