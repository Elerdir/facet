import type { Plugin } from "prettier";

interface PrettierModules {
  format: (code: string, options: object) => Promise<string>;
  plugins: Plugin[];
}

let modulesPromise: Promise<PrettierModules> | null = null;

// Prettier and its parsers are dynamically imported so they stay out of the
// startup bundle — they load on the first "format document" invocation.
function load(): Promise<PrettierModules> {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/typescript"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/html"),
      import("prettier/plugins/markdown"),
      import("prettier/plugins/yaml"),
    ]).then(([standalone, ...plugins]) => ({
      format: standalone.format,
      // All plugins are passed every time; Prettier picks by `parser`.
      plugins: plugins as unknown as Plugin[],
    }));
  }
  return modulesPromise;
}

/** Format source in-process with Prettier (no external tools required). */
export async function formatWithPrettier(code: string, parser: string): Promise<string> {
  const { format, plugins } = await load();
  return format(code, { parser, plugins });
}
