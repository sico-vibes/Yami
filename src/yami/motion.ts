// Pure shape and pose math for Yami. Rendering lives in YamiSpirit.tsx.
// Yami is a round head whose lower half burns downward as a layered flame:
// a pale outer flame, a lighter middle and a white-hot core with her face.
export type Point = { x: number; y: number };
export type Pose = {
  bob: number;
  tilt: number;
  squash: number;
  ear: number;
  blink: number;
  mouth: number;
  glow: number;
};
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
};

export const CENTER = { x: 50, y: 46 };
const SAMPLES = 84;
// Each layer: head radius and its downward tongues. `at` is the angle offset
// from straight down (radians), `len` the tongue length, `bend` its resting
// curl, `w` its angular width.
type Tongue = { at: number; len: number; w: number; bend: number };
const LAYERS: { r: number; belly: number; tongues: Tongue[] }[] = [
  {
    r: 27,
    belly: 11,
    tongues: [
      { at: -0.92, len: 7, w: 0.46, bend: -0.2 },
      { at: -0.46, len: 13, w: 0.42, bend: 0.22 },
      { at: 0.05, len: 26, w: 0.4, bend: 0.2 },
      { at: 0.52, len: 14, w: 0.42, bend: -0.22 },
      { at: 0.96, len: 8, w: 0.46, bend: 0.2 },
    ],
  },
  {
    r: 23.5,
    belly: 10,
    tongues: [
      { at: -0.44, len: 10, w: 0.46, bend: 0.2 },
      { at: 0.1, len: 19, w: 0.44, bend: -0.18 },
      { at: 0.62, len: 9, w: 0.46, bend: -0.2 },
    ],
  },
  {
    r: 20.5,
    belly: 8,
    tongues: [
      { at: -0.3, len: 6, w: 0.52, bend: 0.16 },
      { at: 0.12, len: 11, w: 0.5, bend: -0.14 },
      { at: 0.54, len: 6, w: 0.52, bend: 0.16 },
    ],
  },
];
export const LAYER_COUNT = LAYERS.length;

export const REST: Pose = {
  bob: 0,
  tilt: 0,
  squash: 1,
  ear: 0,
  blink: 1,
  mouth: 0,
  glow: 0.35,
};

// How lively each state is; the loop stops once energy settles at zero.
export function stateEnergy(state: string) {
  return (
    (
      {
        listening: 0.55,
        thinking: 0.4,
        speaking: 0.85,
        connecting: 0.25,
        // Short reactions to agents; the island ends them after 1.6 s.
        cheer: 0.9,
        alert: 0.5,
        worried: 0.3,
      } as Record<string, number>
    )[state] ?? 0
  );
}

// A pointed bump: 1 at the tongue's centre, 0 at its edges.
const bump = (s: number) =>
  Math.abs(s) >= 1 ? 0 : Math.pow(1 - Math.abs(s), 1.7);

// Outline points for one layer. Every time-varying term is scaled by
// `energy`, so energy 0 gives the same still flame at any time.
export function layerPoints(
  layer: number,
  t: number,
  energy: number,
  drag: Point = { x: 0, y: 0 },
) {
  const { r, belly, tongues } = LAYERS[layer];
  const live = tongues.map((g, i) => {
    const k = i + layer * 3;
    return {
      at:
        Math.PI / 2 +
        g.at +
        energy * 0.09 * Math.sin(t * (1.3 + 0.21 * k) + k * 2.1),
      len:
        g.len *
        (1 +
          energy *
            (0.22 * Math.sin(t * (2.1 + 0.37 * k) + k * 1.7) +
              0.1 * Math.sin(t * (4.3 + 0.5 * k) + k))),
      w: g.w,
      bend: g.bend + energy * 0.35 * Math.sin(t * (1.7 + 0.3 * k) + k),
    };
  });
  const longest = Math.max(...tongues.map((g) => g.len));
  const points: Point[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * Math.PI * 2;
    const below = Math.sin(theta); // > 0 under the head's equator
    let reach = 0,
      curl = 0;
    if (below > 0) {
      let best = 0;
      for (const g of live) {
        const e = g.len * bump((theta - g.at) / g.w);
        if (e > best) {
          best = e;
          const k = e / g.len;
          curl = g.bend * (k * k + 0.25 * Math.sin(k * Math.PI));
        }
      }
      reach = belly * Math.pow(below, 1.5) + best;
    }
    // Flames sweep downward and inward, so the bottom tapers like an
    // upside-down flame instead of fanning out sideways.
    const a = theta + curl,
      fx = Math.cos(a) * 0.3,
      fy = Math.sin(a) * 0.3 + 0.7,
      fl = Math.hypot(fx, fy),
      squeeze = 1 - 0.22 * Math.min(1, reach / longest),
      pull = Math.pow(reach / (longest + belly), 1.5) * 9;
    const x = CENTER.x + Math.cos(a) * r + (fx / fl) * reach,
      y = CENTER.y + Math.sin(a) * r + (fy / fl) * reach;
    points.push({
      x: CENTER.x + (x - CENTER.x) * squeeze - drag.x * pull,
      y: y - drag.y * pull,
    });
  }
  return points;
}

// Smooth closed path through the points using quadratic midpoints.
export function closedPath(points: Point[]) {
  const f = (v: number) => v.toFixed(2);
  const mid = (a: Point, b: Point) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = mid(points.at(-1)!, points[0]);
  let d = `M${f(start.x)} ${f(start.y)}`;
  points.forEach((p, i) => {
    const m = mid(p, points[(i + 1) % points.length]);
    d += `Q${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`;
  });
  return d + "Z";
}

export const layerPath = (
  layer: number,
  t: number,
  energy: number,
  drag?: Point,
) => closedPath(layerPoints(layer, t, energy, drag));

// Embers drift away from the flame, shrink and fade. `rand` is injectable so
// tests are deterministic.
export function stepParticles(
  list: Particle[],
  dt: number,
  rate: number,
  rand: () => number = Math.random,
  max = 10,
) {
  const next = list
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx * 0.98,
      age: p.age + dt,
    }))
    .filter((p) => p.age < p.life);
  if (next.length < max && rand() < rate * dt) {
    const theta = Math.PI / 2 + (rand() - 0.5) * 2.4,
      dist = 26 + rand() * 18,
      speed = 5 + rand() * 7;
    next.push({
      x: CENTER.x + Math.cos(theta) * dist,
      y: CENTER.y + Math.sin(theta) * dist,
      vx: Math.cos(theta) * speed,
      vy: Math.sin(theta) * speed + 4,
      age: 0,
      life: 1.1 + rand() * 0.9,
      r: 0.9 + rand() * 1.3,
    });
  }
  return next;
}

// Body pose for a moment in time. Blinks are deterministic so tests and
// screenshots stay stable.
export function bodyPose(state: string, t: number, energy: number): Pose {
  const blinkPhase = (t % 4.6) / 4.6,
    blink =
      state === "sleeping"
        ? 0.12
        : blinkPhase > 0.955
          ? Math.abs(blinkPhase - 0.9775) / 0.0225
          : 1;
  return {
    // Cheer hops: the body rises on every half beat.
    bob:
      state === "cheer"
        ? -Math.abs(Math.sin(t * 7)) * 7
        : Math.sin(t * 1.7) * 2.4 * energy,
    tilt:
      state === "thinking"
        ? Math.sin(t * 1.4) * 6
        : state === "worried"
          ? -9 + Math.sin(t * 2.2) * 1.5
          : Math.sin(t * 0.9) * 2 * energy,
    squash:
      state === "speaking"
        ? 1 + Math.sin(t * 22) * 0.025
        : state === "cheer"
          ? 1 + Math.cos(t * 14) * 0.04
          : 1 + Math.sin(t * 1.7 + 1) * 0.015 * energy,
    ear:
      state === "listening" || state === "alert"
        ? 10 + Math.sin(t * 3) * 3
        : Math.max(0, Math.sin(t * 0.7) - 0.92) * 140 * energy,
    blink,
    mouth: state === "speaking" ? 0.5 + Math.sin(t * 17) * 0.5 : 0,
    glow:
      state === "listening"
        ? 0.55 + Math.sin(t * 7.8) * 0.2
        : state === "cheer"
          ? 0.65
          : state === "worried"
            ? 0.22
            : 0.35 + energy * 0.15,
  };
}

// Ease every channel toward the rest pose; returns true once settled.
export function settle(pose: Pose, rate = 0.18): boolean {
  let done = true;
  for (const key of Object.keys(REST) as (keyof Pose)[]) {
    const next = pose[key] + (REST[key] - pose[key]) * rate;
    pose[key] = Math.abs(next - REST[key]) < 0.002 ? REST[key] : next;
    if (pose[key] !== REST[key]) done = false;
  }
  return done;
}
