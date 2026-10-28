import type { Settings } from "./shared";

// Every optional Yami feature is a module. A module that is off is never
// loaded, registers no work and starts no timers, helpers or windows. Heavy
// downloads belong to a module as packs; their pins live in the main process.

export type ModuleId =
  "fileWheel" | "workbench" | "clipboard" | "weather" | "roam";
export type ModuleCost = "low" | "medium" | "high";
export type ModulePermission =
  "network" | "microphone" | "screen" | "clipboard" | "admin" | "files";
export type PackId =
  "ffmpeg" | "magick" | "sevenZip" | "sevenExtra" | "exiftool";

export type ModuleSpec = {
  id: ModuleId;
  name: string;
  blurb: string;
  icon: string;
  /** Boolean setting that switches the module on. */
  setting: keyof Settings;
  cost: ModuleCost;
  permissions: ModulePermission[];
  /** Optional downloads; none are needed to turn the module on. */
  packs: PackId[];
  presets: SetupPreset[];
};

export type SetupPreset =
  "essentials" | "developer" | "tinkerer" | "everything";

export type PackState =
  "missing" | "queued" | "downloading" | "installed" | "failed";

export type PackStatus = {
  id: PackId;
  version: string;
  license: string;
  /** Download size in bytes, when known from the pin. */
  bytes?: number;
  state: PackState;
  received?: number;
  error?: string;
};

export type ModuleStatus = {
  id: ModuleId;
  enabled: boolean;
  /** True while the module's main-process code is loaded. */
  loaded: boolean;
  packs: PackStatus[];
};

/**
 * Requests: `modules.list` → ModuleStatus[]; `modules.set` { id, enabled } →
 * ModuleStatus[]; `setup.complete` { enabled, packs }; `packs.install`,
 * `packs.cancel`, `packs.remove` and `packs.installFile` take { id }.
 * Broadcast whenever a module or pack changes: `{ type: "modules", modules }`.
 */
export type ModulesEvent = { type: "modules"; modules: ModuleStatus[] };

export const modules: ModuleSpec[] = [
  {
    id: "workbench",
    name: "AI workspace",
    blurb:
      "Agent sessions and approvals, usage meters, connections, notes and Yami Terminal.",
    icon: "terminal-window",
    setting: "workbenchEnabled",
    cost: "low",
    permissions: ["files"],
    packs: [],
    presets: ["developer", "everything"],
  },
  {
    id: "fileWheel",
    name: "File wheel",
    blurb:
      "Drag a file, tap a key, and convert it or run a tool right where you are.",
    icon: "circle-dashed",
    setting: "fileWheelEnabled",
    cost: "low",
    permissions: ["files"],
    packs: ["ffmpeg", "magick", "sevenZip", "sevenExtra", "exiftool"],
    presets: ["essentials", "developer", "tinkerer", "everything"],
  },
  {
    id: "clipboard",
    name: "Clipboard history",
    blurb: "Keeps recent copied text so you can find it again.",
    icon: "clipboard-text",
    setting: "clipboardEnabled",
    cost: "medium",
    permissions: ["clipboard"],
    packs: [],
    presets: ["essentials", "developer", "tinkerer", "everything"],
  },
  {
    id: "weather",
    name: "Weather",
    blurb: "Today's weather on the Today card, for the city you choose.",
    icon: "cloud-sun",
    setting: "weatherEnabled",
    cost: "low",
    permissions: ["network"],
    packs: [],
    presets: ["everything"],
  },
  {
    id: "roam",
    name: "Roaming Yami",
    blurb: "Yami floats around your desktop and naps when you leave her be.",
    icon: "ghost",
    setting: "roam",
    cost: "low",
    permissions: [],
    packs: [],
    presets: ["essentials", "tinkerer", "everything"],
  },
];

export const packLabels: Record<PackId, string> = {
  ffmpeg: "FFmpeg (audio and video)",
  magick: "ImageMagick (images)",
  sevenZip: "7-Zip (packing)",
  sevenExtra: "7-Zip extra (7z and rar)",
  exiftool: "ExifTool (metadata)",
};

export function presetSelection(
  preset: SetupPreset,
): Record<ModuleId, boolean> {
  return Object.fromEntries(
    modules.map((m) => [m.id, m.presets.includes(preset)]),
  ) as Record<ModuleId, boolean>;
}
