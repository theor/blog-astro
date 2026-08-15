/**
 * Token transitions between code panels.
 *
 * Ported from Code Hike's packages/codehike/src/utils/token-transitions.tsx. Swapping
 * panels by fading looks like a flash; instead we FLIP the individual syntax tokens:
 * tokens present in both the outgoing and incoming code slide from where they were to
 * where they now are, and only genuinely new tokens fade in.
 *
 * Code Hike animates one <pre> whose content changes. Here every panel is already in the
 * DOM, overlapping in a single grid area, so both snapshots can be taken before the swap
 * - hidden panels still have layout.
 */

/**
 * Total budget the whole choreography is scaled into. Code Hike uses a flat 900ms, which
 * assumes swaps are deliberate and spaced out. Scroll fires them far faster than that,
 * and because added tokens are held at opacity 0 through their delay, a long budget
 * leaves the panel visibly half-empty and every interruption restarts it. The caller
 * scales this to the observed swap rate instead - see MIN/MAX below.
 */
export const MAX_TRANSITION_BUDGET = 900;
export const MIN_TRANSITION_BUDGET = 180;

const config = {
  moveDuration: 0.28,
  addDuration: 0.22,
  fadeDuration: 0.3,
};

/** Above this many token pairs, skip matching and just fade - the LCS is O(n*m). */
const MAX_DIFF_CELLS = 250_000;

/**
 * Minimum share of visible characters two blocks must have in common before their tokens
 * are treated as the same code moving. Below it they are different code that happens to
 * be in the same panel - another file, or another part of the same one - and get a plain
 * dissolve instead.
 *
 * Measured over every consecutive pair in the demo post and the plasma article: unrelated
 * pairs score 0.05-0.11, genuine edits 0.41-1.00. Nothing lands between, so the exact
 * value is not delicate; this sits ~2x clear of the top of the first band.
 */
const RELATED_THRESHOLD = 0.25;

interface Snapshot {
  x: number;
  y: number;
  color: string;
  content: string | null;
}

interface Flip {
  element: HTMLElement;
  first: Snapshot | null;
  last: Snapshot;
}

/**
 * Leaf elements inside the code block - i.e. the individual syntax token spans.
 * Callout chrome is excluded: it is decoration, not code, and its arrow would otherwise
 * be matched as an empty token and add noise to the diff.
 */
export function tokensOf(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>("pre :not(:has(*))")).filter(
    (el) => !el.closest(".ch-callout"),
  );
}

function toSnapshot(el: HTMLElement): Snapshot {
  // Offset accumulation rather than getBoundingClientRect: it reports the *layout*
  // position, which is unaffected by the sticky panel's visual shift.
  let x = 0;
  let y = 0;
  let node = el as HTMLElement | null;
  while (node) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  // Cancel in-flight animations so rapid swaps measure resting positions.
  el.getAnimations().forEach((a) => a.cancel());

  return { x, y, color: getComputedStyle(el).color, content: el.textContent };
}

/**
 * Longest common subsequence over token text, returning matched [oldIndex, newIndex]
 * pairs. Stands in for Code Hike's `diffArrays` from the `diff` package.
 */
function matchTokens(a: (string | null)[], b: (string | null)[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_DIFF_CELLS) return [];

  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)]);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

const inkLength = (text: string | null) => (text ?? "").replace(/\s/g, "").length;

/**
 * How much of the larger block the two have in common, as a fraction of visible
 * characters along the LCS.
 *
 * Weighted by characters rather than by token count on purpose: indentation runs, `let `,
 * `;` and `}` match between any two files of the same language, and counting them equally
 * with real identifiers pulls unrelated pairs up near genuine edits. On the same sample,
 * scoring by token count narrows the gap between the two bands from 4x to 2x.
 */
function similarity(
  from: (string | null)[],
  to: (string | null)[],
  pairs: Array<[number, number]>,
): number {
  const sum = (list: (string | null)[]) => list.reduce((n, text) => n + inkLength(text), 0);
  const total = Math.max(sum(from), sum(to));
  if (total === 0) return 1;
  return pairs.reduce((n, [fromIndex]) => n + inkLength(from[fromIndex]), 0) / total;
}

/**
 * Dissolve one panel into the other, for when there is no shared code to carry the eye.
 *
 * Only the incoming panel actually fades. Fading both would cross a point where neither
 * is opaque and the page shows through the pair - with the standard ease pair that dip
 * bottoms out around 10%, which reads as a flicker. Instead the outgoing panel is *held*
 * at full opacity underneath while the incoming one, raised above it by the
 * [data-selected] z-index in ScrollyPanel.astro, comes up over it. `fill: none` then drops
 * it back to the stylesheet's opacity:0 the instant the animation ends, by which point the
 * panel on top covers it completely.
 *
 * This works because every panel is opaque and equalizeHeights has pinned them to a common
 * height, so the one above fully covers the one below.
 */
function crossfade(from: HTMLElement, to: HTMLElement, budget: number): Animation[] {
  const duration = config.fadeDuration * budget;
  return [
    from.animate({ opacity: [1, 1] }, { duration, fill: "none" }),
    to.animate({ opacity: [0, 1] }, { duration, easing: "ease-in-out", fill: "both" }),
  ];
}

/**
 * Bin flips into runs of added and moved tokens. Consecutive tokens moving the same
 * direction are grouped so they can be staggered together; backwards-moving runs go
 * first, forwards-moving runs are reversed, which is what makes the motion read as text
 * reflowing rather than as noise.
 */
function groupFlips(flips: Flip[]): { added: Flip[][]; moved: Flip[][] } {
  const added: Flip[][] = [];
  const forwards: Flip[][] = [];
  const backwards: Flip[][] = [];
  let lastBin: Flip[][] | null = null;

  for (const flip of flips) {
    const { first, last } = flip;
    let bin: Flip[][] | null = null;

    if (!first) {
      bin = added;
    } else if (first.x === last.x && first.y === last.y) {
      bin = null; // unchanged
    } else {
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      bin = dy > 0 || (dy === 0 && dx > 0) ? backwards : forwards;
    }

    if (bin && bin !== lastBin) bin.push([flip]);
    else if (bin) bin[bin.length - 1].push(flip);

    lastBin = bin;
  }

  forwards.reverse();
  return { added, moved: [...backwards, ...forwards] };
}

const fullStaggerDuration = (count: number, single: number) =>
  count === 0 ? 0 : 2 * single * (1 - 1 / (1 + count));

const staggerDelay = (i: number, n: number, duration: number, single: number) =>
  i === 0 ? 0 : (i / (n - 1)) * (duration - single);

function animate(
  element: HTMLElement,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  duration: number,
  delay: number,
  easing: string,
  budget: number,
): Animation {
  return element.animate(keyframes, {
    duration: duration * budget,
    delay: delay * budget,
    easing,
    fill: "both",
  });
}

/**
 * Animate the incoming panel's tokens from the outgoing panel's layout. Both panels must
 * already be laid out; call this immediately after flipping the selection.
 *
 * Returns the animations it started so the caller can cancel them if another swap
 * arrives before they settle.
 */
export function transitionTokens(
  from: HTMLElement,
  to: HTMLElement,
  budget: number = MAX_TRANSITION_BUDGET,
): Animation[] {
  const fromElements = tokensOf(from);
  const toElements = tokensOf(to);

  // Contents first: matching is decided on text alone, and the unrelated case can then
  // skip snapshotting entirely - it is the getComputedStyle in toSnapshot that costs.
  const fromContent = fromElements.map((el) => el.textContent);
  const toContent = toElements.map((el) => el.textContent);
  const pairs = matchTokens(fromContent, toContent);

  // `matchTokens` also returns [] for oversized blocks, so those land here too - the plain
  // fade MAX_DIFF_CELLS was always meant to fall back to.
  if (similarity(fromContent, toContent, pairs) < RELATED_THRESHOLD) {
    return crossfade(from, to, budget);
  }

  const fromSnapshots = fromElements.map(toSnapshot);
  const toSnapshots = toElements.map(toSnapshot);

  const firstOf = new Map<number, Snapshot>();
  for (const [oldIndex, newIndex] of pairs) firstOf.set(newIndex, fromSnapshots[oldIndex]);

  const flips: Flip[] = toElements.map((element, index) => ({
    element,
    first: firstOf.get(index) ?? null,
    last: toSnapshots[index],
  }));

  const { added, moved } = groupFlips(flips);
  const moveDuration = fullStaggerDuration(moved.length, config.moveDuration);
  const animations: Animation[] = [];

  moved.forEach((group, groupIndex) => {
    const delay = staggerDelay(groupIndex, moved.length, moveDuration, config.moveDuration);
    for (const { element, first, last } of group) {
      const dx = first!.x - last.x;
      const dy = first!.y - last.y;
      animations.push(
        animate(
          element,
          {
            translate: [`${dx}px ${dy}px`, "0px 0px"],
            color: [first!.color, last.color],
          },
          config.moveDuration,
          delay,
          "ease-in-out",
          budget,
        ),
      );
    }
  });

  const addedFlips = added.flat();
  const addDuration = fullStaggerDuration(addedFlips.length, config.addDuration);
  addedFlips.forEach((flip, index) => {
    const delay =
      moveDuration + staggerDelay(index, addedFlips.length, addDuration, config.addDuration);
    animations.push(
      animate(flip.element, { opacity: [0, 1] }, config.addDuration, delay, "ease-out", budget),
    );
  });

  return animations;
}
