import type { RemarkPlugin } from "@astrojs/markdown-remark"
import { visit, EXIT, CONTINUE } from 'unist-util-visit';
import {dedent} from "ts-dedent"
import type { Root } from 'mdast';
import type { VFile } from 'vfile';

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (str: string) => str.replace(/[&<>"']/g, c => escapeMap[c])

export function mermaid(): RemarkPlugin {
    return async function (tree: Root, file: VFile) {
      let promises: PromiseLike<any>[] = []
        visit(tree, "code", node => {
          if (node.lang !== "mermaid") return;
          console.log("MERMAID",node);

          // @ts-ignore
          node.type = "html";
          node.value = dedent`
            <pre class="mermaid" data-content="${escapeHtml(node.value)}">
              ${escapeHtml(node.value)}
            </pre>
          `
        });
        await Promise.all(promises);
      }
}
