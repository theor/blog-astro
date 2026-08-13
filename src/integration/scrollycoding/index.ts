import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

import { markTransformer } from "./markTransformer";
import { remarkScrollycoding, type ComponentPaths } from "./remark";

const PKG_NAME = "@theor/scrollycoding";

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
      "astro:config:setup": ({ config, updateConfig }) => {
        // Absolute, forward-slashed specifiers: Vite resolves these without any tsconfig
        // path aliases, and this is the form astro-m2dx already uses on Windows.
        const resolve = (file: string) =>
          fileURLToPath(new URL(`integration/scrollycoding/${file}`, config.srcDir)).replace(/\\/g, "/");

        const components: ComponentPaths = {
          root: resolve("Scrollycoding.astro"),
          step: resolve("ScrollyStep.astro"),
          panel: resolve("ScrollyPanel.astro"),
        };

        updateConfig({
          markdown: {
            remarkPlugins: [() => remarkScrollycoding(components)],
            shikiConfig: {
              transformers: [markTransformer()],
            },
          },
        });
      },
    },
  };
}
