import { describe, it, expect } from "vitest";
import { parseUserConfig } from "./userTemplates";

describe("parseUserConfig", () => {
  it("parses valid file-type rules and grammar references", () => {
    const cfg = parseUserConfig(
      JSON.stringify({
        fileTypes: [{ extensions: ["FOO", "Bar"], language: "toml" }],
        grammars: ["custom.tmLanguage.json"],
      }),
    );
    expect(cfg.fileTypes).toEqual([
      { extensions: ["foo", "bar"], language: "toml" },
    ]);
    expect(cfg.grammars).toEqual(["custom.tmLanguage.json"]);
  });

  it("drops malformed rules", () => {
    const cfg = parseUserConfig(
      JSON.stringify({
        fileTypes: [
          { extensions: "nope", language: "x" },
          { extensions: ["ok"], language: 42 },
          { extensions: ["good"], language: "ini" },
        ],
      }),
    );
    expect(cfg.fileTypes).toEqual([{ extensions: ["good"], language: "ini" }]);
  });

  it("returns an empty config for invalid JSON", () => {
    expect(parseUserConfig("{ not json")).toEqual({ fileTypes: [], grammars: [] });
  });

  it("returns an empty config for non-object JSON", () => {
    expect(parseUserConfig("123")).toEqual({ fileTypes: [], grammars: [] });
  });
});
