/**
 * Shiki transformer that renders the annotations parsed by annotations.ts.
 *
 * The remark plugin strips the `// !mark(...)` comments and encodes the resulting ranges
 * into the fence meta; Astro forwards that meta to shiki as `meta.__raw` (see
 * @astrojs/internal-helpers/dist/shiki.js), which is what we read back here.
 *
 * Rendered annotations: `mark` (line and inline), `diff` (+/-), `hover` (code mentions),
 * plus the `-n` line-numbers flag.
 */

import { decodeAnnotations, type DecodedAnnotations } from "./annotations";

/** Minimal structural types - shiki is only a transitive dependency here. */
type HastProperties = Record<string, unknown>;
interface HastElement {
  properties: HastProperties;
}
interface TransformerContext {
  options?: { meta?: { __raw?: string } };
  tokens?: unknown[][];
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

/**
 * The gutter is composed here rather than in CSS: line numbers and the diff sign share
 * one `::before`, and building the string server-side keeps them aligned without
 * fighting over pseudo-elements.
 */
function gutterFor(
  annotations: DecodedAnnotations,
  line: number,
  totalLines: number,
  diffSign: string,
): string | null {
  const parts: string[] = [];
  if (annotations.numbers) parts.push(String(line).padStart(String(totalLines).length));
  // Reserve the sign column for every line in a block that uses diff, so the code stays
  // aligned between changed and unchanged lines.
  if (annotations.hasDiff) parts.push(diffSign || " ");
  return parts.length ? parts.join(" ") : null;
}

export function markTransformer(): CodeTransformer {
  return {
    name: "scrollycoding:mark",

    // Runs after `line`/`span`, so it can only be used for block-level flags.
    pre(node) {
      const annotations = decodeAnnotations(this.options?.meta?.__raw);
      if (!annotations) return;

      node.properties["data-ch-marked"] = "true";

      // `shikiConfig.wrap: true` is global. Wrapped code reads badly in the narrow sticky
      // panel, and a wrapped line would break gutter alignment, so opt back out.
      const style = String(node.properties.style ?? "");
      node.properties.style = style
        .replace(/white-space:\s*pre-wrap;?/g, "")
        .replace(/word-wrap:\s*break-word;?/g, "")
        .trim();
    },

    line(node, line) {
      const annotations = decodeAnnotations(this.options?.meta?.__raw);
      if (!annotations) return;

      let diffSign = "";

      for (const { name, query } of annotations.blocks.get(line) ?? []) {
        if (name === "mark") {
          addClass(node, "ch-mark");
        } else if (name === "diff") {
          diffSign = query === "-" ? "-" : "+";
          addClass(node, query === "-" ? "ch-diff-del" : "ch-diff-add");
        } else if (name === "hover") {
          // Read back by the client script to dim everything else while a matching
          // mention in the prose is hovered.
          node.properties["data-ch-line"] = query;
        }
      }

      const gutter = gutterFor(annotations, line, this.tokens?.length ?? line, diffSign);
      if (gutter !== null) node.properties["data-ch-gutter"] = gutter;
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
        if (range.name !== "mark") continue;
        if (range.line === line && from <= range.to && to >= range.from) {
          addClass(node, "ch-mark-inline");
          return;
        }
      }
    },
  };
}
