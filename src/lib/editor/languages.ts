import type { Extension } from "@codemirror/state";
import { extension } from "../domain/paths";

type LangLoader = () => Promise<Extension>;

/**
 * Extension -> CodeMirror (Lezer) language mapping.
 *
 * Loaders use dynamic imports so each language parser becomes its own lazy
 * chunk — none of them weigh down the startup bundle. The TextMate fallback
 * for everything else lives in highlighting.ts.
 */
const byExtension: Record<string, LangLoader> = {
  js: async () => (await import("@codemirror/lang-javascript")).javascript(),
  mjs: async () => (await import("@codemirror/lang-javascript")).javascript(),
  cjs: async () => (await import("@codemirror/lang-javascript")).javascript(),
  jsx: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true }),
  ts: async () =>
    (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  mts: async () =>
    (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  tsx: async () =>
    (await import("@codemirror/lang-javascript")).javascript({
      typescript: true,
      jsx: true,
    }),
  json: async () => (await import("@codemirror/lang-json")).json(),
  jsonc: async () => (await import("@codemirror/lang-json")).json(),
  html: async () => (await import("@codemirror/lang-html")).html(),
  htm: async () => (await import("@codemirror/lang-html")).html(),
  svelte: async () => (await import("@codemirror/lang-html")).html(),
  vue: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  scss: async () => (await import("@codemirror/lang-css")).css(),
  less: async () => (await import("@codemirror/lang-css")).css(),
  md: async () => (await import("@codemirror/lang-markdown")).markdown(),
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),
  rs: async () => (await import("@codemirror/lang-rust")).rust(),
  py: async () => (await import("@codemirror/lang-python")).python(),
  pyw: async () => (await import("@codemirror/lang-python")).python(),
};

/** Whether a fast native (Lezer) grammar exists for the file. */
export function hasLezerLanguage(name: string): boolean {
  return extension(name) in byExtension;
}

/** Lazily load the Lezer language extension, or null when none exists. */
export function loadLanguage(name: string): Promise<Extension> | null {
  const loader = byExtension[extension(name)];
  return loader ? loader() : null;
}
