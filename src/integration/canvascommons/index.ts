import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
// Static import: this module graph is loaded through Vite's module runner, which is
// already closed by the time an async hook awaits a dynamic import (same reason as
// scrollycoding/index.ts). `vite` here is Astro's own copy, so there is no second one.
import { build, type Plugin } from "vite";
// Vite re-exports these as values but not as types; rollup is its own dependency.
import type { RollupWatcher, RollupWatcherEvent } from "rollup";
import canvasCommonsPlugin from "@canvas-commons/vite-plugin";

const PKG_NAME = "@theor/canvascommons";

/** Marks a project entry point. `src/animations/hello.project.ts` -> id `animations/hello`. */
const PROJECT_SUFFIX = /\.project\.tsx?$/;

/** Canvas Commons' own default resolution - core's `createProjectMetadata`. */
const DEFAULT_SIZE = { width: 1920, height: 1080 };

export interface CanvasCommonsOptions {
  /**
   * Directories to scan for `*.project.ts`/`*.project.tsx`, relative to `srcDir`.
   * Everything under `src` by default, so animations can live in their own folder or
   * next to the post that uses them.
   */
  roots?: string[];
  /** Path segment, under the site base, the built bundles are served from. */
  dir?: string;
}

/** One entry of the manifest handed to Animation.astro through a virtual module. */
export interface AnimationEntry {
  /** `animations/hello` - path under `srcDir`, without the `.project` suffix. */
  id: string;
  /** Absolute, site-base-aware URL of the built bundle. */
  url: string;
  /** Rendering resolution from the project's `.meta`; sets the element's aspect ratio. */
  width: number;
  height: number;
}

const VIRTUAL_ID = "virtual:canvas-commons/animations";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

const posix = (p: string) => p.split(path.sep).join(path.posix.sep);

/** Recursively collects project entry points, skipping dot-directories. */
function findProjects(dir: string, found: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found; // a configured root that doesn't exist is not an error
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      findProjects(full, found);
    } else if (PROJECT_SUFFIX.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * The rollup entry name the vite plugin will use for a project - it feeds
 * `filePath + '?project'` as an input keyed by `meta.name ?? <path without extension>`.
 * Mirrored here so entry file names can be mapped back onto our own ids.
 */
function pluginEntryName(relPath: string): string {
  const { dir, name } = path.posix.parse(posix(relPath));
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(relPath), `${name}.meta`), "utf8"));
    if (meta?.name) return meta.name;
  } catch {
    // no meta yet (it is created during the build) or no name in it - use the path
  }
  return path.posix.join(dir, name);
}

/** Rendering resolution stored in the project's `.meta`, if it has been changed. */
function readSize(projectFile: string): { width: number; height: number } {
  const metaFile = projectFile.replace(/\.tsx?$/, ".meta");
  try {
    const size = JSON.parse(fs.readFileSync(metaFile, "utf8"))?.shared?.size;
    if (size?.x > 0 && size?.y > 0) return { width: size.x, height: size.y };
  } catch {
    // fall through to the default
  }
  return DEFAULT_SIZE;
}

const MIME: Record<string, string> = {
  ".js": "text/javascript",
  ".map": "application/json",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};

/**
 * Hands Animation.astro the manifest - it cannot see the integration's scope - and, in
 * dev, serves the bundles itself.
 *
 * That second job is not optional. The bundles sit in `public/`, but the player reaches
 * them with a dynamic `import()`, and Astro's Vite answers module requests through its
 * own transform pipeline: it appends `?import`, re-parses a two-megabyte bundle it has no
 * business touching, and fails. Plugin middleware runs ahead of Vite's internal
 * middleware, so claiming the prefix here keeps these files the static artifacts they are.
 */
function bridgePlugin(animations: AnimationEntry[], base: string, outDir: string): Plugin {
  return {
    name: "canvas-commons:astro",
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined),
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      return `export const animations = ${JSON.stringify(animations)};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (!pathname?.startsWith(base)) return next();

        const file = path.join(outDir, decodeURIComponent(pathname.slice(base.length)));
        // `..` in the URL must not walk out of the output directory.
        if (!file.startsWith(outDir) || !fs.existsSync(file)) return next();

        res.setHeader("Content-Type", MIME[path.extname(file)] ?? "application/octet-stream");
        // The watching sub-build replaces these in place; a cached copy would hide edits.
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * Astro integration for [Canvas Commons](https://canvascommons.io) - the maintained
 * community fork of Motion Canvas - rendered by `@canvas-commons/player`.
 *
 * Canvas Commons projects cannot be compiled by Astro's own Vite: they need a JSX factory
 * of their own (`@canvas-commons/2d`), and the official plugin bundle includes an editor
 * that claims the dev server root. So each `*.project.ts(x)` under `src` is bundled by a
 * *separate*, self-contained Vite build into `public/<dir>/`, which Astro serves in dev
 * and copies into `dist/` on build. `<Animation src="hello" />` then points the player's
 * `src` at the resulting URL.
 *
 * In dev the sub-build stays in watch mode, so editing a scene rebuilds the bundle; the
 * page still needs a reload, since the player has no HMR channel.
 */
export function canvasCommons(options: CanvasCommonsOptions = {}): AstroIntegration {
  const { roots = ["."], dir = "_canvas" } = options;
  let watcher: RollupWatcher | null = null;

  return {
    name: PKG_NAME,
    hooks: {
      "astro:config:setup": async ({ config, command, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const srcDir = fileURLToPath(config.srcDir);

        const projectFiles = roots.flatMap((r) => findProjects(path.resolve(srcDir, r)));
        // The plugin parses these paths itself, relative to the working directory.
        const relToCwd = projectFiles.map((file) => posix(path.relative(process.cwd(), file)));

        // `config.base` always has a leading slash and no trailing one (except for "/").
        const base = `${config.base.replace(/\/$/, "")}/${dir}/`;
        const outDir = path.join(root, "public", dir);

        const animations: AnimationEntry[] = projectFiles.map((file) => {
          const id = posix(path.relative(srcDir, file)).replace(PROJECT_SUFFIX, "");
          return { id, url: `${base}${id}.js`, ...readSize(file) };
        });

        updateConfig({
          vite: {
            plugins: [bridgePlugin(animations, base, outDir)],
            // The player is only ever reached through a dynamic import, so Vite's startup
            // crawl doesn't find it and instead discovers it mid-request, on the first
            // visit to a page with an animation. It then re-bundles and force-reloads,
            // and whatever was in flight fails with "504 Outdated Optimize Dep" - which,
            // when the loser is the player itself, leaves the animation dead until the
            // next reload. Naming it here gets it bundled before the server accepts
            // requests, so that race never starts.
            optimizeDeps: { include: ["@canvas-commons/player"] },
          },
        });

        // Emptied here rather than by Vite: in watch mode `emptyOutDir` runs on every
        // rebuild, leaving a window where a reader's request for the bundle 404s.
        fs.rmSync(outDir, { recursive: true, force: true });
        if (projectFiles.length === 0) return;

        // Entry chunks are named by the plugin; map them back onto our ids so the URLs
        // stay predictable instead of mirroring the working directory layout.
        const idByEntryName = new Map(
          projectFiles.map((file, i) => [pluginEntryName(relToCwd[i]), animations[i].id]),
        );

        const isDev = command === "dev";
        const result = await build({
          configFile: false,
          root,
          base,
          mode: isDev ? "development" : "production",
          logLevel: "warn",
          // Vite's own public-dir copying would duplicate `public/` into `public/_canvas/`.
          publicDir: false,
          // Vite 7 transforms TSX with esbuild, which the plugin doesn't configure (it
          // only sets the rolldown/oxc equivalent). Scoped to this build, so Astro's JSX
          // is untouched.
          esbuild: { jsx: "automatic", jsxImportSource: "@canvas-commons/2d" },
          plugins: [
            canvasCommonsPlugin({
              project: relToCwd,
              buildForEditor: false,
              // `@canvas-commons/editor` is only needed to author animations, and the
              // plugin resolves it eagerly even though nothing here renders an editor.
              // Pointing at a stub keeps it out of the production dependency set.
              editor: fileURLToPath(new URL("integration/canvascommons/editor-stub/index.js", config.srcDir)),
            }),
          ],
          build: {
            outDir,
            emptyOutDir: false,
            minify: !isDev,
            // The plugin's own transforms don't carry source maps through, so rollup
            // warns about it on every rebuild and what comes out can't be trusted
            // anyway - not worth doubling the write on a multi-megabyte bundle.
            sourcemap: false,
            // A Canvas Commons runtime is ~2MB before gzip; that is the price of the
            // library, not a mistake to warn about on every build.
            chunkSizeWarningLimit: 4000,
            watch: isDev ? {} : null,
            rollupOptions: {
              output: {
                entryFileNames: (chunk) => `${idByEntryName.get(chunk.name) ?? chunk.name}.js`,
                chunkFileNames: "chunks/[name].[hash].js",
                assetFileNames: "assets/[name].[hash][extname]",
              },
            },
          },
        });

        const count = `${projectFiles.length} animation${projectFiles.length > 1 ? "s" : ""}`;
        if (isDev) {
          watcher = result as RollupWatcher;
          await firstBuild(watcher, logger);
          logger.info(`watching ${count}`);
        } else {
          logger.info(`bundled ${count} into ${posix(path.relative(root, outDir))}`);
        }
      },

      "astro:server:done": async () => {
        await watcher?.close();
        watcher = null;
      },
    },
  };
}

/** Resolves once the watching build has produced its first bundle. */
function firstBuild(watcher: RollupWatcher, logger: { error: (msg: string) => void }): Promise<void> {
  return new Promise((resolve) => {
    watcher.on("event", (event: RollupWatcherEvent) => {
      if (event.code === "END") resolve();
      if (event.code === "ERROR") {
        logger.error(event.error.message);
        resolve(); // a broken scene shouldn't hold up the dev server
      }
    });
  });
}
