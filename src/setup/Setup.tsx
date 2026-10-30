import { useState } from "react";
import { api } from "../api";
import {
  modules,
  presetSelection,
  type ModuleId,
  type PackId,
  type SetupPreset,
} from "../modules";
import type { State } from "../shared";
import { Spirit } from "../ui";
import { ModuleCard } from "./ModuleCard";
import { useModules } from "./use-modules";

const presets: { id: SetupPreset | "custom"; label: string }[] = [
  { id: "essentials", label: "Essentials" },
  { id: "developer", label: "Developer" },
  { id: "tinkerer", label: "Tinkerer" },
  { id: "everything", label: "Everything" },
  { id: "custom", label: "Custom" },
];

/** First-run choice of modules, also reachable later from the tray. */
export function Setup({
  state,
  report,
  onDone,
}: {
  state: State;
  report: (message: string) => void;
  onDone: () => void;
}) {
  const status = useModules(report);
  const [preset, setPreset] = useState<SetupPreset | "custom">(
    state.settings.setupDone ? "custom" : "essentials",
  );
  const [enabled, setEnabled] = useState<Record<ModuleId, boolean>>(() =>
    state.settings.setupDone
      ? (Object.fromEntries(
          modules.map((m) => [m.id, !!state.settings[m.setting]]),
        ) as Record<ModuleId, boolean>)
      : presetSelection("essentials"),
  );
  const [packs, setPacks] = useState<PackId[]>([]);
  const [busy, setBusy] = useState(false);
  const count = Object.values(enabled).filter(Boolean).length;
  const choosePreset = (id: SetupPreset | "custom") => {
    setPreset(id);
    if (id !== "custom") setEnabled(presetSelection(id));
  };
  const finish = () => {
    setBusy(true);
    const wanted = packs.filter((p) =>
      modules.some((m) => enabled[m.id] && m.packs.includes(p)),
    );
    void api("setup.complete", { enabled, packs: wanted })
      .then(onDone)
      .catch((e) => report(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="setup-page">
      <div className="page-head">
        <div>
          <h1>Choose your Yami</h1>
          <p className="page-description">
            Wake what you need. Everything else stays asleep and costs nothing.
            Change it any time in Settings › Modules.
          </p>
        </div>
        <Spirit size={56} soul={state.settings.soul} />
      </div>
      <div className="setup-presets" role="radiogroup" aria-label="Preset">
        {presets.map((p) => (
          <button
            type="button"
            key={p.id}
            role="radio"
            aria-checked={preset === p.id}
            className={preset === p.id ? "selected" : ""}
            onClick={() => choosePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="module-grid">
        {modules.map((spec) => (
          <ModuleCard
            key={spec.id}
            spec={spec}
            enabled={enabled[spec.id]}
            onToggle={(value) => {
              setPreset("custom");
              setEnabled((old) => ({ ...old, [spec.id]: value }));
            }}
            packs={status?.find((s) => s.id === spec.id)?.packs}
            chosen={packs}
            onChoose={(id, value) =>
              setPacks((old) =>
                value ? [...old, id] : old.filter((p) => p !== id),
              )
            }
          />
        ))}
      </div>
      <footer className="setup-foot">
        <span className="setting-note">
          {count === 1 ? "1 module" : `${count} modules`} on
          {packs.length
            ? ` · ${packs.length} download${packs.length === 1 ? "" : "s"} queued`
            : " · nothing to download yet"}
        </span>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={finish}
        >
          {busy
            ? "Saving…"
            : state.settings.setupDone
              ? "Save"
              : "Start with Yami"}
        </button>
      </footer>
    </div>
  );
}
