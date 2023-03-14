import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import m2dx from "astro-m2dx";
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';

import sitemap from "@astrojs/sitemap";
import {myAstro} from './src/integration';

/** @type {import('astro-m2dx').Options} */
const m2dxOptions = {
  relativeImages: true,
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

// https://astro.build/config
export default defineConfig({
  vite: {
    assetsInclude: ["**/*.m4v", "**/*.webm"],
  },
  site: "https://theor.xyz",
  integrations: [myAstro(), mdx(), sitemap(), ],
  markdown: {
    remarkPlugins: [[m2dx, m2dxOptions]],
    rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, headingsOptions]],
    extendDefaultPlugins: true,
  },
});
