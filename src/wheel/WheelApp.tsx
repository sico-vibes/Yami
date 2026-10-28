import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import { emptyHint, petalsFor, PREVIEW_SAMPLES, wheelNames } from "./catalog";
import type { WheelFile, WheelMode, WheelSession } from "./types";
import { WheelView } from "./WheelView";

const preview = import.meta.env.VITE_YAMI_PREVIEW === "true";

function tick() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 740;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.03);
  window.setTimeout(() => void context.close(), 200);
}

export function WheelApp() {
  const [session, setSession] = useState<WheelSession | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sample, setSample] = useState("image");
  const [caps, setCaps] = useState<{ heicEncode?: boolean }>({});
  useEffect(() => {
    const pull = () => {
      void api("wheel.session").then((next: WheelSession) => {
        setSession(next);
        setActiveId(null);
      });
      void api("wheel.caps")
        .then(setCaps)
        .catch(() => setCaps({}));
    };
    pull();
    return window.yami.on((event) => {
      if (event.type === "wheel-session") {
        setSession(event.session);
        setActiveId(null);
      }
    });
  }, []);
  const names = session ? wheelNames(session.files) : [];
  const petals = useMemo(
    () => (session ? petalsFor(names, session.mode, caps) : []),
    [session, names.join("|"), caps.heicEncode],
  );
  useEffect(() => {
    if (!session?.sound || !activeId) return;
    if (session.reducedMotion) return;
    tick();
  }, [activeId]);
  if (!session) return <div className="wheel-root" />;
  const choose = (petalId: string) => {
    const paths = session.files.map((file) => file.path).filter(Boolean);
    void api("wheel.choose", { petalId, paths }).catch((error: Error) => {
      void api("wheel.fail", { message: error.message });
    });
  };
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const paths = [...event.dataTransfer.files].map(
      (file) => window.yami.filePath?.(file) || file.name,
    );
    if (!activeId || !paths.length) return;
    void api("wheel.choose", { petalId: activeId, paths });
  };
  const hint = petals.length
    ? session.hint
    : emptyHint(session.mode, names);
  return (
    <div
      className="wheel-root"
      onDragOver={(event) => {
        event.preventDefault();
        const hit = chipAt(event.clientX, event.clientY);
        if (hit) setActiveId(hit);
      }}
      onDrop={onDrop}
      onKeyDown={(event) => {
        const next: Record<string, WheelMode> = {
          Shift: "convert",
          Control: "tools",
          Alt: "actions",
        };
        const mode = next[event.key];
        if (mode && mode !== session.mode) {
          event.preventDefault();
          void api("wheel.swap", { mode });
        }
        if (event.key === "Escape") void api("wheel.close");
      }}
    >
      {preview && (
        <div className="wheel-sample">
          <Select
            label="Preview file sample"
            value={sample}
            options={PREVIEW_SAMPLES.map((item) => ({ value: item.id, label: item.label }))}
            onChange={(next) => {
              setSample(next);
              void api("wheel.sample", { id: next });
            }}
          />
        </div>
      )}
      <WheelView
        mode={session.mode}
        files={session.files as WheelFile[]}
        petals={petals}
        activeId={activeId}
        hint={hint}
        reducedMotion={session.reducedMotion}
        onActive={setActiveId}
        onChoose={choose}
      />
    </div>
  );
}

function chipAt(x: number, y: number) {
  const chip = document
    .elementsFromPoint(x, y)
    .find(
      (node) =>
        node instanceof HTMLElement && node.classList.contains("wheel-chip"),
    );
  return chip instanceof HTMLElement ? chip.dataset.id || null : null;
}
