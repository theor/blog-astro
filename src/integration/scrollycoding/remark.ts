import { visit, SKIP } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Code, Heading } from "mdast";

import { extractCodeAnnotations, encodeMeta, SUPPORTED } from "./annotations";

export interface ComponentPaths {
  root: string;
  step: string;
  panel: string;
}

/** shiki's resolved background/foreground, forwarded to the panel as custom properties. */
export interface Palette {
  bg: string;
  fg: string;
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
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

const isStepHeading = (node: RootContent): node is Heading =>
  node.type === "heading" && toString(node).trim().startsWith("!!steps");

const isPanelCode = (node: RootContent): node is Code =>
  node.type === "code" && typeof node.meta === "string" && node.meta.trim().startsWith("!");

const isBlank = (node: RootContent) =>
  node.type === "text" &&
  typeof (node as { value?: string }).value === "string" &&
  !(node as { value: string }).value.trim();

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
  numbers: boolean;
}

const newStep = (title: string): Step => ({
  title,
  prose: [],
  code: null,
  codeTitle: null,
  numbers: false,
});

/**
 * `! main.rs -n` -> filename plus flags. Flags are the `-x` tokens; everything else is
 * the filename label shown above the panel.
 */
function parsePanelMeta(meta: string, warn: (msg: string) => void) {
  const tokens = meta.trim().replace(/^!+/, "").trim().split(/\s+/).filter(Boolean);
  const name: string[] = [];
  let numbers = false;

  for (const token of tokens) {
    if (!token.startsWith("-")) {
      name.push(token);
      continue;
    }
    const flag = token.replace(/^-+/, "");
    if (flag === "n" || flag === "numbers") numbers = true;
    else warn(`unknown code block flag "${token}"`);
  }

  return { title: name.join(" ") || null, numbers };
}

/**
 * Code mentions: `[the homing pass](hover:homing)` in the prose becomes a span the
 * client script can hook, pairing with `// !hover homing` in the panel's code.
 */
function transformMentions(prose: RootContent[]): void {
  for (const root of prose) {
    visit(root as any, "link", (node: any, index: number | undefined, parent: any) => {
      if (typeof node.url !== "string" || !node.url.startsWith("hover:")) return;
      if (!parent || index === undefined) return;

      parent.children[index] = {
        type: "mdxJsxTextElement",
        name: "span",
        attributes: [
          { type: "mdxJsxAttribute", name: "data-ch-hover", value: node.url.slice("hover:".length) },
        ],
        children: node.children,
      };
      return SKIP;
    });
  }
}

/** Splits a <Scrollycoding> element's children into steps. Throws via file.fail. */
function parseSteps(node: any, file: any): Step[] {
  const children: RootContent[] = node.children ?? [];
  const steps: Step[] = [];

  for (const child of children) {
    if (isStepHeading(child)) {
      steps.push(newStep(parseTitle(child)));
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
        const where = `${file.path ?? "unknown"}:${child.position?.start.line ?? "?"}`;
        const warning = `<${WRAPPER}> step "${step.title}" has more than one "!" code block; only the first is used. (${where})`;
        file.message(warning, child.position ?? node.position);
        console.warn(`[scrollycoding] ${warning}`);
        continue;
      }
      const where = `${file.path ?? "unknown"}:${child.position?.start.line ?? "?"}`;
      const { title, numbers } = parsePanelMeta(child.meta!, (msg) => {
        file.message(msg, child.position);
        console.warn(`[scrollycoding] ${msg} (${where})`);
      });
      step.codeTitle = title;
      step.numbers = numbers;
      step.code = child;
      continue;
    }

    step.prose.push(child);
  }

  if (steps.length === 0) {
    file.fail(`<${WRAPPER}> requires at least one "## !!steps" heading.`, node.position);
  }

  for (const step of steps) transformMentions(step.prose);

  return steps;
}

function buildBlock(node: any, steps: Step[], palette: Palette): void {
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
        attr("bg", palette.bg),
        attr("fg", palette.fg),
        ...(step.codeTitle ? [attr("title", step.codeTitle)] : []),
      ],
      step.code ? [step.code] : [],
    ),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                      */
/* -------------------------------------------------------------------------- */

export function remarkScrollycoding(components: ComponentPaths, palette: Palette) {
  // Async because annotation parsing goes through @code-hike/lighter, which needs to
  // load a TextMate grammar to know where the language's comments are.
  return async function transform(tree: Root, file: any): Promise<void> {
    const blocks: Array<{ node: any; steps: Step[] }> = [];

    visit(tree, "mdxJsxFlowElement", (node: any) => {
      if (node.name !== WRAPPER) return;
      blocks.push({ node, steps: parseSteps(node, file) });
      // Don't descend into the nodes we're about to replace.
      return SKIP;
    });

    if (blocks.length === 0) return;

    for (const { steps } of blocks) {
      for (const step of steps) {
        if (!step.code) continue;

        const at = `${file.path ?? "unknown"}:${step.code.position?.start.line ?? "?"}`;
        const warn = (msg: string) => {
          file.message(msg, step.code!.position);
          console.warn(`[scrollycoding] ${msg} (${at})`);
        };

        const { code, annotations } = await extractCodeAnnotations(
          step.code.value,
          step.code.lang,
          warn,
        );

        for (const name of new Set(annotations.map((a) => a.name))) {
          if (!SUPPORTED.has(name)) {
            warn(`unsupported annotation "!${name}" - parsed but not rendered`);
          }
        }

        step.code.value = code;
        // The filename label lives on the component; whatever is left in the meta is
        // forwarded to shiki as `meta.__raw` for markTransformer.ts to read.
        step.code.meta = encodeMeta(annotations, { numbers: step.numbers });
      }
    }

    for (const { node, steps } of blocks) buildBlock(node, steps, palette);

    tree.children.push(
      importNode(NAMES.root, components.root) as any,
      importNode(NAMES.step, components.step) as any,
      importNode(NAMES.panel, components.panel) as any,
    );
  };
}
