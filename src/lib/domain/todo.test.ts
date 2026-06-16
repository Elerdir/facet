import { describe, it, expect } from "vitest";
import { findTodos } from "./todo";

describe("findTodos", () => {
  it("finds known annotation keywords", () => {
    const todos = findTodos("// TODO: fix\n/* FIXME later */ HACK XXX BUG NOTE");
    expect(todos.map((t) => t.kind)).toEqual(["TODO", "FIXME", "HACK", "XXX", "BUG", "NOTE"]);
  });

  it("matches only whole words", () => {
    expect(findTodos("TODOS notebook BUGGY")).toEqual([]);
  });

  it("reports offsets", () => {
    const [t] = findTodos("x // TODO");
    expect(t).toEqual({ from: 5, to: 9, kind: "TODO" });
  });
});
