// Preview stand-ins for module and pack requests. Nothing is downloaded; pack
// progress is simulated so the screens can be designed.
import type { State, YamiEvent } from "../shared";
import {
  modules,
  type ModuleId,
  type ModuleStatus,
  type PackId,
  type PackStatus,
} from "../modules";
import { tweaks } from "../tune-types";

const sizes: Record<PackId, number> = {
  ffmpeg: 101_000_000,
  magick: 38_000_000,
  sevenZip: 600_000,
  sevenExtra: 1_600_000,
  exiftool: 26_000_000,
  needle: 1_570_816,
  whistle: 16_919_407,
};
const packs = new Map<PackId, PackStatus>();
// "Show file extensions" starts as already set before Yami, to show the lock.
const applied = new Set<string>(["fileExtensions"]);
const tuneStates = () =>
  tweaks.map((t) => ({
    id: t.id,
    applied: applied.has(t.id),
    undoable: applied.has(t.id) && t.id !== "fileExtensions",
  }));
const timers = new Map<PackId, ReturnType<typeof setInterval>>();

function pack(id: PackId): PackStatus {
  return (
    packs.get(id) || {
      id,
      version: "preview",
      license: "See the file wheel notes",
      bytes: sizes[id],
      state: id === "sevenZip" ? "installed" : "missing",
    }
  );
}

function list(state: State): ModuleStatus[] {
  return modules.map((m) => ({
    id: m.id,
    enabled: !!state.settings[m.setting],
    loaded: m.id === "workbench" ? false : !!state.settings[m.setting],
    packs: m.packs.map(pack),
  }));
}

export function previewModules(
  method: string,
  a: any,
  state: State,
  emit: (event: YamiEvent) => void,
  changed: () => void,
) {
  const broadcast = () => emit({ type: "modules", modules: list(state) });
  const spec = (id: ModuleId) => {
    const found = modules.find((m) => m.id === id);
    if (!found) throw new Error("Unknown module.");
    return found;
  };
  switch (method) {
    case "modules.list":
      return list(state);
    case "modules.set":
      (state.settings as any)[spec(a.id).setting] = !!a.enabled;
      changed();
      broadcast();
      return list(state);
    case "setup.complete":
      for (const m of modules)
        (state.settings as any)[m.setting] = !!a.enabled?.[m.id];
      state.settings.setupDone = true;
      changed();
      for (const id of a.packs || []) install(id);
      broadcast();
      return true;
    case "packs.install":
      install(a.id);
      return pack(a.id);
    case "packs.cancel":
      clearInterval(timers.get(a.id));
      packs.set(a.id, { ...pack(a.id), state: "missing", received: 0 });
      broadcast();
      return pack(a.id);
    case "packs.remove":
      packs.set(a.id, { ...pack(a.id), state: "missing", received: 0 });
      broadcast();
      return pack(a.id);
    case "packs.installFile":
      emit({ type: "toast", message: "Preview only — no file was read." });
      return pack(a.id);
    // Tune changes nothing in preview; it only flips demo states.
    case "tune.list":
      return tuneStates();
    case "tune.apply":
      for (const id of a.ids || []) applied.add(id);
      return tuneStates();
    case "tune.undo":
      for (const id of a.ids || []) applied.delete(id);
      return tuneStates();
    case "tune.restartExplorer":
      emit({
        type: "toast",
        message: "Preview only — Explorer was not touched.",
      });
      return true;
  }
  throw new Error(`Desktop-only action: ${method}`);
  function install(id: PackId) {
    const total = sizes[id];
    packs.set(id, { ...pack(id), state: "downloading", received: 0 });
    broadcast();
    timers.set(
      id,
      setInterval(() => {
        const current = pack(id);
        const received = Math.min(total, (current.received || 0) + total / 8);
        packs.set(id, {
          ...current,
          received,
          state: received >= total ? "installed" : "downloading",
        });
        if (received >= total) clearInterval(timers.get(id));
        broadcast();
      }, 250),
    );
  }
}
