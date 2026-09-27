import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/blog",
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, "").replace(/\.mdx$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    banner: z.string().optional(),
    staticBanner: z.string().optional(),
    abstract: z.string().optional(),
    tags: z.string().array().optional(),
    draft: z.boolean().optional(),
    pubDate: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    updatedDate: z
      .string()
      .optional()
      .transform((str) => (str ? new Date(str) : undefined)),
    heroImage: z.string().optional(),
    author: z.string().optional(),
    type: z.string().optional(),
    serie_part: z.number().optional(),
    toc: z.boolean().optional(),
    preview: z.boolean().optional(),
    // Overrides --color-primary for this post (heading bars, links, tags).
    accent: z.string().optional(),
  }),
});

export const collections = { blog };
