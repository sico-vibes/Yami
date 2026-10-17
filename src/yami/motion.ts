// Pure pose math for the cat-ghost. Rendering lives in YamiSpirit.tsx.
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

// Tail centreline at rest, from the body to the curled tip (viewBox units).
const TAIL: Point[] = [
  { x: 74, y: 80 },
  { x: 85, y: 64 },
  { x: 95, y: 58 },
  { x: 99, y: 51 },
  { x: 94, y: 44 },
  { x: 97, y: 37 },
  { x: 105, y: 32 },
  { x: 104, y: 25 },
  { x: 98, y: 22 },
];
const SAMPLES = 22;

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
      } as Record<string, number>
    )[state] ?? 0
  );
}

function catmull(p: Point[], u: number): Point {
  const n = p.length - 1,
    f = Math.min(n - 1e-9, Math.max(0, u * n)),
    i = Math.floor(f),
    t = f - i;
  const p0 = p[Math.max(0, i - 1)],
    p1 = p[i],
    p2 = p[i + 1],
    p3 = p[Math.min(n, i + 2)];
  const t2 = t * t,
    t3 = t2 * t;
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 *
    (2 * b +
      (-a + c2) * t +
      (2 * a - 5 * b + 4 * c2 - d) * t2 +
      (-a + 3 * b - 3 * c2 + d) * t3);
  return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) };
}

// Centreline with a travelling wave that grows toward the tip. `drag` bends
// the tail away from the direction of travel while the stray window moves.
export function tailSpine(
  t: number,
  energy: number,
  drag: Point = { x: 0, y: 0 },
) {
  const out: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES,
      base = catmull(TAIL, u),
      ahead = catmull(TAIL, Math.min(1, u + 0.02)),
      behind = catmull(TAIL, Math.max(0, u - 0.02));
    const dx = ahead.x - behind.x,
      dy = ahead.y - behind.y,
      len = Math.hypot(dx, dy) || 1;
    const reach = Math.pow(u, 1.25),
      wave =
        Math.sin(t * 2.4 - u * 5.2) * 3.4 + Math.sin(t * 1.1 - u * 2.3) * 1.6;
    const offset = wave * reach * energy;
    out.push({
      x: base.x - (dy / len) * offset - drag.x * reach * 9,
      y: base.y + (dx / len) * offset - drag.y * reach * 9,
    });
  }
  return out;
}

// Closed ribbon around the spine that tapers from the body to a round tip.
export function tailPath(spine: Point[], width = 6) {
  const left: Point[] = [],
    right: Point[] = [];
  spine.forEach((p, i) => {
    const a = spine[Math.max(0, i - 1)],
      b = spine[Math.min(spine.length - 1, i + 1)];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    const w = (width * (1 - (i / (spine.length - 1)) * 0.72)) / 2;
    left.push({ x: p.x - (dy / len) * w, y: p.y + (dx / len) * w });
    right.push({ x: p.x + (dy / len) * w, y: p.y - (dx / len) * w });
  });
  const f = (n: number) => n.toFixed(2);
  const tip = spine[spine.length - 1];
  return (
    `M${f(left[0].x)} ${f(left[0].y)}` +
    left
      .slice(1)
      .map((p) => `L${f(p.x)} ${f(p.y)}`)
      .join("") +
    `Q${f(tip.x + (tip.x - spine[spine.length - 2].x))} ${f(tip.y + (tip.y - spine[spine.length - 2].y))} ${f(right.at(-1)!.x)} ${f(right.at(-1)!.y)}` +
    right
      .slice(0, -1)
      .reverse()
      .map((p) => `L${f(p.x)} ${f(p.y)}`)
      .join("") +
    "Z"
  );
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
    bob: Math.sin(t * 1.7) * 2.2 * energy,
    tilt:
      state === "thinking"
        ? Math.sin(t * 1.4) * 6
        : Math.sin(t * 0.9) * 2 * energy,
    squash:
      state === "speaking"
        ? 1 + Math.sin(t * 22) * 0.025
        : 1 + Math.sin(t * 1.7 + 1) * 0.015 * energy,
    ear:
      state === "listening"
        ? -8 + Math.sin(t * 3) * 2
        : Math.max(0, Math.sin(t * 0.7) - 0.92) * 120 * energy,
    blink,
    mouth: state === "speaking" ? 0.5 + Math.sin(t * 17) * 0.5 : 0,
    glow:
      state === "listening"
        ? 0.55 + Math.sin(t * 7.8) * 0.2
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
