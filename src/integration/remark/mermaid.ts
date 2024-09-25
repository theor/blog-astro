import type { RemarkPlugin } from "@astrojs/markdown-remark"
import { visit, EXIT, CONTINUE } from 'unist-util-visit';
import {dedent} from "ts-dedent"
import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { escapeHTML } from "astro/runtime/server/escape.js";

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (str: string) => str.replace(/[&<>"']/g, c => escapeMap[c])

export function mermaid(): RemarkPlugin {
    return function (tree: Root, file: VFile): void {
        visit(tree, "code", node => {
          if (node.lang !== "mermaid") return;
          console.log("MERMAID",node);
      
        // //   // @ts-ignore
          node.type = "html";
          node.value = dedent`
            <div class="mermaid" data-content="${escapeHTML(node.value)}">
              <p>Loading graph...</p>
            </div>
          `
        })
      }
}
