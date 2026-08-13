/**
 * Shiki transformer that renders the annotations parsed by annotations.ts.
 *
 * The remark plugin strips the `// !mark(...)` comments and encodes the resulting ranges
 * into the fence meta; Astro forwards that meta to shiki as `meta.__raw` (see
 * @astrojs/internal-helpers/dist/shiki.js), which is what we read back here.
 */

import { decodeAnnotations } from "./annotations";

/** Minimal structural types - shiki is only a transitive dependency here. */
type HastProperties = Record<string, unknown>;
interface HastElement {
  properties: HastProperties;
}
interface TransformerContext {
  options?: { meta?: { __raw?: string } };
}
interface ThemedToken {
  content: string;
}
export interface CodeTransformer {
  name: string;
  pre?: (this: TransformerContext, node: HastElement) => void;
  line?: (this: TransformerContext, node: HastElement, line: number) => void;
  span?: (
    this: TransformerContext,
    node: HastElement,
    line: number,
    col: number,
    lineElement: HastElement,
    token: ThemedToken,
  ) => void;
}

const addClass = (node: HastElement, className: string) => {
  const current = node.properties.class;
  const existing = Array.isArray(current) ? current.join(" ") : String(current ?? "");
  node.properties.class = `${existing} ${className}`.trim();
};

export function markTransformer(): CodeTransformer {
  return {
    name: "scrollycoding:mark",

    // Runs after `line`/`span`, so it can only be used for block-level flags.
    pre(node) {
      if (!decodeAnnotations(this.options?.meta?.__raw)) return;

      node.properties["data-ch-marked"] = "true";

      // `shikiConfig.wrap: true` is global and wrapped code reads badly in the narrow
      // sticky panel, so opt annotated blocks back out of wrapping.
      const style = String(node.properties.style ?? "");
      node.properties.style = style
        .replace(/white-space:\s*pre-wrap;?/g, "")
        .replace(/word-wrap:\s*break-word;?/g, "")
        .trim();
    },

    line(node, line) {
      if (decodeAnnotations(this.options?.meta?.__raw)?.lines.has(line)) {
        addClass(node, "ch-mark");
      }
    },

    /**
     * Inline ranges, from regex queries like `// !mark[/home_axis/]`.
     *
     * lighter reports 1-based inclusive columns; shiki gives a 0-based `col` for the
     * token start. Marking is whole-token: a token that merely overlaps the range gets
     * marked rather than being split, which keeps this inside the stock shiki pipeline.
     */
    span(node, line, col, _lineElement, token) {
      const annotations = decodeAnnotations(this.options?.meta?.__raw);
      if (!annotations?.inline.length) return;

      const from = col + 1;
      const to = col + token.content.length;

      for (const range of annotations.inline) {
        if (range.line === line && from <= range.to && to >= range.from) {
          addClass(node, "ch-mark-inline");
          return;
        }
      }
    },
  };
}
