import canvasCommons from "@canvas-commons/vite-plugin";
import { defineConfig } from "vite";

/**
 * The Canvas Commons editor - `yarn canvas`, then http://localhost:9000.
 *
 * Authoring animations needs the timeline and the inspector, which are a Vite dev server
 * of their own claiming `/`; that is exactly why the Astro integration bundles projects
 * out-of-process instead of merging this plugin into Astro's Vite (see ./index.ts).
 * Saved changes land in the `.meta` files next to each project and scene, which the
 * integration reads back for the animation's resolution.
 */
export default defineConfig({
  // Vite 7 still transforms TSX with esbuild; the plugin only configures the oxc side.
  esbuild: { jsx: "automatic", jsxImportSource: "@canvas-commons/2d" },
  plugins: [canvasCommons({ project: ["src/**/*.project.ts", "src/**/*.project.tsx"] })],
});
