/**
 * Shiki transformer implementing `!mark` line highlighting for scrollycoding panels.
 *
 * The remark plugin strips `// !mark(...)` comments out of the code and encodes the
 * resulting line numbers into the fence meta as `ch-mark=1,3:5`. Astro forwards that
 * meta to shiki as `meta.__raw` (see @astrojs/internal-helpers/dist/shiki.js), which is
 * what we read back here.
 */

export const MARK_META_KEY = "ch-mark";

/** Minimal structural types - shiki is only a transitive dependency here. */
type HastProperties = Record<string, unknown>;
interface HastElement {
  properties: HastProperties;
}
interface TransformerContext {
  options?: { meta?: { __raw?: string } };
}
export interface CodeTransformer {
  name: string;
  pre?: (this: TransformerContext, node: HastElement) => void;
  line?: (this: TransformerContext, node: HastElement, line: number) => void;
}

const cache = new Map<string, Set<number> | null>();

/** `ch-mark=1,3:5` -> {1,3,4,5}. Returns null when the block carries no marks. */
export function parseMarkRanges(raw?: string): Set<number> | null {
  if (!raw) return null;
  if (cache.has(raw)) return cache.get(raw)!;

  const match = raw.match(new RegExp(`\\b${MARK_META_KEY}=([\\d,:]+)`));
  let lines: Set<number> | null = null;

  if (match) {
    lines = new Set<number>();
    for (const part of match[1].split(",")) {
      if (!part) continue;
      const [start, end] = part.split(":").map(Number);
      if (!Number.isFinite(start)) continue;
      const last = Number.isFinite(end) ? end : start;
      for (let i = start; i <= last; i++) lines.add(i);
    }
    if (lines.size === 0) lines = null;
  }

  cache.set(raw, lines);
  return lines;
}

const addClass = (node: HastElement, className: string) => {
  const current = node.properties.class;
  const existing = Array.isArray(current) ? current.join(" ") : String(current ?? "");
  node.properties.class = `${existing} ${className}`.trim();
};

export function markTransformer(): CodeTransformer {
  return {
    name: "scrollycoding:mark",

    // Runs after `line`, so it can only be used for block-level flags.
    pre(node) {
      const marks = parseMarkRanges(this.options?.meta?.__raw);
      if (!marks) return;

      node.properties["data-ch-marked"] = "true";

      // `shikiConfig.wrap: true` is global and wrapped code reads badly in the narrow
      // sticky panel, so opt marked blocks back out of wrapping.
      const style = String(node.properties.style ?? "");
      node.properties.style = style
        .replace(/white-space:\s*pre-wrap;?/g, "")
        .replace(/word-wrap:\s*break-word;?/g, "")
        .trim();
    },

    line(node, line) {
      const marks = parseMarkRanges(this.options?.meta?.__raw);
      if (marks?.has(line)) addClass(node, "ch-mark");
    },
  };
}
