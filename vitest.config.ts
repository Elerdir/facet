import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Dedicated Vitest config so the Svelte plugin compiles `.svelte` and
// `.svelte.ts` (runes) modules under test. `browser` resolve condition makes
// Svelte use its client runtime in the jsdom environment.
export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest-setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
});
