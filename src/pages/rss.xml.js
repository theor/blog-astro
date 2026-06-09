import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export const GET = async (context) => {
  const posts = await getCollection("blog");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()).map((post) => ({
      ...post.data,
      link: `/${post.id}/`,
    })),
  });
}
