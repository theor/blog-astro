import Video from "../components/Video.astro";
import Box from "../components/Box.astro";
import Figure from "../components/Figure.astro";
import Records from "../components/Records.astro";
import Wide from "../components/Wide.astro";
import Animation from "../integration/canvascommons/Animation.astro";
import { YouTube } from "@astro-community/astro-embed-youtube";

export const autoimports = {
  Video,
  YouTube,
  Box,
  Figure,
  Records,
  Wide,
  Animation,
};
