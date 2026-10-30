import { useEffect, useId, useRef, useState } from "react";
import {
  bodyPose,
  LAYER_COUNT,
  layerPath,
  REST,
  settle,
  stateEnergy,
  stepParticles,
  type Particle,
  type Point,
  type Pose,
} from "./motion";
import { skinFor } from "./skins";
import { BLUSH, EARS, EYES, MOUTH, WHISKERS } from "./features";

const LAYERS = Array.from({ length: LAYER_COUNT }, (_, i) => i);
const REST_PATHS = LAYERS.map((i) => layerPath(i, 0, 0));
const EMBERS = 10;
const reducedMotion = () =>
  document.documentElement.dataset.reduced === "true" ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
// "Living flame" keeps a gentle flicker even when nothing is happening.
const livingFlame = () => document.documentElement.dataset.flame === "on";

// Yami: a floating cat-eared spirit whose lower half burns downward. The
// flame flickers and sheds embers while she is active, then settles and
// stops requesting frames (unless Living flame is on).
export function YamiSpirit({
  state = "idle",
  soul = "yami",
  size = 100,
  active = false,
  drag,
  onClick,
}: {
  state?: string;
  soul?: string;
  size?: number;
  active?: boolean;
  drag?: Point;
  onClick?: () => void;
}) {
  const id = useId().replaceAll(":", "");
  const skin = skinFor(soul);
  const [hover, setHover] = useState(false);
  const figure = useRef<SVGGElement>(null),
    layers = useRef<(SVGPathElement | null)[]>([]),
    auraGroup = useRef<SVGGElement>(null),
    ears = useRef<(SVGGElement | null)[]>([]),
    eyes = useRef<(SVGEllipseElement | null)[]>([]),
    mouth = useRef<SVGEllipseElement>(null),
    embers = useRef<(SVGCircleElement | null)[]>([]);
  const live = useRef({ state, active, hover, drag, lingerUntil: 0 });
  const loop = useRef<{ frame: number; wake: () => void }>({
    frame: 0,
    wake: () => {},
  });
  live.current = { ...live.current, state, active, hover, drag };

  useEffect(() => {
    let energy = 0,
      t = 0,
      last = 0,
      settling = false,
      pace: ReturnType<typeof setTimeout> | undefined,
      lastGlow = "",
      particles: Particle[] = [];
    const pose: Pose = { ...REST };
    const apply = (p: Pose, paths: string[]) => {
      paths.forEach((d, i) => layers.current[i]?.setAttribute("d", d));
      figure.current?.setAttribute(
        "transform",
        `translate(0 ${p.bob.toFixed(2)}) rotate(${p.tilt.toFixed(2)} 50 60) translate(50 46) scale(${(2 - p.squash).toFixed(3)} ${p.squash.toFixed(3)}) translate(-50 -46)`,
      );
      ears.current.forEach((e, i) =>
        e?.setAttribute(
          "transform",
          `rotate(${(p.ear * EARS[i].side).toFixed(2)} ${EARS[i].pivot})`,
        ),
      );
      // The blurred glow is costly to redraw, so it stays put and only steps
      // its brightness when that changes noticeably.
      const glow = (Math.round(p.glow * 20) / 20).toFixed(2);
      if (glow !== lastGlow) {
        lastGlow = glow;
        auraGroup.current?.setAttribute("opacity", glow);
      }
      eyes.current.forEach((e, i) =>
        e?.setAttribute(
          "ry",
          (EYES[i].ry * Math.max(0.12, p.blink)).toFixed(2),
        ),
      );
      mouth.current?.setAttribute("ry", (p.mouth * 2.4).toFixed(2));
      mouth.current?.setAttribute("opacity", p.mouth > 0.05 ? "1" : "0");
      embers.current.forEach((c, i) => {
        const q = particles[i];
        if (!c) return;
        if (!q) return c.setAttribute("opacity", "0");
        const fade = 1 - q.age / q.life;
        c.setAttribute("cx", q.x.toFixed(2));
        c.setAttribute("cy", q.y.toFixed(2));
        c.setAttribute("r", (q.r * (0.5 + fade * 0.5)).toFixed(2));
        c.setAttribute("opacity", (fade * 0.9).toFixed(3));
      });
    };
    const target = () => {
      const s = live.current;
      if (s.active) return 1;
      if (s.hover || performance.now() < s.lingerUntil) return 0.6;
      return Math.max(stateEnergy(s.state), livingFlame() ? 0.35 : 0);
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      t += dt;
      const goal = target();
      energy += (goal - energy) * (1 - 0.94 ** (dt * 60));
      const s = live.current;
      particles = stepParticles(particles, dt, goal * 6, Math.random, EMBERS);
      if (goal === 0 && energy < 0.02) {
        settling = true;
        const done = settle(pose);
        apply(
          pose,
          LAYERS.map((i) => layerPath(i, t, energy)),
        );
        if (done && !particles.length) {
          apply(bodyPose(s.state, 0, 0), REST_PATHS);
          loop.current.frame = 0;
          last = 0;
          return;
        }
      } else {
        settling = false;
        Object.assign(pose, bodyPose(s.state, t, Math.max(energy, 0.15)));
        apply(
          pose,
          LAYERS.map((i) => layerPath(i, t, energy, s.drag)),
        );
      }
      const idleFlame =
        !s.active &&
        !s.hover &&
        performance.now() >= s.lingerUntil &&
        stateEnergy(s.state) === 0;
      if (idleFlame && goal > 0) {
        // Living flame at idle: about 30 fps is plenty for a gentle flicker
        // and avoids waking at a 144 Hz monitor's full rate.
        loop.current.frame = -1;
        pace = setTimeout(() => {
          loop.current.frame = requestAnimationFrame(tick);
        }, 30);
      } else loop.current.frame = requestAnimationFrame(tick);
    };
    loop.current.wake = () => {
      if (reducedMotion()) {
        particles = [];
        apply(bodyPose(live.current.state, 0, 0), REST_PATHS);
        return;
      }
      if (!loop.current.frame && (target() > 0 || settling))
        loop.current.frame = requestAnimationFrame(tick);
    };
    loop.current.wake();
    const wake = () => loop.current.wake();
    addEventListener("yami-flame", wake);
    return () => {
      removeEventListener("yami-flame", wake);
      clearTimeout(pace);
      cancelAnimationFrame(loop.current.frame);
      loop.current.frame = 0;
    };
  }, []);

  useEffect(() => loop.current.wake(), [state, active, hover, drag]);

  return (
    <span
      className={`spirit spirit-${state}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        live.current.lingerUntil = performance.now() + 2500;
        setHover(false);
      }}
    >
      <svg viewBox="-5 4 110 110" role="img" aria-label={`Yami ${state}`}>
        <defs>
          <filter id={id + "g"} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={id + "s"} x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <ellipse
          cx="50"
          cy="108"
          rx="15"
          ry="2.6"
          fill={skin.glow}
          opacity=".4"
          filter={`url(#${id}s)`}
        />
        <g
          ref={auraGroup}
          opacity={REST.glow}
          filter={`url(#${id}g)`}
          fill={skin.glow}
        >
          <path d={REST_PATHS[0]} />
        </g>
        <g fill={skin.glow}>
          {Array.from({ length: EMBERS }, (_, i) => (
            <circle
              key={i}
              ref={(el) => {
                embers.current[i] = el;
              }}
              r="0"
              opacity="0"
            />
          ))}
        </g>
        <g ref={figure}>
          {EARS.map((e, i) => (
            <g
              key={i}
              ref={(el) => {
                ears.current[i] = el;
              }}
            >
              <path d={e.outer} fill={skin.flame[0]} />
              <path d={e.inner} fill={skin.flame[1]} />
            </g>
          ))}
          {LAYERS.map((i) => (
            <path
              key={i}
              ref={(el) => {
                layers.current[i] = el;
              }}
              d={REST_PATHS[i]}
              fill={skin.flame[i]}
            />
          ))}
          <g fill={skin.glow} opacity=".35">
            {BLUSH.map((b) => (
              <ellipse key={b.cx} {...b} />
            ))}
          </g>
          <g
            fill="none"
            stroke={skin.line}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={WHISKERS} opacity=".55" />
            <path d={MOUTH} />
          </g>
          <g className="spirit-eyes" fill={skin.eye}>
            {EYES.map((e, i) => (
              <ellipse
                key={i}
                ref={(el) => {
                  eyes.current[i] = el;
                }}
                cx={e.cx}
                cy={e.cy}
                rx={e.rx}
                ry={state === "sleeping" ? e.ry * 0.12 : e.ry}
              />
            ))}
          </g>
          <ellipse
            ref={mouth}
            cx="50"
            cy="55.6"
            rx="2.2"
            ry="0"
            opacity="0"
            fill={skin.line}
          />
        </g>
      </svg>
    </span>
  );
}
