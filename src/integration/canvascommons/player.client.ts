/**
 * Defers both the player runtime and the animation bundle until the element is close to
 * the viewport. A Canvas Commons bundle is a couple of megabytes, so loading one per
 * `<Animation>` on page load would cost more than the whole rest of the page.
 *
 * The element itself is inert until `src` is set, so leaving the URL in `data-src` and
 * moving it across on intersection is all the laziness needed.
 */

/** What `<canvas-commons-player>` exposes that we rely on beyond its attributes. */
type Player = HTMLElement & { state?: "initial" | "loading" | "ready" | "error" };

/**
 * Loaded once per page, however many animations it holds. A failure is *not* cached: in
 * dev a transient 504 from Vite's dependency optimizer would otherwise take down every
 * animation on the page until the next reload.
 */
let runtime: Promise<unknown> | null = null;
const loadRuntime = () =>
  (runtime ??= import("@canvas-commons/player").catch((error) => {
    runtime = null;
    throw error;
  }));

/**
 * `quality`, `width` and `height` are handled by the player's `updateSettings`, which
 * reads `this.player` and the project's default settings - both of which only exist once
 * a project has loaded. Setting them any earlier throws inside the element's own
 * attribute callback, so they wait here for the load to finish. The player applies its
 * own `updateSettings` on load, so nothing is lost by being late.
 */
function whenSettled(player: Player): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (player.state === "ready" || player.state === "error") resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Elements whose `start` is still in flight - the observer can fire again meanwhile. */
const starting = new WeakSet<Player>();

/** Resolves false if the runtime could not be loaded, leaving the element retryable. */
async function start(player: Player): Promise<boolean> {
  const src = player.dataset.src;
  if (!src) return true; // an earlier intersection already handed the URL over
  if (starting.has(player)) return false; // let the attempt in flight decide the outcome
  starting.add(player);

  try {
    await loadRuntime();
  } catch (error) {
    // `data-src` is deliberately still set, so a later intersection tries again.
    starting.delete(player);
    player.dataset.error = "";
    console.error("[canvas-commons] could not load the player runtime", error);
    return false;
  }

  delete player.dataset.src;
  delete player.dataset.error; // a retry succeeded
  // Setting `src` before the element upgrades is fine - the upgrade replays observed
  // attributes - but the runtime is loaded first so nothing depends on that ordering.
  player.setAttribute("src", src);

  const settings = player.dataset.settings;
  if (!settings) return true;
  delete player.dataset.settings;
  await whenSettled(player);
  for (const [name, value] of Object.entries(JSON.parse(settings))) {
    player.setAttribute(name, String(value));
  }
  return true;
}

export function initCanvasCommons() {
  const players = document.querySelectorAll<Player>("canvas-commons-player[data-src]");
  if (players.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    players.forEach(start);
    return;
  }

  // One screen of margin: the bundle is usually there by the time the reader arrives.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        start(entry.target as Player).then((done) => done && observer.unobserve(entry.target));
      }
    },
    { rootMargin: "100% 0px" },
  );

  for (const player of players) {
    if (player.dataset.eager !== undefined) start(player);
    else observer.observe(player);
  }
}
