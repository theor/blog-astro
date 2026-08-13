import { visit, SKIP } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Code, Heading } from "mdast";

export interface ComponentPaths {
  root: string;
  step: string;
  panel: string;
}

/** MDX element name authors write in their posts. */
const WRAPPER = "Scrollycoding";

/**
 * Identifiers injected into the MDX scope. They must be uppercase-initial or
 * estree-util-build-jsx renders them as literal HTML tags, and the `__ck` suffix keeps
 * them from colliding with anything a post imports itself.
 */
const NAMES = {
  root: "ScrollyRoot__ck",
  step: "ScrollyStep__ck",
  panel: "ScrollyPanel__ck",
} as const;

/* -------------------------------------------------------------------------- */
/* mdast/estree node builders                                                  */
/* -------------------------------------------------------------------------- */

/** String-valued JSX attribute. Everything is a string; components do the coercion. */
const attr = (name: string, value: string) => ({
  type: "mdxJsxAttribute" as const,
  name,
  value,
});

const element = (name: string, attributes: unknown[], children: unknown[]) => ({
  type: "mdxJsxFlowElement" as const,
  name,
  attributes,
  children,
});

/**
 * `import Name from "spec";` as an mdxjsEsm node.
 *
 * `data.estree` is mandatory - hast-util-to-estree silently drops the node without it,
 * which surfaces much later as "Expected component X to be defined".
 */
const importNode = (name: string, spec: string) => ({
  type: "mdxjsEsm" as const,
  value: `import ${name} from ${JSON.stringify(spec)};`,
  data: {
    estree: {
      type: "Program",
      sourceType: "module",
      comments: [],
      body: [
        {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportDefaultSpecifier",
              local: { type: "Identifier", name },
            },
          ],
          source: {
            type: "Literal",
            value: spec,
            raw: JSON.stringify(spec),
          },
          attributes: [],
        },
      ],
    },
  },
});

/* -------------------------------------------------------------------------- */
/* `!mark` annotations                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A line consisting only of a comment carrying a `!mark` annotation.
 *
 * Semantics, counting the line *after* the annotation as 1:
 *   `// !mark`      -> that one line
 *   `// !mark(n)`   -> n lines
 *   `// !mark(a:b)` -> lines a through b
 */
const MARK_LINE = /^\s*(?:\/\/|#|--|;|%|<!--|\/\*)\s*!mark(?:\(([^)]*)\))?\s*(?:\*\/|-->)?\s*$/;

export function extractMarks(source: string): { code: string; marks: string | null } {
  if (!source.includes("!mark")) return { code: source, marks: null };

  const out: string[] = [];
  const ranges: Array<[number, number]> = [];

  for (const line of source.split("\n")) {
    const match = line.match(MARK_LINE);
    if (!match) {
      out.push(line);
      continue;
    }

    // 1-based line number of the next line that will be emitted.
    const base = out.length + 1;
    const arg = match[1]?.trim();

    if (!arg) {
      ranges.push([base, base]);
    } else if (arg.includes(":")) {
      const [a, b] = arg.split(":").map((n) => Number(n.trim()));
      if (Number.isFinite(a) && Number.isFinite(b)) ranges.push([base + a - 1, base + b - 1]);
    } else {
      const count = Number(arg);
      if (Number.isFinite(count) && count > 0) ranges.push([base, base + count - 1]);
    }
  }

  if (ranges.length === 0) return { code: out.join("\n"), marks: null };

  const encoded = ranges.map(([a, b]) => (a === b ? `${a}` : `${a}:${b}`)).join(",");
  return { code: out.join("\n"), marks: encoded };
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

const isStepHeading = (node: RootContent): node is Heading =>
  node.type === "heading" && toString(node).trim().startsWith("!!steps");

const isPanelCode = (node: RootContent): node is Code =>
  node.type === "code" && typeof node.meta === "string" && node.meta.trim().startsWith("!");

const isBlank = (node: RootContent) =>
  node.type === "text" && typeof (node as { value?: string }).value === "string" && !(node as { value: string }).value.trim();

/** `!!steps Setting up the gantry` -> `Setting up the gantry`. */
const parseTitle = (heading: Heading): string => {
  const text = toString(heading).trim().replace(/^!+/, "");
  const firstSpace = text.search(/\s/);
  return firstSpace === -1 ? "" : text.slice(firstSpace).trim();
};

interface Step {
  title: string;
  prose: RootContent[];
  code: Code | null;
  codeTitle: string | null;
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                      */
/* -------------------------------------------------------------------------- */

export function remarkScrollycoding(components: ComponentPaths) {
  return function transform(tree: Root, file: any): void {
    let found = false;

    visit(tree, "mdxJsxFlowElement", (node: any) => {
      if (node.name !== WRAPPER) return;
      found = true;

      const children: RootContent[] = node.children ?? [];
      const steps: Step[] = [];

      for (const child of children) {
        if (isStepHeading(child)) {
          steps.push({ title: parseTitle(child), prose: [], code: null, codeTitle: null });
          continue;
        }

        if (steps.length === 0) {
          if (isBlank(child)) continue;
          file.fail(
            `<${WRAPPER}> content must start with a "## !!steps" heading.`,
            child.position ?? node.position,
          );
        }

        const step = steps[steps.length - 1];

        if (isPanelCode(child)) {
          if (step.code) {
            // file.message() alone is not surfaced by Astro's MDX plugin, and silently
            // dropping content is a trap - warn on the console too.
            const where = `${file.path ?? "unknown"}:${child.position?.start.line ?? "?"}`;
            const warning = `<${WRAPPER}> step "${step.title}" has more than one "!" code block; only the first is used. (${where})`;
            file.message(warning, child.position ?? node.position);
            console.warn(`[scrollycoding] ${warning}`);
            continue;
          }
          step.codeTitle = child.meta!.trim().replace(/^!+/, "").trim() || null;

          const { code, marks } = extractMarks(child.value);
          child.value = code;
          // The filename lives on the component, not in the meta - anything left here is
          // forwarded to shiki as `meta.__raw`.
          child.meta = marks ? `ch-mark=${marks}` : null;

          step.code = child;
          continue;
        }

        step.prose.push(child);
      }

      if (steps.length === 0) {
        file.fail(`<${WRAPPER}> requires at least one "## !!steps" heading.`, node.position);
      }

      const count = String(steps.length);

      node.name = NAMES.root;
      node.attributes = [];
      node.children = steps.flatMap((step, i) => [
        element(NAMES.step, [attr("index", String(i)), attr("title", step.title)], step.prose),
        element(
          NAMES.panel,
          [
            attr("index", String(i)),
            attr("count", count),
            ...(step.codeTitle ? [attr("title", step.codeTitle)] : []),
          ],
          step.code ? [step.code] : [],
        ),
      ]);

      // Don't descend into the nodes we just built.
      return SKIP;
    });

    if (!found) return;

    tree.children.push(
      importNode(NAMES.root, components.root) as any,
      importNode(NAMES.step, components.step) as any,
      importNode(NAMES.panel, components.panel) as any,
    );
  };
}
