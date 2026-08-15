import { Circle, Line, Node, Rect, Txt, makeScene2D } from "@canvas-commons/2d";
import { all, createRef, createSignal, delay, linear, waitFor } from "@canvas-commons/core";

/*
 * Three ways through the same two corners:
 *
 *   drag knife        the blade hangs on a free swivel, OFFSET behind the pivot, and is
 *                     dragged around like a shopping-cart castor - it can only follow.
 *   compensated drag  the same knife, told to overshoot each corner, loop round and come
 *                     back onto the next line, so the blade is already facing the right
 *                     way when it gets there.
 *   tangential knife  a rotary axis commands the heading, so the blade can be lifted and
 *                     turned to face the next segment while the machine sits still.
 *
 * The corner is the whole point: straight runs look identical.
 *
 * Everything is precomputed at module scope and read back through one progress signal.
 * Canvas Commons re-runs the scene to scrub and renders at a different fps than it
 * previews, so a per-frame simulation would drift; a lookup table cannot.
 */

type Pt = [number, number];

/** The shape all three are asked to cut: right, up, right. Two square corners. */
const CMD: Pt[] = [
  [-170, 135],
  [20, 135],
  [20, -158],
  [170, -158],
];

/**
 * How far a drag knife's tip trails its swivel. A real one is a fraction of a millimetre;
 * blown up until the rounding it causes - about 27 units here - is something you can see.
 */
const OFFSET = 55;
/** Radius of the compensated knife's corner loop. */
const LOOP_R = 34;
/** Sampling step along a commanded path, in scene units. One sample is one tick of time. */
const STEP = 3;
/** Ticks spent stopped at a corner. Only the two paths that have a corner to stop at. */
const DWELL = 18;

const RUN = 4;

const INK = "#d8dee9";
const GHOST = "#39435a";
const HOLDER = "#5c6579";
const PANEL_BG = "#171d29";
const DRAG = "#f06a6a";
const COMPENSATED = "#e3b341";
const TANGENTIAL = "#4c9aff";

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** Shortest way round, so a heading never spins the long way between two samples. */
const lerpAngle = (a: number, b: number, t: number) => a + ((((b - a + 540) % 360) - 180) * t);

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const norm = (a: Pt): Pt => mul(a, 1 / (len(a) || 1));

/** Up over the first 15% of a corner stop, down over the last 15%. */
const liftProfile = (t: number) => smooth(clamp01(t / 0.15)) * smooth(clamp01((1 - t) / 0.15));

interface Commanded {
  cmd: Pt;
  /** Where a driven blade would be pointing. */
  tanAngle: number;
  /** 0 down, 1 lifted clear of the material. */
  lift: number;
  /** Index of the segment being cut, for the tangential knife's trace. */
  seg: number;
}

/** The shape sampled at a constant feed, with a full stop at each corner. */
const PLAN: Commanded[] = (() => {
  const headings = CMD.slice(0, -1).map((a, i) => deg(Math.atan2(CMD[i + 1][1] - a[1], CMD[i + 1][0] - a[0])));
  const out: Commanded[] = [];

  for (let s = 0; s < headings.length; s++) {
    const [a, b] = [CMD[s], CMD[s + 1]];
    const steps = Math.max(1, Math.round(len(sub(b, a)) / STEP));
    // Every segment but the first starts on the previous one's last point.
    for (let i = s === 0 ? 0 : 1; i <= steps; i++) {
      out.push({ cmd: lerpPt(a, b, i / steps), tanAngle: headings[s], lift: 0, seg: s });
    }
    if (s === headings.length - 1) continue;

    // The corner stop - a square corner is a full stop for any machine. The tangential
    // knife's turn is squeezed into the middle of it, so the blade is clear of the
    // material before it starts moving and back down before the machine does.
    for (let i = 1; i <= DWELL; i++) {
      const t = i / DWELL;
      out.push({
        cmd: [b[0], b[1]],
        tanAngle: lerpAngle(headings[s], headings[s + 1], smooth(clamp01((t - 0.2) / 0.6))),
        lift: liftProfile(t),
        seg: s,
      });
    }
  }
  return out;
})();

/**
 * The path the compensated knife's *tip* is meant to take: the shape, but with each
 * corner replaced by overshoot - loop - come back. Every join is tangent-continuous, so
 * the blade is never asked to turn on the spot and the machine never has to stop.
 */
function compensatedTipPath(): Pt[] {
  const FINE = 1;
  const pts: Pt[] = [CMD[0]];
  const push = (p: Pt) => {
    if (len(sub(p, pts[pts.length - 1])) > 1e-9) pts.push(p);
  };
  const line = (to: Pt) => {
    const from = pts[pts.length - 1];
    const steps = Math.max(1, Math.round(len(sub(to, from)) / FINE));
    for (let i = 1; i <= steps; i++) push(lerpPt(from, to, i / steps));
  };

  for (let s = 0; s < CMD.length - 1; s++) {
    const V = CMD[s + 1];
    line(V);
    if (s === CMD.length - 2) break;

    const u = norm(sub(V, CMD[s]));
    const v = norm(sub(CMD[s + 2], V));
    // The turn, then the same turn taken the long way round - that long way is the loop.
    const turn = ((deg(Math.atan2(v[1], v[0])) - deg(Math.atan2(u[1], u[0])) + 540) % 360) - 180;
    const sweep = turn - 360 * Math.sign(turn);
    const A = add(V, mul(u, LOOP_R));
    const centre = add(A, mul([-u[1], u[0]], Math.sign(sweep) * LOOP_R));

    line(A);
    // Round the loop. It lands one radius short of the corner on the outgoing line, which
    // is what the closing `line(V)` of the next iteration cuts back in along.
    const start = sub(A, centre);
    const steps = Math.max(8, Math.round((Math.abs(rad(sweep)) * LOOP_R) / FINE));
    for (let i = 1; i <= steps; i++) {
      const th = rad(sweep) * (i / steps);
      push(add(centre, [
        start[0] * Math.cos(th) - start[1] * Math.sin(th),
        start[0] * Math.sin(th) + start[1] * Math.cos(th),
      ]));
    }
    line(V);
  }
  return pts;
}

/**
 * Where the pivot has to be to drag a trailing tip along `tip`: one offset ahead of it,
 * along the tangent. That is blade offset compensation, and it is exact - the constraint
 * the tractrix below enforces is precisely this one, read the other way round.
 */
function pivotFor(tip: Pt[], offset: number): Pt[] {
  return tip.map((p, i) =>
    add(p, mul(norm(sub(tip[Math.min(tip.length - 1, i + 1)], tip[Math.max(0, i - 1)])), offset)),
  );
}

/** Resample a polyline at a fixed step, so the machine runs it at a constant feed. */
function resample(path: Pt[], step: number): Pt[] {
  const out: Pt[] = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = len(sub(path[i], path[i - 1]));
    let at = step - carry;
    while (at <= seg) {
      out.push(lerpPt(path[i - 1], path[i], at / seg));
      at += step;
    }
    carry = (carry + seg) % step;
  }
  out.push(path[path.length - 1]);
  return out;
}

interface Frame {
  cmd: Pt;
  /** The blade tip - the point that is actually cutting. */
  tip: Pt;
  angle: number;
  /** How many points of the track's cut have been laid down by this frame. */
  cutCount: number;
}

interface Track {
  frames: Frame[];
  cut: Pt[];
}

/**
 * Drag a trailing tip after a commanded pivot. Each step the tip is pulled straight
 * towards the new pivot position until it is `offset` behind it again - the constraint
 * that draws a tractrix, and with it the rounded corner, for free.
 */
function tractrix(commanded: Pt[], offset: number): Track {
  const start = commanded[0];
  const heading = norm(sub(commanded[Math.min(6, commanded.length - 1)], start));
  let tip = sub(start, mul(heading, offset));
  const cut: Pt[] = [tip];

  const frames = commanded.map((cmd) => {
    const delta = sub(cmd, tip);
    const l = len(delta) || 1;
    if (l > offset) {
      tip = sub(cmd, mul(delta, offset / l));
      // Zero-length segments make a curve profile produce NaN, so a stopped blade lays
      // down nothing - which is also what it does in the material.
      if (len(sub(tip, cut[cut.length - 1])) > 0.01) cut.push(tip);
    }
    return { cmd, tip, angle: deg(Math.atan2(delta[1], delta[0])), cutCount: cut.length };
  });
  return { frames, cut };
}

const PLAIN_TRACK = tractrix(PLAN.map((c) => c.cmd), OFFSET);
const COMP_CMD = resample(pivotFor(compensatedTipPath(), OFFSET), STEP);
const COMP_TRACK = tractrix(COMP_CMD, OFFSET);

/** One tick per sample, so the three run at the same feed and the longest sets the pace. */
const CLOCK = Math.max(PLAN.length, COMP_CMD.length) - 1;
/** When the two that follow the plain path are done, with the compensated one still going. */
const PLAIN_DONE = (PLAN.length - 1) / CLOCK;

function trackAt(track: Track, clock: number) {
  const f = Math.min(clock, track.frames.length - 1);
  const i = Math.min(Math.floor(f), track.frames.length - 2);
  const t = f - i;
  const [a, b] = [track.frames[i], track.frames[i + 1]];
  return {
    cmd: lerpPt(a.cmd, b.cmd, t),
    tip: lerpPt(a.tip, b.tip, t),
    angle: lerpAngle(a.angle, b.angle, t),
    cutCount: a.cutCount,
    index: i,
  };
}

function planAt(clock: number) {
  const f = Math.min(clock, PLAN.length - 1);
  const i = Math.min(Math.floor(f), PLAN.length - 2);
  const t = f - i;
  const [a, b] = [PLAN[i], PLAN[i + 1]];
  return {
    cmd: lerpPt(a.cmd, b.cmd, t),
    tanAngle: lerpAngle(a.tanAngle, b.tanAngle, t),
    lift: lerp(a.lift, b.lift, t),
    seg: a.seg,
  };
}

/** A polyline of at least two distinct points, whatever the caller hands over. */
function polyline(points: Pt[], head: Pt): Pt[] {
  const last = points[points.length - 1];
  const out = len(sub(head, last)) > 0.01 ? [...points, head] : [...points];
  return out.length > 1 ? out : [out[0], [out[0][0] + 0.01, out[0][1]] as Pt];
}

/** The blade itself: a wedge whose point sits on the origin and faces +x. */
const Blade = () => <Line points={[[-34, -10], [0, 0], [-34, 10]]} closed fill={INK} />;

export default makeScene2D(function* (view) {
  const progress = createSignal(0);
  const clock = () => progress() * CLOCK;
  const notes = [createRef<Txt>(), createRef<Txt>(), createRef<Txt>()];

  const panel = (column: -1 | 0 | 1, title: string, subtitle: string, note: string,
                 tint: string, noteRef: ReturnType<typeof createRef<Txt>>) => (
    <Node position={[column * 620, 30]}>
      <Rect width={600} height={840} radius={24} lineWidth={4} stroke={"#242c3d"} fill={PANEL_BG} />
      {/* Type is sized for the narrowest column the embed is letterboxed into, not for the
          1920 frame: the drawing survives being shrunk, the labels are what stops being
          legible first, and they carry half the explanation. */}
      <Txt y={-332} fill={INK} fontFamily={"monospace"} fontSize={52} text={title} />
      <Txt y={-268} fill={"#7c879b"} fontFamily={"monospace"} fontSize={40} text={subtitle} />
      <Txt ref={noteRef} y={352} fill={tint} fontFamily={"monospace"} fontSize={40} opacity={0} text={note} />
    </Node>
  );

  // The shape asked for, identical in all three panels: what the machine is told to cut,
  // as opposed to what each blade leaves behind. Drawn from the first frame - the embed
  // sits on that frame until someone hovers it, and three empty boxes are a poor poster.
  const shape = () => <Line points={CMD} stroke={GHOST} lineWidth={4} lineDash={[11, 10]} />;

  /** A knife on a free swivel: the holder leads, the blade trails behind it. */
  const dragTool = (track: Track) => (
    <Node position={() => trackAt(track, clock()).cmd} rotation={() => trackAt(track, clock()).angle}>
      <Line points={[[0, 0], [-OFFSET, 0]]} stroke={HOLDER} lineWidth={6} />
      <Node position={[-OFFSET, 0]}>
        <Blade />
      </Node>
      <Circle width={22} height={22} lineWidth={4} stroke={INK} fill={PANEL_BG} />
    </Node>
  );

  const cut = (track: Track, tint: string) => (
    <Line
      points={() => {
        const s = trackAt(track, clock());
        return polyline(track.cut.slice(0, s.cutCount), s.tip);
      }}
      stroke={tint}
      lineWidth={7}
      lineCap={"round"}
      lineJoin={"round"}
    />
  );

  view.add(
    <>
      <Txt y={-495} fill={"#5d6479"} fontFamily={"monospace"} fontSize={40} text={"one toolpath, three ways"} />
      {panel(-1, "drag knife", "blade trails on a swivel", "every corner rounds off", DRAG, notes[0])}
      {panel(0, "compensated drag", "overshoot, loop, resume", "sharp - overcuts corners", COMPENSATED, notes[1])}
      {panel(1, "tangential knife", "rotary axis aims blade", "sharp - stops to turn", TANGENTIAL, notes[2])}

      {/* All three drawings sit on the same offset from their panel's centre, so the cuts
          can be read against each other: the plain knife's tip starts an offset behind the
          shape, the compensated one's pivot ends an offset past it, and the corner loops
          hang below and above. */}
      <Node position={[-620 + 17, 84]}>
        {shape()}
        {cut(PLAIN_TRACK, DRAG)}
        {dragTool(PLAIN_TRACK)}
      </Node>

      <Node position={[17, 84]}>
        {shape()}
        {/* The commanded path, left behind as it is travelled. Only this panel needs it:
            for the other two it is the shape itself, and here it is the whole story. */}
        <Line
          points={() => {
            const s = trackAt(COMP_TRACK, clock());
            return polyline(COMP_CMD.slice(0, s.index + 1), s.cmd);
          }}
          stroke={HOLDER}
          lineWidth={3}
          opacity={0.45}
        />
        {cut(COMP_TRACK, COMPENSATED)}
        {dragTool(COMP_TRACK)}
      </Node>

      <Node position={[620 + 17, 84]}>
        {shape()}
        <Line
          points={() => {
            const s = planAt(clock());
            return polyline(CMD.slice(0, s.seg + 1), s.cmd);
          }}
          stroke={TANGENTIAL}
          lineWidth={7}
          lineCap={"round"}
          lineJoin={"round"}
        />
        <Node position={() => planAt(clock()).cmd}>
          {/* The rotary axis: coaxial with the tip, so the blade turns about the point it
              is cutting. Faint until it is the thing doing the work. */}
          <Circle
            width={74}
            height={74}
            lineWidth={4}
            lineDash={[7, 9]}
            stroke={TANGENTIAL}
            opacity={() => 0.2 + planAt(clock()).lift * 0.8}
          />
          <Node
            rotation={() => planAt(clock()).tanAngle}
            // Lifted clear of the material to turn: up off the page, and not cutting.
            scale={() => 1 + planAt(clock()).lift * 0.25}
            opacity={() => 1 - planAt(clock()).lift * 0.55}
          >
            {/* Same holder as the other panels - what differs is who decides where it
                points, which is what the rotary axis around it stands for. */}
            <Line points={[[-30, 0], [-78, 0]]} stroke={HOLDER} lineWidth={6} />
            <Blade />
          </Node>
          <Circle width={22} height={22} lineWidth={4} stroke={INK} fill={PANEL_BG} />
        </Node>
      </Node>
    </>,
  );

  // yield* all(notes[0]().opacity(1, 0.4), notes[1]().opacity(1, 0.4), notes[2]().opacity(1, 0.4));
  yield* all(...notes.map(x => x().opacity(1, 0.4)));
  // yield* waitFor(0.6);
  // Linear, and on one clock: the three machines have to be comparable, so they run at the
  // same feed. The compensated one is simply still going when the other two have finished,
  // which is the price of the loops.
  yield* all(
    progress(1, RUN, linear),
    // delay(RUN * PLAIN_DONE, all(notes[0]().opacity(1, 0.4), notes[2]().opacity(1, 0.4))),
  );
  // yield* notes[1]().opacity(1, 0.4);
  yield* waitFor(2);
});
