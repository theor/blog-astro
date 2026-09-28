/**
 * Scroll-driven step selection.
 *
 * Ported from Code Hike's packages/codehike/src/utils/scroller.tsx: a single
 * IntersectionObserver whose rootMargin collapses the viewport down to a ~4px band at
 * mid-height, so a step "intersects" only while it crosses that trigger line.
 */

import {
  transitionTokens,
  MAX_TRANSITION_BUDGET,
  MIN_TRANSITION_BUDGET,
} from "./tokenTransitions";

const TRIGGER = 0.5; // fraction of the viewport height

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The narrow layout shows every panel inline, so there is no selection to serve. */
const isNarrowLayout = () => window.matchMedia("(max-width: 60rem)").matches;

/**
 * Pin every code block to the height of the tallest one. All panels overlap in a single
 * grid area, so without this the dark frame resizes on each swap and the token animation
 * reads as a jump.
 */
function equalizeHeights(panels: HTMLElement[]) {
  const blocks = panels
    .map((panel) => panel.querySelector<HTMLElement>("pre"))
    .filter((pre): pre is HTMLElement => pre !== null);
  if (blocks.length === 0) return;

  // Cleared first so a resize back to narrow releases the pin, not just so the natural
  // heights below are measurable.
  for (const pre of blocks) pre.style.minHeight = "";
  // Stacked panels have no shared frame to keep steady and no animation to protect, so
  // pinning there only pads every short block out to the tallest one - on the layout
  // with the least vertical room to spare.
  if (isNarrowLayout()) return;

  const tallest = Math.max(...blocks.map((pre) => pre.offsetHeight));
  for (const pre of blocks) pre.style.minHeight = `${tallest}px`;
}

/**
 * The last step can only be selected if the page can scroll far enough for it to reach
 * the trigger line, which needs `(1 - TRIGGER) * vh` of document below its top. Whatever
 * follows the block already counts towards that - trailing prose, another block, the
 * footer, the block's own base padding - so only add the shortfall rather than a
 * blanket 60vh of dead space.
 */
function updateTailSpacer(root: HTMLElement, steps: HTMLElement[], vh: number) {
  root.style.setProperty("--scrolly-tail", "0px");
  if (isNarrowLayout() || vh < 8) return;

  const lastStep = steps[steps.length - 1];
  const lastStepTop = lastStep.getBoundingClientRect().top + window.scrollY;
  const available = document.documentElement.scrollHeight - lastStepTop;
  const needed = (1 - TRIGGER) * vh + 8; // 8px covers the trigger band and rounding

  const shortfall = Math.max(0, Math.ceil(needed - available));
  if (shortfall > 0) root.style.setProperty("--scrolly-tail", `${shortfall}px`);
}

function setup(root: HTMLElement) {
  if (root.dataset.scrollyReady) return;
  root.dataset.scrollyReady = "1";

  const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-scrolly-step]"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-scrolly-panel]"));
  if (steps.length === 0) return;

  const ratios = new Map<number, number>();
  let selected = 0;
  let vh = 0;
  let observer: IntersectionObserver | null = null;
  let inFlight: Animation[] = [];
  let lastSwapAt = 0;

  const select = (index: number) => {
    if (index === selected || index < 0 || index >= steps.length) return;

    const from = panels[selected];
    const to = panels[index];

    // Clear anything still in flight before measuring. Added tokens are held at opacity 0
    // through their delay, so a leftover animation would keep part of the panel invisible.
    for (const animation of inFlight) animation.cancel();
    inFlight = [];

    selected = index;
    root.dataset.selectedIndex = String(index);
    for (const list of [steps, panels]) {
      list.forEach((el, i) => el.setAttribute("data-selected", i === index ? "true" : "false"));
    }

    // The token FLIP only makes sense when one panel replaces another in the same grid
    // area. On the narrow layout every panel is already on screen, so animating the
    // incoming one just makes a block the reader is looking at shuffle itself - and it
    // pays for an LCS over every token to do it.
    if (!from || !to || prefersReducedMotion() || isNarrowLayout()) return;

    // Scale the choreography to how fast selections are actually arriving: a deliberate
    // click gets the full animation, a fast scroll gets a short one that finishes before
    // the next swap instead of being restarted half-done.
    const now = performance.now();
    const sinceLast = lastSwapAt === 0 ? Infinity : now - lastSwapAt;
    lastSwapAt = now;
    const budget = Math.min(MAX_TRANSITION_BUDGET, Math.max(MIN_TRANSITION_BUDGET, sinceLast));

    // Both panels are laid out either way (hidden panels keep their layout), so this
    // runs after the swap without needing to defer a frame.
    inFlight = transitionTokens(from, to, budget);
  };

  const onIntersect: IntersectionObserverCallback = (entries) => {
    let entering = -1;

    for (const entry of entries) {
      const index = Number((entry.target as HTMLElement).dataset.index);
      ratios.set(index, entry.intersectionRatio);
      if (entry.intersectionRatio > 0) entering = index;
    }

    if (entering >= 0) {
      select(entering);
      return;
    }

    // Nothing is on the trigger line - happens on a fast flick scroll. Fall back to
    // whichever step got closest.
    let best = -1;
    let bestRatio = 0;
    ratios.forEach((ratio, index) => {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = index;
      }
    });
    if (best >= 0) select(best);
  };

  const build = () => {
    observer?.disconnect();
    if (vh < 8) return;

    const y = vh * TRIGGER;
    observer = new IntersectionObserver(onIntersect, {
      root: null,
      threshold: 0.000001,
      rootMargin: `-${y - 2}px 0px -${vh - y - 2}px`,
    });
    for (const step of steps) observer.observe(step);
  };

  // clientHeight excludes the scrollbar, which is what the rootMargin math assumes.
  const syncHeight = () => {
    const next = document.documentElement.clientHeight;
    if (next === vh) return;
    vh = next;
    build();
  };

  // Order matters: equalising the panels changes the document height, which the tail
  // spacer is measured against.
  const refresh = () => {
    equalizeHeights(panels);
    syncHeight();
    updateTailSpacer(root, steps, vh);
  };

  refresh();
  // Re-measure once everything has laid out: a late horizontal scrollbar shifts vh, and
  // web fonts and images change the heights the spacer depends on.
  window.addEventListener("load", refresh);

  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(refresh);
  });

  steps.forEach((step, index) => {
    step.addEventListener("click", () => select(index));
  });

  /* Code mentions: hovering `[text](hover:name)` in a step's prose dims every line of
     its panel that isn't tagged `// !hover name`. Selecting the step first means a
     mention still works when its panel isn't the one on screen. */
  const dim = (panel: HTMLElement, name: string | null) => {
    for (const line of panel.querySelectorAll<HTMLElement>("pre .line")) {
      line.classList.toggle("ch-dim", name !== null && line.dataset.chLine !== name);
    }
  };

  steps.forEach((step, index) => {
    const panel = panels[index];
    if (!panel) return;

    for (const mention of step.querySelectorAll<HTMLElement>("[data-ch-hover]")) {
      const name = mention.dataset.chHover ?? "";
      mention.addEventListener("mouseenter", () => {
        select(index);
        dim(panel, name);
      });
      mention.addEventListener("mouseleave", () => dim(panel, null));
    }
  });
}

export function initScrollycoding() {
  document.querySelectorAll<HTMLElement>("[data-scrolly]").forEach(setup);
}
