/**
 * Scroll-driven step selection.
 *
 * Ported from Code Hike's packages/codehike/src/utils/scroller.tsx: a single
 * IntersectionObserver whose rootMargin collapses the viewport down to a ~4px band at
 * mid-height, so a step "intersects" only while it crosses that trigger line.
 */

import { transitionTokens } from "./tokenTransitions";

const TRIGGER = 0.5; // fraction of the viewport height

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  for (const pre of blocks) pre.style.minHeight = "";
  const tallest = Math.max(...blocks.map((pre) => pre.offsetHeight));
  for (const pre of blocks) pre.style.minHeight = `${tallest}px`;
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

  const select = (index: number) => {
    if (index === selected || index < 0 || index >= steps.length) return;

    const from = panels[selected];
    const to = panels[index];

    selected = index;
    root.dataset.selectedIndex = String(index);
    for (const list of [steps, panels]) {
      list.forEach((el, i) => el.setAttribute("data-selected", i === index ? "true" : "false"));
    }

    // Both panels are laid out either way (hidden panels keep their layout), so this
    // runs after the swap without needing to defer a frame.
    if (from && to && !prefersReducedMotion()) transitionTokens(from, to);
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

  equalizeHeights(panels);
  syncHeight();
  // Re-measure once everything has laid out: a late horizontal scrollbar shifts vh, and
  // web fonts can change the code block heights.
  window.addEventListener("load", () => {
    equalizeHeights(panels);
    syncHeight();
  });

  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      equalizeHeights(panels);
      syncHeight();
    });
  });

  steps.forEach((step, index) => {
    step.addEventListener("click", () => select(index));
  });
}

export function initScrollycoding() {
  document.querySelectorAll<HTMLElement>("[data-scrolly]").forEach(setup);
}
