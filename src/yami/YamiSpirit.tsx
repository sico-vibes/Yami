import { useEffect, useId, useRef, useState } from "react";
import {
  bodyPose,
  REST,
  settle,
  stateEnergy,
  tailPath,
  tailSpine,
  type Point,
  type Pose,
} from "./motion";
import { skinFor } from "./skins";

const BODY =
  "M47 10C48.5 14 50.5 18 53 23C58 25 63 28 66 31C74 38 79 48 80 60C82 72 83 84 81 93C78 104 67 110 54 110C39 110 29 104 27 92C25 80 27 66 27 56C23 53 18 51 14 48.5C10 46 9.5 40 13 38.5C16 37 20 38.5 23 39.5C23 33 27 27 33 23C38 20 42 16 47 10Z";
const EAR = "M54 30C59 25 64 21 69 18C71 25 73 34 76 44C69 39 61 34 54 30Z";
const EAR_LINE = "M57.5 29.5C61.5 25.5 65.5 22 68.6 20C69.8 27 71 34 72.4 41";
const WHISKERS =
  "M36.5 49.2L45 49.8M37 51.6L45 53.4M20.8 34.6L23.4 35.3M20.9 36.8L23.5 36.9";
const MOUTH =
  "M42.6 53.4C42 56 42.6 58.2 44.6 60M42.9 57C45.5 57.6 48 59.2 50 62";
const EYES = [
  { cx: 29.4, cy: 37.4, rx: 2.8, ry: 3.9 },
  { cx: 40.4, cy: 44.4, rx: 3.1, ry: 4.2 },
];
const REST_TAIL = tailPath(tailSpine(0, 0));
const reducedMotion = () =>
  document.documentElement.dataset.reduced === "true" ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// The companion: a white cat-ghost whose tail and body only move while
// something is happening, then settle and stop requesting frames.
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
  const body = useRef<SVGGElement>(null),
    tail = useRef<SVGPathElement>(null),
    auraTail = useRef<SVGPathElement>(null),
    aura = useRef<SVGGElement>(null),
    ear = useRef<SVGGElement>(null),
    eyes = useRef<(SVGEllipseElement | null)[]>([]),
    mouth = useRef<SVGEllipseElement>(null);
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
      settling = false;
    const pose: Pose = { ...REST };
    const apply = (p: Pose, path: string) => {
      tail.current?.setAttribute("d", path);
      auraTail.current?.setAttribute("d", path);
      body.current?.setAttribute(
        "transform",
        `translate(0 ${p.bob.toFixed(2)}) rotate(${p.tilt.toFixed(2)} 50 84) translate(50 110) scale(${(2 - p.squash).toFixed(3)} ${p.squash.toFixed(3)}) translate(-50 -110)`,
      );
      ear.current?.setAttribute(
        "transform",
        `rotate(${p.ear.toFixed(2)} 65 38)`,
      );
      aura.current?.setAttribute("opacity", p.glow.toFixed(3));
      eyes.current.forEach((e, i) =>
        e?.setAttribute(
          "ry",
          (EYES[i].ry * Math.max(0.12, p.blink)).toFixed(2),
        ),
      );
      mouth.current?.setAttribute("ry", (p.mouth * 2.2).toFixed(2));
      mouth.current?.setAttribute("opacity", p.mouth > 0.05 ? "1" : "0");
    };
    const target = () => {
      const s = live.current;
      if (s.active) return 1;
      if (s.hover || performance.now() < s.lingerUntil) return 0.5;
      return stateEnergy(s.state);
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      t += dt;
      const goal = target();
      energy += (goal - energy) * (1 - Math.pow(0.94, dt * 60));
      const s = live.current;
      if (goal === 0 && energy < 0.02 && stateEnergy(s.state) === 0) {
        settling = true;
        const done = settle(pose);
        apply(pose, tailPath(tailSpine(t, energy)));
        if (done) {
          apply(bodyPose(s.state, 0, 0), REST_TAIL);
          loop.current.frame = 0;
          last = 0;
          return;
        }
      } else {
        settling = false;
        Object.assign(pose, bodyPose(s.state, t, Math.max(energy, 0.15)));
        apply(pose, tailPath(tailSpine(t, energy, s.drag)));
      }
      loop.current.frame = requestAnimationFrame(tick);
    };
    loop.current.wake = () => {
      if (reducedMotion()) {
        apply(bodyPose(live.current.state, 0, 0), REST_TAIL);
        return;
      }
      if (!loop.current.frame && (target() > 0 || settling))
        loop.current.frame = requestAnimationFrame(tick);
    };
    loop.current.wake();
    return () => cancelAnimationFrame(loop.current.frame);
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
      <svg viewBox="2 4 110 110" role="img" aria-label={`Yami ${state}`}>
        <defs>
          <radialGradient
            id={id + "b"}
            gradientUnits="userSpaceOnUse"
            cx="40"
            cy="44"
            r="78"
          >
            <stop offset="0" stopColor={skin.body[0]} />
            <stop offset=".55" stopColor={skin.body[1]} />
            <stop offset="1" stopColor={skin.body[2]} />
          </radialGradient>
          <filter id={id + "g"} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g
          ref={aura}
          opacity={REST.glow}
          filter={`url(#${id}g)`}
          fill={skin.glow}
        >
          <path ref={auraTail} d={REST_TAIL} />
          <path d={BODY} />
        </g>
        <g ref={body}>
          <path ref={tail} d={REST_TAIL} fill={`url(#${id}b)`} />
          <g ref={ear}>
            <path d={EAR} fill={`url(#${id}b)`} />
            <path
              d={EAR_LINE}
              fill="none"
              stroke={skin.line}
              strokeWidth="0.85"
              strokeLinecap="round"
            />
          </g>
          <path d={BODY} fill={`url(#${id}b)`} />
          <g
            fill="none"
            stroke={skin.line}
            strokeWidth="0.85"
            strokeLinecap="round"
          >
            <path d={WHISKERS} opacity=".8" />
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
                transform={`rotate(-24 ${e.cx} ${e.cy})`}
              />
            ))}
          </g>
          <ellipse
            ref={mouth}
            cx="44.2"
            cy="58"
            rx="1.6"
            ry="0"
            opacity="0"
            fill={skin.line}
          />
        </g>
      </svg>
    </span>
  );
}
