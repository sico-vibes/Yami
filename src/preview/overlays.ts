import type { YamiEvent } from "../shared";

// Preview stand-ins for the stray and caption windows. The stage iframe acts
// as the desktop, so window moves become a transform on the stray layer.
const pos = { x: 260, y: 160 };
let frame = 0;
function place() {
  const el = document.querySelector<HTMLElement>(".stray-window");
  if (el) el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}
function clamp(x: number, y: number) {
  return {
    x: Math.max(-60, Math.min(innerWidth - 180, x)),
    y: Math.max(-50, Math.min(innerHeight - 170, y)),
  };
}
function glide(
  target: { x: number; y: number },
  emit: (e: YamiEvent) => void,
  ms = 520,
) {
  cancelAnimationFrame(frame);
  const sx = pos.x,
    sy = pos.y,
    dx = target.x - sx,
    dy = target.y - sy,
    len = Math.hypot(dx, dy) || 1,
    start = performance.now();
  emit({ type: "stray-move", moving: true, x: dx / len, y: dy / len });
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms),
      e = 1 - Math.pow(1 - t, 3);
    pos.x = sx + dx * e;
    pos.y = sy + dy * e;
    place();
    if (t < 1) frame = requestAnimationFrame(step);
    else emit({ type: "stray-move", moving: false, x: 0, y: 0 });
  };
  frame = requestAnimationFrame(step);
}
const script = [
  { at: 0, data: { mode: "voice", keys: ["Win", "Alt"], you: "", yami: "" } },
  { at: 900, data: { you: "Search for lo-fi beats" } },
  { at: 1500, data: { you: "Search for lo-fi beats on YouTube" } },
  { at: 2300, data: { keys: [] } },
  { at: 3600, data: { yami: "Here's lo-fi beats on YouTube." } },
  { at: 6200, data: { mode: "", keys: [], you: "", yami: "" } },
];
let captionStarted = false;
function playCaption(emit: (e: YamiEvent) => void) {
  let data = { mode: "", keys: [] as string[], you: "", yami: "" };
  for (const step of script)
    setTimeout(() => {
      data = { ...data, ...step.data };
      emit({ type: "caption", data });
    }, step.at);
  setTimeout(() => playCaption(emit), 7600);
}
export function previewOverlay(
  method: string,
  a: any,
  emit: (e: YamiEvent) => void,
) {
  switch (method) {
    case "stray.flee": {
      const ax = 120 - ((Number(a.x) || 0) - pos.x),
        ay = 112 - ((Number(a.y) || 0) - pos.y),
        len = Math.hypot(ax, ay) || 1,
        dist = 170 + Math.random() * 90;
      let target = clamp(
        pos.x + (ax / len) * dist,
        pos.y + (ay / len) * dist * 0.6,
      );
      if (Math.hypot(target.x - pos.x, target.y - pos.y) < 80)
        target = clamp(pos.x - (ax / len) * dist * 1.4, pos.y);
      glide(target, emit);
      return true;
    }
    case "stray.drag":
      Object.assign(
        pos,
        clamp(pos.x + (Number(a.dx) || 0), pos.y + (Number(a.dy) || 0)),
      );
      place();
      return true;
    case "stray.mouse":
    case "stray.open":
    case "caption.notice":
      return true;
    case "caption.data":
      if (!captionStarted) {
        captionStarted = true;
        playCaption(emit);
      }
      return { mode: "", keys: [], you: "", yami: "" };
  }
  throw new Error(`Desktop-only action: ${method}`);
}
