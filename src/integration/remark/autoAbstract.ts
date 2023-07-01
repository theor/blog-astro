import type { Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { visit, EXIT, CONTINUE } from 'unist-util-visit';


import type { VFile as UnistVFile } from 'vfile';
import type { Node, Data, Parent, Literal } from 'unist';

export interface DataMap {
    astro: {
        frontmatter: Record<string, unknown>;
    };
}
export type VFile = UnistVFile & { data: Record<string, unknown> & DataMap; value: string };
export type RemarkPlugin = (tree: Root, file: VFile) => void;

function fixPonctuation(str: string): string {
    return str.replace(/([.?!])([\w]+)/g, '$1 $2');
}

export function autoAbstract(isDev: boolean): RemarkPlugin {
    console.warn("make autoAbstract")
    return function (tree: Root, file: VFile): void {
        const { frontmatter } = file.data.astro;
        if(isDev){
            frontmatter.timeToRead = "10 min";
            frontmatter.abstract = "Lorem Ipsum";
            return;
        }
        // console.warn("  autoAbstract", frontmatter, new Error().stack)
        let timeToRead = Math.max(1, Math.round(toString(tree).split(/[ \n]/).length / 265));
        let excerpt = "";
        // cloneTreeUntil(tree as Parent&Literal, x => { console.log(x); return false});
        visit(tree, { type: 'paragraph' }, node => {
            excerpt += fixPonctuation(toString(node));
            return excerpt.length >= 100 ? EXIT : CONTINUE;
        });
        frontmatter.timeToRead = timeToRead + " min";
        frontmatter.abstract = excerpt;
        // visit(tree, { type: 'mdxJsxFlowElement', name: 'Abstract' }, node => {
        //     const normalised = fixPonctuation(toString(node));

        //     // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        //     const position = (node as Node<Data>).position;
        //     if (!position) {
        //         return;
        //     }
        //     const { start, end } = position;
        //     const markdown = file.value
        //         .split('\n')
        //         .slice(start.line, end.line - 1)
        //         .join('\n')
        //         .trim();
        //     frontmatter.abstract = { text: normalised, markdown };
        // });
    };
}

function cloneTreeUntil(root: Parent & Literal, endCondition: (x: any) => boolean) {
    let clonedRoot: Parent | undefined = undefined;
    let endConditionMet = false

    function preOrderTraversal(node: Node & Literal) {
        if (endConditionMet || endCondition({ root: clonedRoot, nextNode: node })) {
            endConditionMet = true
            return
        }

        const newNode = duplicateNode(node)
        if (clonedRoot) {
            clonedRoot.children.push(newNode)
        } else {
            clonedRoot = newNode
        }

        if ((node as unknown as Parent).children) {
            (node as unknown as Parent).children.forEach(child => {
                clonedRoot = newNode
                preOrderTraversal(child as Node & Literal)
            })
            clonedRoot = newNode
        }
    }
    preOrderTraversal(root)
    return clonedRoot
}
function duplicateNode(node: Node & Literal): Parent & Literal {
    return {
        type: node.type,
        children: [],
        data: node.data,
        value: node.value,
    }
}