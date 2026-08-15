# canvascommons

Embeds [Canvas Commons](https://canvascommons.io) animations - the maintained community
fork of Motion Canvas - in posts, played by `@canvas-commons/player`.

## Adding an animation

1. Write a scene and a project anywhere under `src/`:

   ```
   src/animations/hello.project.ts     <- makeProject({scenes: [...]})
   src/animations/scenes/hello.tsx     <- makeScene2D(function* (view) {...})
   ```

   The `.project.ts` suffix is what makes a file an entry point. Its path under `src/`,
   minus that suffix, is the animation's id: `animations/hello`.

2. Drop it into a post. `Animation` is auto-imported through `src/content/_autoimports.ts`,
   and the file name alone works as long as it is unambiguous:

   ```mdx
   <Animation src="hello" caption="What it looks like" />
   ```

3. `yarn canvas` opens the editor on http://localhost:9000 to scrub the timeline, inspect
   nodes and render video. It saves to the `.meta` files next to the project and its
   scenes - commit those; the integration reads the project's resolution back out of them
   to size the embed.

`<Animation>` takes `width`/`height` (rendering resolution), `quality` (resolution scale,
e.g. `0.5`), `auto` (`true`, or `"hover"` to play while the pointer is over it),
`variables`, `eager`, `caption` and `class`.

## How it works

Canvas Commons projects can't go through Astro's own Vite: they need their own JSX factory
(`@canvas-commons/2d`), and the official plugin bundle ships an editor that claims the dev
server root. So `index.ts` runs a *second*, self-contained Vite build - the real
`@canvas-commons/vite-plugin`, `buildForEditor: false` - over every `*.project.ts(x)` it
finds, writing bundles to `public/_canvas/` (gitignored, rebuilt on every start; in dev it
stays in watch mode, so editing a scene rebuilds the bundle and a page reload picks it up).
The *list* of projects is fixed when the dev server starts, though - a brand new
`*.project.ts` needs a restart before it can be embedded.

Several animations on a page share one runtime chunk, so the couple of megabytes is paid
once per page rather than once per animation.

`Animation.astro` reads the resulting manifest from a virtual module and points the
player's `src` at the bundle. Two details worth knowing before changing that file:

- The bundle is fetched only once the animation nears the viewport - it is a couple of
  megabytes. `player.client.ts` holds the URL in `data-src` until then.
- `quality`, `width` and `height` are applied *after* the project loads. The player's own
  attribute handler dereferences state that doesn't exist yet if they arrive earlier.
