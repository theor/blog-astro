import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import m2dx from "astro-m2dx";

import sitemap from "@astrojs/sitemap";
import {myAstro} from './src/integration'

/** @type {import('astro-m2dx').Options} */
const m2dxOptions = {
  relativeImages: true,
  autoImports: true,
  // doesn't work with astro getCollection
  // scanAbstract: true,
  // rawmdx: true,
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
    extendDefaultPlugins: true,
  },
});
