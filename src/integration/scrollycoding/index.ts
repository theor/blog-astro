import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
// Static, not `await import()`: the config module graph is loaded through Vite's module
// runner, which is already closed by the time an async hook awaits a dynamic import.
import { createHighlighter } from "shiki";

import { markTransformer } from "./markTransformer";
import { remarkScrollycoding, type ComponentPaths, type Palette } from "./remark";

const PKG_NAME = "@theor/scrollycoding";

/** Used when the theme can't be resolved; matches shiki's `nord`. */
const FALLBACK_PALETTE: Palette = { bg: "#2e3440ff", fg: "#d8dee9ff" };

/**
 * The panel chrome - filename bar, callouts, marks, the diff gutter - has to sit on
 * shiki's own background. In single-theme mode shiki writes that as a literal hex into
 * every `<pre style>`, with no CSS variable to read it back from, so the chrome would
 * otherwise have to hardcode one theme's palette and drift the moment `shikiConfig.theme`
 * changes.
 *
 * Resolving it once here (~60ms, no langs loaded) and handing it to the panel as two
 * custom properties keeps the chrome following the configured theme. Everything else is
 * derived from these two with `color-mix()` - see ScrollyPanel.astro.
 */
async function resolvePalette(shikiConfig: Record<string, any> | undefined): Promise<Palette> {
  // Dual-theme mode paints two backgrounds behind one `<pre>`; a single resolved pair
  // can't follow that, so leave the chrome on the neutral fallback.
  // Astro always sets `themes`, to `{}` when unused, so presence alone means nothing.
  if (Object.keys(shikiConfig?.themes ?? {}).length > 0) return FALLBACK_PALETTE;

  const theme = shikiConfig?.theme ?? "github-dark"; // Astro's default

  try {
    const highlighter = await createHighlighter({ themes: [theme], langs: [] });
    const name = typeof theme === "string" ? theme : theme?.name;
    const resolved = highlighter.getTheme(name);
    highlighter.dispose();
    if (resolved?.bg && resolved?.fg) return { bg: resolved.bg, fg: resolved.fg };
  } catch (error) {
    console.warn(`[scrollycoding] could not resolve shiki theme: ${(error as Error).message}`);
  }

  return FALLBACK_PALETTE;
}

/**
 * Replicates Code Hike's scrollycoding layout natively for Astro.
 *
 * Code Hike itself is React-only and depends on a recma stage that patches the compiled
 * `_createMdxContent` function, which Astro never produces - so this is a
 * reimplementation of the authoring syntax and the scroll mechanic, built on Astro's
 * own MDX + shiki pipeline.
 *
 * Note: `updateConfig` *appends* to `markdown.remarkPlugins`, so this runs after
 * astro-m2dx. That is intended - see remark.ts, which injects its own component imports
 * rather than relying on m2dx's auto-imports.
 */
export function scrollycoding(): AstroIntegration {
  return {
    name: PKG_NAME,
    hooks: {
      "astro:config:setup": async ({ config, updateConfig }) => {
        // Absolute, forward-slashed specifiers: Vite resolves these without any tsconfig
        // path aliases, and this is the form astro-m2dx already uses on Windows.
        const resolve = (file: string) =>
          fileURLToPath(new URL(`integration/scrollycoding/${file}`, config.srcDir)).replace(/\\/g, "/");

        const components: ComponentPaths = {
          root: resolve("Scrollycoding.astro"),
          step: resolve("ScrollyStep.astro"),
          panel: resolve("ScrollyPanel.astro"),
        };

        const palette = await resolvePalette(config.markdown?.shikiConfig as any);

        updateConfig({
          markdown: {
            remarkPlugins: [() => remarkScrollycoding(components, palette)],
            shikiConfig: {
              transformers: [markTransformer()],
            },
          },
        });
      },
    },
  };
}
