import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Spirit, useYami } from "./ui";

const FLEE = [
  "Nope.",
  "Hands off the floof.",
  "Personal space, please.",
  "Too slow.",
  "I bite. Spiritually.",
  "Not now, I'm haunting.",
  "Shoo.",
  "You'll have to be quicker than that.",
];
const GIVE_UP = ["Fine. You win.", "Okay, okay. Hi.", "Persistent. I like it."];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

// Yami out on the desktop: dodges the cursor a couple of times, then lets you
// catch her. Click opens Yami; drag moves her. She naps when left alone.
export function Stray() {
  const { state } = useYami((e) => {
    if (e.type === "stray-move") {
      setMoving(e.moving);
      setDrag(e.moving ? { x: e.x, y: e.y } : undefined);
    } else if (e.type === "stray-dock") setDocked(e.docked);
  });
  const [moving, setMoving] = useState(false),
    [drag, setDrag] = useState<{ x: number; y: number }>(),
    [docked, setDocked] = useState(false),
    [bubble, setBubble] = useState(""),
    [asleep, setAsleep] = useState(false);
  const chase = useRef({ count: 0, at: 0 }),
    press = useRef<{ x: number; y: number; moved: number } | null>(null),
    bubbleTimer = useRef<any>(null),
    napTimer = useRef<any>(null);
  const say = (text: string) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(""), 2600);
  };
  const stir = () => {
    setAsleep(false);
    clearTimeout(napTimer.current);
    napTimer.current = setTimeout(() => setAsleep(true), 60_000);
  };
  useEffect(() => {
    stir();
    return () => {
      clearTimeout(napTimer.current);
      clearTimeout(bubbleTimer.current);
    };
  }, []);
  useEffect(() => {
    if (state)
      document.documentElement.dataset.reduced = String(
        state.settings.reducedMotion,
      );
  }, [state]);
  if (!state) return null;
  return (
    <div className={`stray-window ${docked ? "docked" : ""}`}>
      {bubble && <div className="stray-bubble">{bubble}</div>}
      <div
        className="stray-cat"
        onPointerEnter={(e) => {
          void api("stray.mouse", { ignore: false });
          if (press.current) return;
          stir();
          const now = Date.now(),
            c = chase.current;
          c.count = now - c.at < 6000 ? c.count + 1 : 1;
          c.at = now;
          if (c.count <= 2) {
            say(pick(FLEE));
            void api("stray.flee", { x: e.clientX, y: e.clientY });
          } else if (c.count === 3) say(pick(GIVE_UP));
        }}
        onPointerLeave={() => {
          if (!press.current) void api("stray.mouse", { ignore: true });
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press.current = { x: e.screenX, y: e.screenY, moved: 0 };
          stir();
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p) return;
          const dx = e.screenX - p.x,
            dy = e.screenY - p.y;
          if (!dx && !dy) return;
          p.moved += Math.abs(dx) + Math.abs(dy);
          p.x = e.screenX;
          p.y = e.screenY;
          setDrag({ x: Math.sign(dx), y: Math.sign(dy) });
          void api("stray.drag", { dx, dy });
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          setDrag(undefined);
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (p && p.moved < 5) {
            say("Mrrp?");
            void api("stray.open");
          }
        }}
      >
        <Spirit
          size={96}
          soul={state.settings.soul}
          state={asleep ? "sleeping" : "idle"}
          active={moving || !!drag}
          drag={drag}
        />
      </div>
    </div>
  );
}
