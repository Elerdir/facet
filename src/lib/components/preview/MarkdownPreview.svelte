<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { renderMarkdown } from "../../preview/markdown";
  import type { Buffer } from "../../domain/buffer";

  // Live preview: re-renders as the shared buffer content changes. Rendering
  // is async (markdown-it loads lazily); the guard drops out-of-order results.
  let { buffer }: { buffer: Buffer | null } = $props();
  let html = $state("");

  $effect(() => {
    const source = buffer?.content ?? "";
    let stale = false;
    void renderMarkdown(source).then((out) => {
      if (!stale) html = out;
    });
    return () => {
      stale = true;
    };
  });

  let container: HTMLDivElement;

  // Delegate link clicks via a native listener (the {@html} content is opaque
  // to Svelte). External links open in the OS browser; in-page navigation of
  // the webview is always prevented.
  $effect(() => {
    const el = container;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      e.preventDefault();
      const href = anchor.getAttribute("href");
      if (href && /^https?:/i.test(href)) {
        openUrl(href).catch(() => {});
      }
    }
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  });
</script>

<div class="md-preview" bind:this={container}>
  <div class="markdown-body">{@html html}</div>
</div>

<style>
  .md-preview {
    position: absolute;
    inset: 0;
    overflow: auto;
    background: var(--bg);
  }

  .markdown-body {
    max-width: 820px;
    margin: 0 auto;
    padding: 24px 32px 64px;
    line-height: 1.65;
    color: var(--fg);
  }
</style>
