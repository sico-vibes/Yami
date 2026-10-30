import { useEffect, useRef } from "react";
import type { Petal, WheelFile, WheelMode } from "./types";
import { bytes } from "../api";
import { Icon } from "../ui";
import { PETAL_ICON } from "./icons";

const MODE_LABEL: Record<WheelMode, string> = {
  convert: "Convert",
  tools: "Tools",
  actions: "Actions",
};

export function WheelView({
  mode,
  files,
  petals,
  activeId,
  hint,
  reducedMotion,
  onActive,
  onChoose,
}: {
  mode: WheelMode;
  files: WheelFile[];
  petals: Petal[];
  activeId: string | null;
  hint: string;
  reducedMotion: boolean;
  onActive: (id: string | null) => void;
  onChoose: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.focus();
  }, [mode, files.length]);
  const dense = petals.length > 6;
  const radius = dense ? 214 : 196;
  const lead = files[0];
  const size = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const title = !lead
    ? "Drop a file"
    : files.length === 1
      ? lead.name
      : `${lead.name} +${files.length - 1}`;
  const move = (step: number) => {
    if (!petals.length) return;
    const index = Math.max(
      0,
      petals.findIndex((petal) => petal.id === activeId),
    );
    const next = petals[(index + step + petals.length) % petals.length];
    onActive(next.id);
  };
  return (
    <div
      ref={root}
      className="wheel-stage"
      tabIndex={0}
      role="listbox"
      aria-label={`${MODE_LABEL[mode]} wheel`}
      data-reduced={reducedMotion ? "1" : "0"}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          onActive(petals[0]?.id ?? null);
        } else if (event.key === "End") {
          event.preventDefault();
          onActive(petals.at(-1)?.id ?? null);
        } else if (event.key === "Enter" && activeId) {
          event.preventDefault();
          onChoose(activeId);
        }
      }}
    >
      <div className="wheel-center">
        <p className="wheel-kicker">{MODE_LABEL[mode]}</p>
        <p className="wheel-name">{title}</p>
        <p className="wheel-size">{files.length ? bytes(size) : "—"}</p>
      </div>
      {petals.map((petal, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / petals.length;
        return (
          <button
            key={petal.id}
            type="button"
            role="option"
            aria-checked={petal.id === activeId}
            data-id={petal.id}
            className={`wheel-chip${dense ? " dense" : ""}`}
            style={
              {
                transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                "--i": index,
              } as React.CSSProperties
            }
            onMouseEnter={() => onActive(petal.id)}
            onFocus={() => onActive(petal.id)}
            onClick={() => onChoose(petal.id)}
          >
            {PETAL_ICON[petal.id] && (
              <Icon name={PETAL_ICON[petal.id]} size={dense ? 14 : 16} />
            )}
            {petal.label}
          </button>
        );
      })}
      {!petals.length && <p className="wheel-empty">{hint}</p>}
      {!!petals.length && <p className="wheel-hint">{hint}</p>}
    </div>
  );
}
