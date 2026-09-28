import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import m2dx from "astro-m2dx";
import icon from "astro-icon";
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import toc from "@jsdevtools/rehype-toc";
import rehypeSlug from 'rehype-slug';

import sitemap from "@astrojs/sitemap";
import {myAstro} from './src/integration';
import {scrollycoding} from './src/integration/scrollycoding';
import {canvasCommons} from './src/integration/canvascommons';
// The Moirai DSL's grammar, copied from the Moirai repo by `yarn sync:moirai`.
import moiraiGrammar from './src/langs/moirai.tmLanguage.json' with { type: 'json' };
import { bundledThemes } from 'shiki';

// ayu-mirage's comment grey (#6e7c8f) is 3.4:1 on its own background, under the 4.5:1
// WCAG AA floor Lighthouse checks. #8593a6 is the same hue, lifted to ~4.8:1.
const ayuMirage = (await bundledThemes['ayu-mirage']()).default;
const codeTheme = JSON.parse(JSON.stringify(ayuMirage).replaceAll(/#6e7c8f/gi, '#8593a6'));

/** @type {import('astro-m2dx').Options} */
const m2dxOptions = {
  // relativeImages: true,
  autoImports: true,
  exportComponents: true,
  // doesn't work with astro getCollection
  // scanAbstract: true,
  // rawmdx: true,
};
/** @type {import('rehype-autolink-headings').Options} */
const headingsOptions = {
behavior: "prepend",
// content: h('span', 'test'),
properties: {"data-link":true, ariaLabel: "Link to this section"}
};

/** @type {import('@jsdevtools/rehype-toc').Options} */
const tocOptions = {
  customizeTOC: e => {
    // Top-level sections only: drop the nested lists under each item.
    for (const ol of e.children)
      for (const li of ol.children ?? [])
        li.children = li.children.filter(c => c.tagName !== "ol");
    e.children = [ {type:'element', tagName: "h1", children: [ {type: "text",
    value: "Table of content"}] }, ...e.children];
    return e;
  }
};

/** rehype-toc inserts the TOC first; move it down to just before the first heading so
 * the intro (and hero image) is what a reader sees first. */
const rehypeTocAfterIntro = () => tree => {
  const isToc = n => n.tagName === "nav" && n.properties?.className?.includes("toc");
  const tocIndex = tree.children.findIndex(isToc);
  if (tocIndex === -1) return;
  const [nav] = tree.children.splice(tocIndex, 1);
  const firstHeading = tree.children.findIndex(n => /^h[1-6]$/.test(n.tagName ?? ""));
  tree.children.splice(firstHeading === -1 ? tocIndex : firstHeading, 0, nav);
};
// https://astro.build/config
export default defineConfig({
  vite: {
    assetsInclude: ["**/*.m4v", "**/*.webm", "**/*.bin"],
  },
  site: "https://theor.xyz",
  build: {
    // Two small stylesheets (global + scrollycoding, ~5 KB gzipped) were the only
    // render-blocking requests; inlining them saves that round trip on every page.
    inlineStylesheets: 'always',
  },
  integrations: [myAstro(), scrollycoding(), canvasCommons(), mdx(), sitemap(), icon()],
  markdown: {
    // Sätteri is v7's default processor, but it has no remark/rehype stage: m2dx,
    // autoAbstract and remarkScrollycoding are all MDAST plugins. Staying on unified()
    // keeps them - and the .mdx files inherit this processor from `markdown`.
    processor: unified({
      remarkPlugins: [[m2dx, m2dxOptions]],
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, headingsOptions], [toc, tocOptions], rehypeTocAfterIntro],
    }),
    shikiConfig: {
      // Choose from Shiki's built-in themes (or add your own)
      // https://github.com/shikijs/shiki/blob/main/docs/themes.md
      theme: codeTheme,
      // Add custom languages
      // Note: Shiki has countless langs built-in, including .astro!
      // https://github.com/shikijs/shiki/blob/main/docs/languages.md
      langs: [{ ...moiraiGrammar, aliases: ['sg', 'moi'] }],
      // Enable word wrap to prevent horizontal scrolling
      wrap: true,
    },
  },
});
