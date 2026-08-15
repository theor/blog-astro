import { Circle, Rect, Txt, makeScene2D } from "@canvas-commons/2d";
import { all, createRef, easeInOutCubic, waitFor } from "@canvas-commons/core";

// Sized against the project's 1920x1080 frame rather than a fraction of it: an embed is
// letterboxed to the post's width, so a small figure in the middle just reads as a black
// box. The project's `.meta` sets the background these sit on.
export default makeScene2D(function* (view) {
  const label = createRef<Txt>();
  const dot = createRef<Rect>();
  const box = createRef<Rect>();

  view.add(
    <>
      <Rect
        ref={box}
        width={820}
        height={820}
        radius={64}
        lineWidth={16}
        stroke={"#4c9aff"}
        fill={"#1b2130"}
      />
      <Rect ref={dot} width={220} height={220} fill={"#f06a6a"} y={-150} />
      <Txt ref={label} y={270} fill={"#d8dee9"} fontFamily={"monospace"} fontSize={90} text={""} />
    </>,
  );

  yield* all(box().rotation(45, 1.2, easeInOutCubic), dot().position.x(270, 1.2, easeInOutCubic));
  yield* label().text("canvas commons", 0.8);
  yield* waitFor(0.4);
  yield* all(box().rotation(0, 1.2, easeInOutCubic), dot().position.x(0, 1.2, easeInOutCubic));
  yield* waitFor(0.4);
});
