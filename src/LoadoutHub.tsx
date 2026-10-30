import { useEffect, useRef } from "react";
import type { State } from "./shared";
import { Icon, Spirit } from "./ui";
import { skinFor } from "./yami/skins";

export type HubSlot = {
  slot: string;
  label: string;
  value: string;
  icon: string;
  color: string;
};
// Slot cards drift slowly around Yami on a flattened orbit. Hovering or
// dragging a card pauses the drift so it is easy to click.
const ORBIT_SQUASH = 0.6,
  ORBIT_SPEED = 0.05, // radians per second
  WISPS = 16;
const still = () =>
  document.documentElement.dataset.reduced === "true" ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// The Loadout: Yami floats in a soft halo over a blurred, skin-tinted veil,
// tethered to four glass cards that orbit her while faint wisps rise.
export function LoadoutHub({
  state,
  slots,
  open,
}: {
  state: State;
  slots: HubSlot[];
  open: (slot: string) => void;
}) {
  const glow = skinFor(state.settings.soul).glow;
  const canvas = useRef<HTMLCanvasElement>(null),
    root = useRef<HTMLDivElement>(null),
    buttons = useRef<(HTMLButtonElement | null)[]>([]),
    tint = useRef(glow),
    slotsRef = useRef(slots);
  tint.current = glow;
  slotsRef.current = slots;
  const nodes = useRef([
    { x: -150, y: -90 },
    { x: 155, y: -85 },
    { x: -150, y: 95 },
    { x: 150, y: 100 },
  ]);
  const angle = useRef(0),
    paused = useRef(false),
    dragging = useRef(-1);
  const place = (p: { x: number; y: number }) => {
    const r = Math.hypot(p.x, p.y / ORBIT_SQUASH),
      a = Math.atan2(p.y / ORBIT_SQUASH, p.x) + angle.current;
    return { x: r * Math.cos(a), y: r * Math.sin(a) * ORBIT_SQUASH };
  };
  useEffect(() => {
    let frame = 0,
      last = 0;
    const c = canvas.current!,
      r = root.current!,
      ctx = c.getContext("2d")!;
    // Wisps: slow motes that rise from below and fade out.
    const wisps = Array.from({ length: WISPS }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.012 + Math.random() * 0.02,
      size: 0.8 + Math.random() * 1.6,
      phase: i * 1.7,
    }));
    const draw = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const moving = !still();
      if (!paused.current && dragging.current < 0 && moving)
        angle.current += dt * ORBIT_SPEED;
      const w = r.clientWidth,
        h = r.clientHeight;
      c.width = w * devicePixelRatio;
      c.height = h * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const cx = w / 2,
        cy = h / 2;
      // Faint orbit path.
      const radius = Math.max(
        ...nodes.current.map((n) => Math.hypot(n.x, n.y / ORBIT_SQUASH)),
      );
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * ORBIT_SQUASH, 0, 0, Math.PI * 2);
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = "#ffffff1c";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of wisps) {
        if (moving) p.y -= p.speed * dt;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        const fade = Math.sin(Math.min(1, Math.max(0, p.y)) * Math.PI);
        ctx.beginPath();
        ctx.arc(
          p.x * w + Math.sin(t / 2400 + p.phase) * 10,
          p.y * h,
          p.size,
          0,
          Math.PI * 2,
        );
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = tint.current;
        ctx.shadowColor = tint.current;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      nodes.current.forEach((n, i) => {
        const p = place(n),
          x = cx + p.x,
          y = cy + p.y;
        const b = buttons.current[i];
        if (b) {
          b.style.left = `calc(50% + ${p.x.toFixed(1)}px)`;
          b.style.top = `calc(50% + ${p.y.toFixed(1)}px)`;
        }
        // Tether fades from Yami's glow to the card's colour.
        const line = ctx.createLinearGradient(cx, cy, x, y);
        line.addColorStop(0, tint.current + "cc");
        line.addColorStop(1, slotsRef.current[i].color + "88");
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx + p.x * 0.9, cy, x - p.x * 0.2, y + 35, x, y);
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = tint.current;
        ctx.shadowBlur = 6;
        ctx.stroke();
        const phase = (t / 3000 + i * 0.2) % 1,
          px = (1 - phase) * cx + phase * x,
          py = (1 - phase) * cy + phase * y;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className="loadout-hub"
      ref={root}
      style={{ "--soul": glow } as React.CSSProperties}
      onPointerMove={(e) => {
        const i = dragging.current;
        if (i < 0) return;
        const rect = e.currentTarget.getBoundingClientRect(),
          x = e.clientX - rect.left - rect.width / 2,
          y = e.clientY - rect.top - rect.height / 2;
        // Store the card unrotated so it keeps orbiting from where it was dropped.
        const radius = Math.hypot(x, y / ORBIT_SQUASH),
          a = Math.atan2(y / ORBIT_SQUASH, x) - angle.current;
        nodes.current[i] = {
          x: radius * Math.cos(a),
          y: radius * Math.sin(a) * ORBIT_SQUASH,
        };
      }}
      onPointerUp={() => {
        dragging.current = -1;
      }}
    >
      <canvas ref={canvas} />
      <div className="soul-orbit">
        <Spirit soul={state.settings.soul} size={118} />
      </div>
      {slots.map((l, i) => (
        <button
          type="button"
          key={l.slot}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          className="loadout-node"
          style={
            {
              left: `calc(50% + ${place(nodes.current[i]).x}px)`,
              top: `calc(50% + ${place(nodes.current[i]).y}px)`,
              "--slot": l.color,
            } as React.CSSProperties
          }
          onPointerEnter={() => {
            paused.current = true;
          }}
          onPointerLeave={() => {
            paused.current = false;
          }}
          onPointerDown={(e) => {
            dragging.current = i;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onClick={() => open(l.slot)}
        >
          <span className="slot-icon">
            <Icon name={l.icon} size={16} />
          </span>
          <span>
            <b>{l.value}</b>
            <small>{l.label}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
