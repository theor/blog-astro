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
};

/** Above this many token pairs, skip matching and just fade - the LCS is O(n*m). */
const MAX_DIFF_CELLS = 250_000;

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

/** Leaf elements inside the code block - i.e. the individual syntax token spans. */
export function tokensOf(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>("pre :not(:has(*))"));
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
  const fromSnapshots = tokensOf(from).map(toSnapshot);
  const toElements = tokensOf(to);
  const toSnapshots = toElements.map(toSnapshot);

  const pairs = matchTokens(
    fromSnapshots.map((s) => s.content),
    toSnapshots.map((s) => s.content),
  );

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
