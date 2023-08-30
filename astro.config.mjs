import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import m2dx from "astro-m2dx";
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import toc from "@jsdevtools/rehype-toc";
import rehypeSlug from 'rehype-slug';

import sitemap from "@astrojs/sitemap";
import {myAstro} from './src/integration';

/** @type {import('astro-m2dx').Options} */
const m2dxOptions = {
  // relativeImages: true,
  autoImports: true,
  // doesn't work with astro getCollection
  // scanAbstract: true,
  // rawmdx: true,
};
/** @type {import('rehype-autolink-headings').Options} */
const headingsOptions = {
behavior: "prepend",
// content: h('span', 'test'),
properties: {"data-link":true}
};

/** @type {import('@jsdevtools/rehype-toc').Options} */
const tocOptions = {
  customizeTOC: e => {
    e.children = [ {type:'element', tagName: "h1", children: [ {type: "text",
    value: "Table of content"}] }, ...e.children];
    return e;
  }
};
// https://astro.build/config
export default defineConfig({
  vite: {
    assetsInclude: ["**/*.m4v", "**/*.webm", "**/*.bin"],
  },
  site: "https://theor.xyz",
  integrations: [myAstro(), mdx(), sitemap(), ],
  markdown: {
    remarkPlugins: [[m2dx, m2dxOptions]],
    rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, headingsOptions], [toc, tocOptions]],
    extendDefaultPlugins: true,
    shikiConfig: {
      // Choose from Shiki's built-in themes (or add your own)
      // https://github.com/shikijs/shiki/blob/main/docs/themes.md
      theme: 'nord',
      // Add custom languages
      // Note: Shiki has countless langs built-in, including .astro!
      // https://github.com/shikijs/shiki/blob/main/docs/languages.md
      langs: [],
      // Enable word wrap to prevent horizontal scrolling
      wrap: true,
    },
  },
});
