import { useEffect, useRef, useState } from "react";
import type { State } from "./shared";
import { api } from "./api";
import { Icon, IconButton, Spirit } from "./ui";
type Card = {
  id: string;
  name: string;
  price: number;
  icon?: string;
  soul?: string;
  description: string;
  label?: string;
  color: string;
};
const souls: Card[] = [
  {
    id: "yami",
    name: "Yami",
    price: 0,
    soul: "yami",
    description:
      "The cat as she first drifted in: moon-white fur, ink-dark eyes.",
    label: "Common",
    color: "#8dccff",
  },
  {
    id: "ember",
    name: "Ember",
    price: 160,
    soul: "ember",
    description: "Warm as a hearth and twice as stubborn.",
    label: "Common",
    color: "#ffa070",
  },
  {
    id: "wisp",
    name: "Wisp",
    price: 160,
    soul: "wisp",
    description: "Swamp-light green. Follow her at your own risk.",
    label: "Common",
    color: "#6fd79a",
  },
  {
    id: "amethyst",
    name: "Amethyst",
    price: 400,
    soul: "amethyst",
    description: "Calm, violet and quietly judging you.",
    label: "Rare",
    color: "#a97bff",
  },
  {
    id: "gilded",
    name: "Gilded",
    price: 400,
    soul: "gilded",
    description: "Shrine-cat gold, polished by a thousand offerings.",
    label: "Rare",
    color: "#ffc24a",
  },
  {
    id: "void",
    name: "Void",
    price: 1000,
    soul: "void",
    description:
      "A cat-shaped hole in the night sky. Includes the Collapse ability: tap Yami while she rests, then fold space wherever you click.",
    label: "Legendary",
    color: "#a78adf",
  },
];
const voices: Card[] = [
  "Charon",
  "Puck",
  "Leda",
  "Aoede",
  "Enceladus",
  "Algenib",
  "Laomedeia",
  "Jack",
  "Ankit",
  "Cheng",
  "Linda",
].map((id, i) => ({
  id,
  name: id,
  price: i ? 240 : 0,
  icon: "waveform",
  description: [
    "The default voice. Low, steady and a little mysterious.",
    "Upbeat and quick, like it already had the coffee.",
    "Young and bright, with opinions about everything.",
    "Warm and unhurried, a late-night radio host.",
    "Soft-spoken and thoughtful. Picks words carefully.",
    "Plain-spoken and practical. Straight to the point.",
    "Smooth and faintly eerie. Suits a ghost.",
    "Easygoing and friendly, like an old classmate.",
    "Indian English accent, clear and patient.",
    "Chinese-accented English, careful and kind.",
    "Dry wit, quick comebacks, a little savage.",
  ][i],
  color: "#5ac7e3",
}));
const personalities: Card[] = [
  {
    id: "chad",
    name: "Alley Cat",
    price: 0,
    icon: "smiley",
    description: "",
    label: "Built in",
    color: "#ff994f",
  },
  {
    id: "custom",
    name: "New",
    price: 100,
    icon: "plus",
    description: "",
    label: "personality",
    color: "#ff994f",
  },
];
const abilities: Card[] = [
  {
    id: "collapse",
    name: "Collapse",
    price: 0,
    icon: "planet",
    description:
      "Tap Yami while she rests, then fold space wherever you click. Only comes with the Void skin.",
    color: "#e6c07a",
  },
  {
    id: "sidearm",
    name: "Sidearm",
    price: 400,
    icon: "crosshair",
    description:
      "Yami spits a tiny spark wherever you click next. Harmless, satisfying.",
    color: "#e6c07a",
  },
];
export function Loadout({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [picker, setPicker] = useState(""),
    [index, setIndex] = useState(0),
    [binding, setBinding] = useState(false);
  useEffect(() => {
    if (!binding) return;
    void api("shortcuts.capture", { active: true });
    const save = (value: string) => {
      void api("settings", { abilityButton: value }).catch((e) =>
        report(e.message),
      );
      setBinding(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setBinding(false);
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") setBinding(false);
      else save("K:" + e.keyCode);
    };
    const mouse = (e: MouseEvent) => {
      e.preventDefault();
      if (e.button <= 2) save(["M1", "M3", "M2"][e.button]);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", mouse);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("mousedown", mouse);
      void api("shortcuts.capture", { active: false });
    };
  }, [binding]);
  const lists: Record<string, Card[]> = {
    soul: souls,
    voice: voices,
    personality: personalities,
    ability: abilities,
  };
  const open = (slot: string) => {
    setPicker(slot);
    setIndex(
      Math.max(
        0,
        lists[slot].findIndex((c) => c.id === (state.settings as any)[slot]),
      ),
    );
  };
  const cards = lists[picker] || [],
    current = cards[index];
  return (
    <section className={"loadout-page " + (picker ? "catalogue-open" : "")}>
      {!picker ? (
        <>
          <h2>Loadout</h2>
          <Hub state={state} open={open} />
        </>
      ) : (
        <>
          <div className="picker-head">
            <h2>
              {picker === "ability"
                ? "Abilities"
                : picker === "soul"
                  ? "Skins"
                  : picker[0].toUpperCase() + picker.slice(1)}
            </h2>
            <span className="embers">
              {state.embers.toLocaleString()} embers
            </span>
            <IconButton
              icon="x"
              label="Close catalogue"
              onClick={() => setPicker("")}
            />
          </div>
          <div
            className="card-stage"
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > 5)
                setIndex((i) =>
                  Math.max(
                    0,
                    Math.min(cards.length - 1, i + (e.deltaY > 0 ? 1 : -1)),
                  ),
                );
            }}
          >
            <div className="card-deck">
              {cards.map((card, i) => {
                const delta = i - index,
                  owned = state.owned.includes(card.id),
                  active = (state.settings as any)[picker] === card.id,
                  locked =
                    card.id === "collapse"
                      ? !state.owned.includes("void")
                      : !owned && state.embers < card.price;
                return (
                  <article
                    className="loadout-card"
                    data-front={delta === 0}
                    data-active={active}
                    key={card.id}
                    style={
                      {
                        "--tint": card.color,
                        transform: `translateX(${delta === 0 ? 0 : Math.sign(delta) * (24 + Math.min(Math.abs(delta), 3) * 12)}px) rotate(${delta === 0 ? 0 : Math.sign(delta) * (2 + Math.min(Math.abs(delta), 3) * 2)}deg)`,
                        zIndex: 100 - Math.abs(delta),
                        opacity:
                          Math.abs(delta) > 3 ? 0 : delta === 0 ? 1 : 0.7,
                      } as React.CSSProperties
                    }
                    onClick={() => {
                      if (delta) setIndex(i);
                    }}
                  >
                    <div className="card-art">
                      {locked && picker === "voice" ? (
                        <Icon name="lock-simple" size={82} />
                      ) : card.soul ? (
                        <Spirit soul={card.soul} size={85} />
                      ) : (
                        <Icon name={card.icon!} size={72} />
                      )}
                    </div>
                    <h3>{card.name}</h3>
                    {card.label && <span className="rarity">{card.label}</span>}
                    <p>
                      {picker === "voice" && card.price > 0
                        ? ""
                        : card.description}
                    </p>
                    <button
                      disabled={active || locked}
                      className={locked || active ? "" : "buy-button"}
                      onClick={(e) => {
                        e.stopPropagation();
                        void api("loadout.equip", { id: card.id }).catch((e) =>
                          report(e.message),
                        );
                      }}
                    >
                      {active
                        ? picker === "soul"
                          ? "Worn"
                          : "Active"
                        : card.id === "collapse" && locked
                          ? "Not for sale"
                          : locked
                            ? `${card.price.toLocaleString()} embers · ${(card.price - state.embers).toLocaleString()} more to go`
                            : owned
                              ? "Equip"
                              : card.price
                                ? `Buy · ${card.price} embers`
                                : "Equip"}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="deck-controls">
              <IconButton
                icon="caret-left"
                label="Previous card"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              />
              <span>
                {index + 1} of {cards.length}
              </span>
              <IconButton
                icon="caret-right"
                label="Next card"
                disabled={index === cards.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              />
            </div>
          </div>
          {picker === "ability" && (
            <div className="trigger-row">
              <div>
                <strong>Trigger button</strong>
                <p>Click, then press any key or mouse button. Esc cancels.</p>
              </div>
              <button
                className="soft-button"
                aria-label="Change ability trigger"
                onClick={() => setBinding(true)}
              >
                {binding
                  ? "Press a key…"
                  : state.settings.abilityButton.startsWith("K:")
                    ? String.fromCharCode(
                        Number(state.settings.abilityButton.slice(2)),
                      )
                    : state.settings.abilityButton}
              </button>
            </div>
          )}
          {picker === "personality" &&
            current.id === "custom" &&
            state.owned.includes("custom") && (
              <textarea
                className="personality-input"
                placeholder="Describe how your companion should speak…"
                defaultValue={state.settings.customPersonality}
                onBlur={(e) =>
                  void api("settings", { customPersonality: e.target.value })
                }
              />
            )}
        </>
      )}
    </section>
  );
}
function Hub({ state, open }: { state: State; open: (s: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    root = useRef<HTMLDivElement>(null);
  const nodes = useRef([
    { x: -150, y: -90 },
    { x: 155, y: -85 },
    { x: -150, y: 95 },
    { x: 150, y: 100 },
  ]);
  const [revision, setRevision] = useState(0);
  const dragging = useRef(-1);
  useEffect(() => {
    let frame = 0;
    const c = canvas.current!,
      r = root.current!,
      ctx = c.getContext("2d")!;
    const draw = (t: number) => {
      const w = r.clientWidth,
        h = r.clientHeight;
      c.width = w * devicePixelRatio;
      c.height = h * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const cx = w / 2,
        cy = h / 2;
      nodes.current.forEach((p, i) => {
        const x = cx + p.x,
          y = cy + p.y;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx + p.x * 0.9, cy, x - p.x * 0.2, y + 35, x, y);
        ctx.strokeStyle = "#c4d3db";
        ctx.lineWidth = 1;
        ctx.stroke();
        const phase = (t / 3000 + i * 0.2) % 1,
          px = (1 - phase) * cx + phase * x,
          py = (1 - phase) * cy + phase * y;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#9ed9ff";
        ctx.shadowColor = "#8dccff";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  const labels = [
    {
      slot: "personality",
      label: "Personality",
      value: state.settings.personality === "chad" ? "Alley Cat" : "Custom",
      icon: "smiley",
      color: "#ff994f",
    },
    {
      slot: "voice",
      label: "Voice",
      value: state.settings.voice,
      icon: "waveform",
      color: "#5ac7e3",
    },
    {
      slot: "soul",
      label: "Skin",
      value: souls.find((c) => c.id === state.settings.soul)?.name || "Yami",
      icon: "sparkle",
      color: "#c3aaff",
    },
    {
      slot: "ability",
      label: "Abilities",
      value:
        abilities.find((c) => c.id === state.settings.ability)?.name || "—",
      icon: "rocket",
      color: "#6fd579",
    },
  ];
  return (
    <div
      className="loadout-hub"
      ref={root}
      data-revision={revision}
      onPointerMove={(e) => {
        const i = dragging.current;
        if (i < 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        nodes.current[i] = {
          x: e.clientX - rect.left - rect.width / 2,
          y: e.clientY - rect.top - rect.height / 2,
        };
        setRevision((v) => v + 1);
      }}
      onPointerUp={() => {
        dragging.current = -1;
      }}
    >
      <canvas ref={canvas} />
      <div className="soul-orbit">
        <Spirit soul={state.settings.soul} size={70} />
      </div>
      {labels.map((l, i) => (
        <button
          key={l.slot}
          className="loadout-node"
          style={{
            left: `calc(50% + ${nodes.current[i].x}px)`,
            top: `calc(50% + ${nodes.current[i].y}px)`,
          }}
          onPointerDown={(e) => {
            dragging.current = i;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onClick={() => open(l.slot)}
        >
          <span style={{ color: l.color }}>
            <Icon name={l.icon} size={17} />
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
