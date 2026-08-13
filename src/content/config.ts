import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    banner: z.string().optional(),
    staticBanner: z.string().optional(),
    abstract: z.string().optional(),
    tags: z.string().array().optional(),
    draft: z.boolean().optional(),
    // Transform string to Date object
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
  }),
});

export const collections = { blog };
