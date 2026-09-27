/**
 * Annotation parsing: `// !focus(1:2)`, `// !mark[/regex/]`, `/* !diff + *\/` and friends.
 *
 * Comments are found with shiki, the highlighter that colours the code, so an annotation works in every
 * language the blog can highlight -- including those registered in `markdown.shikiConfig.langs` (see
 * `setAnnotationLanguages`). The parsed ranges are encoded into the code fence's meta, which Astro
 * forwards to shiki as `meta.__raw`, where markTransformer.ts turns them back into classes.
 *
 * This used to go through @code-hike/lighter, which bundles its own copy of ~290 grammars and knows
 * nothing of a language shiki was given, so a custom language needed an alias to one of lighter's with
 * the same comment syntax. The algorithm is still lighter's, ported: comment splitting and range
 * resolution from its `extractAnnotations`, and the extractor regex and start/end pairing from Code
 * Hike's packages/codehike/src/code/extract-annotations.tsx.
 */

import { bundledLanguages, createHighlighter, type LanguageInput, type ThemedToken } from "shiki";

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

/* -------------------------------------------------------------------------- */
/* Finding comments                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A theme that paints by role instead of by look: comment delimiters, comment text, and everything
 * else. Resolving scopes through a theme, rather than reading them, gets TextMate's specificity rules
 * for free -- `punctuation.definition.comment` inside `comment` is a delimiter, not text. (Lighter's
 * trick, and its colours.)
 */
const DELIMITER = "#000001";
const COMMENT = "#000010";
const ROLE_THEME = {
  name: "scrollycoding-comment-roles",
  type: "light" as const,
  fg: "#000000",
  bg: "#ffffff",
  settings: [
    { settings: { foreground: "#000000" } },
    { scope: ["punctuation.definition.comment"], settings: { foreground: DELIMITER } },
    { scope: "comment", settings: { foreground: COMMENT } },
  ],
};

/**
 * Grammars that scope a line comment as one `comment` token with no delimiter inside it. For these the
 * leading delimiter is split off by hand. Lighter's table: its grammars were shiki's.
 */
const LINE_COMMENT_PREFIX: Record<string, string> = {
  "actionscript-3": "//", ada: "--", asm: "#", dart: "//", fsharp: "//", graphql: "#", http: "#",
  rust: "//", sparql: "#", wgsl: "//", jsonnet: "//", kql: "//", zenscript: "//", kusto: "//",
  turtle: "#", abap: "*", beancount: ";", kotlin: "//", hlsl: "//", berry: "#", cypher: "//",
  elm: "--", nix: "#", viml: '"', solidity: "//", bat: "REM", shaderlab: "//", sas: "*",
  clarity: ";;",
};

const PLAIN_LANGS = new Set(["text", "txt", "plaintext", "plain", "ansi"]);

let extraLangs: LanguageInput[] = [];
let highlighter: ReturnType<typeof createHighlighter> | null = null;

/**
 * The languages the blog registers with Astro's shiki beyond its bundled ones. Called by the
 * integration before any post is processed, so an annotation in a custom language is found the same
 * way its colours are.
 */
export function setAnnotationLanguages(langs: LanguageInput[] | undefined) {
  extraLangs = langs ?? [];
  highlighter = null;
}

type Token = { content: string; role: string };

/** The code's lines as role-coloured tokens, or null when the language has no grammar here. */
async function tokenize(code: string, lang: string): Promise<Token[][] | null> {
  const hl = await (highlighter ??= createHighlighter({ themes: [ROLE_THEME], langs: extraLangs }));
  if (!hl.getLoadedLanguages().includes(lang)) {
    if (!(lang in bundledLanguages)) return null;
    await hl.loadLanguage(lang as keyof typeof bundledLanguages);
  }
  const lines = hl.codeToTokensBase(code, { lang, theme: ROLE_THEME.name });
  return lines.map((line: ThemedToken[]) =>
    line.map((t) => ({ content: t.content, role: (t.color ?? "").toLowerCase() })),
  );
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                  */
/* -------------------------------------------------------------------------- */

interface FoundAnnotation {
  name: string;
  query: string;
  rangeString: string | undefined;
  /** The output line it belongs to: its own when it trails code, the next one when it has a line to itself. */
  lineNumber: number;
}

/** Splits a hand-delimited line comment into delimiter + text (see LINE_COMMENT_PREFIX). */
function splitPrefix(line: Token[], prefix: string): Token[] {
  return line.flatMap((t) => {
    if (t.role !== COMMENT) return [t];
    const text = t.content.trimStart();
    if (!text.startsWith(prefix)) return [t];
    const rest = text.slice(prefix.length);
    const head = { content: t.content.slice(0, t.content.length - rest.length), role: DELIMITER };
    return rest.length ? [head, { content: rest, role: COMMENT }] : [head];
  });
}

/**
 * Takes one line's annotations out of it. Returns the line without them, or null when nothing but
 * whitespace is left -- a comment that had a line to itself takes the line with it.
 */
function stripLine(line: Token[], lang: string, lineNumber: number, found: FoundAnnotation[]): string | null {
  if (lang in LINE_COMMENT_PREFIX && line.some((t) => t.role === COMMENT)) {
    line = splitPrefix(line, LINE_COMMENT_PREFIX[lang]);
  }
  if (!line.some((t) => t.role === DELIMITER)) return line.map((t) => t.content).join("");

  const removed = new Set<Token>();
  let annotated = false;
  for (let i = 0; i < line.length; i++) {
    const token = line[i];
    if (token.role !== COMMENT) continue;
    const parsed = extractor(token.content);
    if (!parsed) continue;

    annotated = true;
    found.push({ ...parsed, lineNumber });
    // The comment's own delimiters go with it: `//` before, `*/` after.
    if (line[i - 1]?.role === DELIMITER) removed.add(line[i - 1]);
    removed.add(token);
    if (line[i + 1]?.role === DELIMITER) removed.add(line[i + 1]);
    i++;
  }

  const text = line.filter((t) => !removed.has(t)).map((t) => t.content).join("");
  if (!annotated) return text;
  if (text.trim() === "") return null;
  // `{/* !mark */}` in JSX leaves its braces behind.
  if (["mdx", "jsx", "tsx"].includes(lang) && text.trim() === "{}") return null;
  return text;
}

/* -------------------------------------------------------------------------- */
/* Ranges                                                                      */
/* -------------------------------------------------------------------------- */

const isPositiveInteger = (text: string) => /^\d+$/.test(text);

/** `a` or `a:b`, 1-based. */
function parseSpan(text: string): { from: number; to: number } {
  const [from, to] = text.split(":");
  if (!isPositiveInteger(from)) throw new Error(`Invalid number "${from}" in range string`);
  if (Number(from) < 1) throw new Error("Invalid line or column number in range string");
  if (to === undefined) return { from: Number(from), to: Number(from) };
  if (!isPositiveInteger(to)) throw new Error(`Invalid number "${to}" in range string`);
  return { from: Number(from), to: Number(to) };
}

/** Commas separate parts, except inside a `[...]`: `(1,2[3:5])`. */
const splitParts = (text: string) => text.split(/,(?![^[]*\])/g);

/** `[3:5,8]`: columns on one line. */
function columnRanges(rangeString: string, lineNumber: number): InlineRange[] {
  return splitParts(rangeString.slice(1, -1)).map((part) => {
    const { from, to } = parseSpan(part);
    return { lineNumber, fromColumn: from, toColumn: to };
  });
}

/** `(/regex/)`: the lines a match spans, searching from `lineNumber` down. */
function lineRegexRanges(code: string, rangeString: string, lineNumber: number): MultiLineRange[] {
  const m = rangeString.match(/\(\/([\s\S]*?)\/([gimuy]*)\)/);
  if (!m) throw new Error(`Invalid RegExp string: ${rangeString}`);
  const regex = new RegExp(m[1], m[2]);
  const text = code.split(/\r?\n/).slice(lineNumber - 1).join("\n");
  const lineAt = (index: number) => text.slice(0, index).split("\n").length + lineNumber - 1;

  if (!regex.global) {
    const match = regex.exec(text);
    if (!match) return [];
    const from = lineAt(match.index);
    return [{ fromLineNumber: from, toLineNumber: from + match[0].split("\n").length - 1 }];
  }

  const ranges: MultiLineRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const from = lineAt(match.index);
    const to = from + match[0].split("\n").length - 1;
    if (ranges.at(-1)?.fromLineNumber !== from) ranges.push({ fromLineNumber: from, toLineNumber: to });
  }
  return ranges;
}

/**
 * `[/regex/]`: the columns of a match -- its first group if it has one -- on the line below, or on
 * every line from there with the `m` flag.
 */
function columnRegexRanges(code: string, rangeString: string, lineNumber: number): InlineRange[] {
  const m = rangeString.match(/\[\/([\s\S]*?)\/([gimuy]*)\]/);
  if (!m) throw new Error(`Invalid RegExp string: ${rangeString}`);
  const regex = new RegExp(m[1], (m[2] || "") + "d");
  let lines = code.split(/\r?\n/).slice(lineNumber - 1);
  if (!regex.multiline) lines = [lines[0]];

  const ranges: InlineRange[] = [];
  lines.forEach((line, offset) => {
    const push = (match: RegExpExecArray) => {
      const [from, to] = match.indices![1] ?? match.indices![0];
      ranges.push({ lineNumber: offset + lineNumber, fromColumn: from + 1, toColumn: to });
    };
    if (!regex.global) {
      if (ranges.length > 0) return;
      const match = regex.exec(line);
      if (match) push(match);
      return;
    }
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line))) push(match);
  });
  return ranges;
}

/**
 * What an annotation covers, counted from the line it belongs to: nothing means that line, `(2)` or
 * `(1:3)` lines relative to it, `(2[3:5])` columns on a relative line, `[3:5]` columns on it.
 */
function resolveRanges(code: string, rangeString: string | undefined, lineNumber: number): CodeRange[] {
  if (!rangeString) return [{ fromLineNumber: lineNumber, toLineNumber: lineNumber }];
  if (rangeString.startsWith("(/")) return lineRegexRanges(code, rangeString, lineNumber);
  if (rangeString.startsWith("[/")) return columnRegexRanges(code, rangeString, lineNumber);
  if (rangeString.startsWith("[")) return columnRanges(rangeString, lineNumber);

  return splitParts(rangeString.slice(1, -1)).flatMap((part): CodeRange[] => {
    if (part.includes("[")) {
      const [line, columns] = part.split("[");
      const target = lineNumber + Number(line) - 1;
      if (!Number.isInteger(target)) throw new Error(`Invalid number "${line}" in range string`);
      return columnRanges("[" + columns, target);
    }
    const { from, to } = parseSpan(part);
    return [{ fromLineNumber: from + lineNumber - 1, toLineNumber: to + lineNumber - 1 }];
  });
}

/**
 * Strip annotation comments out of `code` and return the ranges they described.
 * Leaves the code untouched if the language has no grammar.
 */
export async function extractCodeAnnotations(
  code: string,
  lang: string | null | undefined,
  warn: (msg: string) => void,
): Promise<{ code: string; annotations: RawAnnotation[] }> {
  // Cheap bail-out: no `!word` anywhere means no annotations, and skipping the tokenizer
  // avoids loading a TextMate grammar for the majority of code blocks.
  if (!/!\w/.test(code)) return { code, annotations: [] };
  if (!lang || PLAIN_LANGS.has(lang)) return { code, annotations: [] };

  try {
    const lines = await tokenize(code, lang);
    if (!lines) {
      warn(`unknown language "${lang}" - annotations left as-is`);
      return { code, annotations: [] };
    }

    const found: FoundAnnotation[] = [];
    const kept: string[] = [];
    for (const line of lines) {
      const text = stripLine(line, lang, kept.length + 1, found);
      if (text !== null) kept.push(text);
    }
    const stripped = kept.join("\n");

    const parsed = found
      .map(({ name, query, rangeString, lineNumber }) => ({
        name,
        query,
        ranges: resolveRanges(stripped, rangeString, lineNumber),
      }))
      .filter((a) => a.ranges.length > 0);
    const annotations = pairStartEnd(parsed, warn);

    // An annotation comment that was consumed but matched nothing would otherwise
    // disappear without a trace. The usual cause is a regex query whose target is not on
    // the line directly below it - that is the only line a query searches.
    if (stripped !== code && annotations.length === 0) {
      warn("annotation comment was removed but matched nothing (a `[/regex/]` query only searches the line directly below it)");
    }

    return { code: stripped, annotations };
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
