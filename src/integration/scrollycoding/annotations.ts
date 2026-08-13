/**
 * Annotation parsing, on top of @code-hike/lighter's `extractAnnotations`.
 *
 * This is the hybrid half of the highlighting story: lighter parses the annotation
 * comments (it is language-aware, so it knows each grammar's comment syntax), while
 * Astro's own shiki still does the actual highlighting. The parsed ranges are encoded
 * into the code fence's meta, which Astro forwards to shiki as `meta.__raw`, where
 * markTransformer.ts turns them back into classes.
 *
 * The extractor regex and the start/end pairing are ported from Code Hike's
 * packages/codehike/src/code/extract-annotations.tsx.
 */

import { extractAnnotations, LANG_NAMES } from "@code-hike/lighter";

const PREFIX = "!";
const START_MARKER = "\0start\0";
const END_MARKER = "\0end\0";

/** Annotation names we can actually render. Anything else warns rather than vanishing. */
export const SUPPORTED = new Set(["mark", "diff", "hover", "focus", "callout"]);

export const META_KEY = "ch-ann";
/** Meta flag opting a block into line numbers (` ```rust ! main.rs -n `). */
export const NUMBERS_FLAG = "ch-num";

interface MultiLineRange {
  fromLineNumber: number;
  toLineNumber: number;
}
interface InlineRange {
  lineNumber: number;
  fromColumn: number;
  toColumn: number;
}
type CodeRange = MultiLineRange | InlineRange;

interface RawAnnotation {
  name: string;
  query?: string;
  ranges: CodeRange[];
}

const isInline = (r: CodeRange): r is InlineRange => "lineNumber" in r;

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Turns a comment body into `{name, rangeString, query}`. Handles `!name`,
 * `!name(n)`, `!name(a:b)`, `!name[/regex/]` and `!name(start)` / `!name(end)`.
 */
function extractor(comment: string) {
  const body = "(?:\\\\.|[^\\\\/])+";
  const nestedBracket = new RegExp(`\\s*(${PREFIX}?[\\w-]+)?(\\[\\/${body}\\/[a-zA-Z]*\\])(.*)$`);
  const nestedParen = new RegExp(`\\s*(${PREFIX}?[\\w-]+)?(\\(\\/${body}\\/[a-zA-Z]*\\))(.*)$`);
  const plain = new RegExp(`\\s*(${PREFIX}?[\\w-]+)?(\\([^\\)]*\\)|\\[[^\\]]*\\])?(.*)$`);

  const match = comment.match(nestedBracket) || comment.match(nestedParen) || comment.match(plain);
  if (!match) return null;

  const name = match[1];
  let rangeString = match[2];
  let query = match[3]?.trim() ?? "";
  if (!name || !name.startsWith(PREFIX)) return null;

  // `(start)`/`(end)` are paired up afterwards; mark them so they survive extraction.
  if (rangeString === "(start)") {
    query = START_MARKER + query;
    rangeString = "(1)";
  } else if (rangeString === "(end)") {
    query = END_MARKER + query;
    rangeString = "(1)";
  }

  return { name: name.slice(PREFIX.length), rangeString, query };
}

const lineOf = (range: CodeRange) => (isInline(range) ? range.lineNumber : range.fromLineNumber);

/** Pairs `!name(start)` / `!name(end)` markers into single spanning ranges. */
function pairStartEnd(annotations: RawAnnotation[], warn: (msg: string) => void): RawAnnotation[] {
  const stacks = new Map<string, Array<{ name: string; query: string; line: number; order: number }>>();
  const ordered: Array<{ order: number; annotation: RawAnnotation }> = [];

  for (const [order, a] of annotations.entries()) {
    const q = a.query ?? "";

    if (q.startsWith(START_MARKER)) {
      const stack = stacks.get(a.name) ?? [];
      stack.push({ name: a.name, query: q.slice(START_MARKER.length), line: lineOf(a.ranges[0]), order });
      stacks.set(a.name, stack);
      continue;
    }

    if (q.startsWith(END_MARKER)) {
      const start = stacks.get(a.name)?.pop();
      if (!start) {
        warn(`unmatched !${a.name}(end)`);
        continue;
      }
      const toLineNumber = lineOf(a.ranges[0]) - 1;
      if (toLineNumber < start.line) {
        warn(`empty !${start.name}(start)/(end) range`);
        continue;
      }
      ordered.push({
        order: start.order,
        annotation: {
          name: start.name,
          query: start.query,
          ranges: [{ fromLineNumber: start.line, toLineNumber }],
        },
      });
      continue;
    }

    ordered.push({ order, annotation: a });
  }

  if (ordered.length === annotations.length) return annotations;

  for (const stack of stacks.values()) {
    for (const start of stack) warn(`unmatched !${start.name}(start)`);
  }

  ordered.sort((a, b) => a.order - b.order);
  return ordered.map((e) => e.annotation);
}

/**
 * Strip annotation comments out of `code` and return the ranges they described.
 * Falls back to leaving the code untouched if the language is unknown to lighter.
 */
export async function extractCodeAnnotations(
  code: string,
  lang: string | null | undefined,
  warn: (msg: string) => void,
): Promise<{ code: string; annotations: RawAnnotation[] }> {
  // Cheap bail-out: no `!word` anywhere means no annotations, and skipping the call
  // avoids loading a TextMate grammar for the majority of code blocks.
  if (!/!\w/.test(code)) return { code, annotations: [] };

  const language = lang && LANG_NAMES.includes(lang as never) ? lang : null;
  if (!language) {
    warn(`unknown language "${lang}" - annotations left as-is`);
    return { code, annotations: [] };
  }

  try {
    const result = await extractAnnotations(code, language as never, extractor);
    const annotations = pairStartEnd(result.annotations as RawAnnotation[], warn);

    // An annotation comment that was consumed but matched nothing would otherwise
    // disappear without a trace. The usual cause is a regex query whose target is not on
    // the line directly below it - that is the only line a query searches.
    if (result.code !== code && annotations.length === 0) {
      warn("annotation comment was removed but matched nothing (a `[/regex/]` query only searches the line directly below it)");
    }

    return { code: result.code, annotations };
  } catch (error) {
    warn(`could not parse annotations: ${(error as Error).message}`);
    return { code, annotations: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* Meta encoding - the channel from remark through to the shiki transformer     */
/* -------------------------------------------------------------------------- */

/**
 * Entries are `name:from-to` for a line range and `name:line@from-to` for an inline one
 * (1-based, inclusive), with an optional `:query` suffix carrying the annotation's
 * argument - `+`/`-` for diff, the group name for hover.
 *
 * The query is percent-encoded, which is what makes `:` safe as the separator:
 * encodeURIComponent always escapes it, so it can never appear inside a query.
 */
export function encodeMeta(annotations: RawAnnotation[], flags: { numbers?: boolean }): string | null {
  const parts: string[] = [];

  for (const annotation of annotations) {
    if (!SUPPORTED.has(annotation.name)) continue;

    for (const range of annotation.ranges) {
      const where = isInline(range)
        ? `${range.lineNumber}@${range.fromColumn}-${range.toColumn}`
        : `${range.fromLineNumber}-${range.toLineNumber}`;
      const query = annotation.query ? `:${encodeURIComponent(annotation.query)}` : "";
      parts.push(`${annotation.name}:${where}${query}`);
    }
  }

  const tokens: string[] = [];
  if (parts.length) tokens.push(`${META_KEY}=${parts.join(",")}`);
  if (flags.numbers) tokens.push(NUMBERS_FLAG);

  return tokens.length ? tokens.join(" ") : null;
}

export interface LineAnnotation {
  name: string;
  query: string;
}
export interface InlineAnnotation extends LineAnnotation {
  line: number;
  from: number;
  to: number;
}
export interface DecodedAnnotations {
  /** line number -> annotations covering it */
  blocks: Map<number, LineAnnotation[]>;
  inline: InlineAnnotation[];
  numbers: boolean;
  hasDiff: boolean;
  /** When set, every line that isn't focused is dimmed. */
  hasFocus: boolean;
}

const BLOCK_RANGE = /^(\d+)-(\d+)$/;
const INLINE_RANGE = /^(\d+)@(\d+)-(\d+)$/;
const cache = new Map<string, DecodedAnnotations | null>();

/** Reads back what `encodeMeta` wrote. */
export function decodeAnnotations(raw: string | undefined): DecodedAnnotations | null {
  if (!raw) return null;
  if (cache.has(raw)) return cache.get(raw)!;

  const blocks = new Map<number, LineAnnotation[]>();
  const inline: InlineAnnotation[] = [];
  const numbers = new RegExp(`\\b${NUMBERS_FLAG}\\b`).test(raw);
  let hasDiff = false;
  let hasFocus = false;

  const match = raw.match(new RegExp(`\\b${META_KEY}=([^\\s]+)`));
  if (match) {
    for (const entry of match[1].split(",")) {
      const [name, where, ...rest] = entry.split(":");
      if (!name || !where || !SUPPORTED.has(name)) continue;
      const query = rest.length ? decodeURIComponent(rest.join(":")) : "";

      const inlineMatch = where.match(INLINE_RANGE);
      if (inlineMatch) {
        inline.push({
          name,
          query,
          line: Number(inlineMatch[1]),
          from: Number(inlineMatch[2]),
          to: Number(inlineMatch[3]),
        });
        continue;
      }

      const blockMatch = where.match(BLOCK_RANGE);
      if (!blockMatch) continue;
      if (name === "diff") hasDiff = true;
      if (name === "focus") hasFocus = true;

      for (let i = Number(blockMatch[1]); i <= Number(blockMatch[2]); i++) {
        const list = blocks.get(i) ?? [];
        list.push({ name, query });
        blocks.set(i, list);
      }
    }
  }

  const decoded =
    blocks.size || inline.length || numbers
      ? { blocks, inline, numbers, hasDiff, hasFocus }
      : null;

  cache.set(raw, decoded);
  return decoded;
}
