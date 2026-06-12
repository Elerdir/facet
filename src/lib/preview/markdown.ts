import type MarkdownIt from "markdown-it";
import { extension } from "../domain/paths";

let mdPromise: Promise<MarkdownIt> | null = null;

// markdown-it is dynamically imported so it stays out of the startup bundle —
// it loads the first time a preview pane is opened.
//
// `html: false` keeps raw HTML in the source escaped, so rendering a file's
// content can't inject markup into the app — important for an editor that
// opens arbitrary files.
function getMd(): Promise<MarkdownIt> {
  if (!mdPromise) {
    mdPromise = import("markdown-it").then(
      (m) =>
        new m.default({
          html: false,
          linkify: true,
          typographer: true,
        }),
    );
  }
  return mdPromise;
}

/** Render Markdown source to an HTML string. */
export async function renderMarkdown(source: string): Promise<string> {
  return (await getMd()).render(source);
}

const PREVIEWABLE = new Set(["md", "markdown", "mdown", "markdn"]);

/** Whether a file name has a live preview available. */
export function isPreviewable(name: string): boolean {
  return PREVIEWABLE.has(extension(name));
}
