import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // Vite options tailored for Tauri development
  clearScreen: false,
  build: {
    // The startup chunk is CodeMirror core + Svelte (~540 kB) — everything
    // optional (Prettier, Shiki, grammars, markdown-it) is already lazy.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't let Vite watch the Rust side
      ignored: ["**/src-tauri/**"],
    },
  },
});
