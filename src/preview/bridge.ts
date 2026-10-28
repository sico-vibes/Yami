import type { YamiEvent, State } from "../shared";
import { PREVIEW_SAMPLES } from "../wheel/catalog";
import type { WheelMode } from "../wheel/types";
import { createFixture, demoApps, demoMetrics } from "./fixtures";
import { previewOverlay } from "./overlays";
import { previewWorkbench } from "./workbench";
import { previewModules } from "./modules";
import { islandSize, peekSize } from "../island-bounds";
let state = createFixture();
let wheelSample = "image";
let wheelMode: WheelMode = "convert";
let previewTool = "tool:background";
const listeners = new Set<(event: YamiEvent) => void>();
export function emit(event: YamiEvent) {
  if (event.type === "panel") sizeIsland(islandSize(event.open, event.tab));
  for (const fn of listeners) fn(event);
}
// Give the preview island the same size as the real island window.
function sizeIsland(size: { width: number; height: number }) {
  const root = document.documentElement.style;
  root.setProperty("--island-w", size.width + "px");
  root.setProperty("--island-h", size.height + "px");
}
function changed() {
  emit({ type: "state", state: structuredClone(state) });
}
function previewNames(tool: string) {
  if (tool === "tool:merge" || tool === "tool:organize" || tool === "tool:pdf-split")
    return ["notes.pdf", "extra.pdf"];
  if (tool === "tool:join") return ["one.mp4", "two.mp4"];
  if (tool.startsWith("tool:video") || tool === "tool:speed" || tool === "tool:snapshots" || tool === "tool:split")
    return ["clip.mp4"];
  if (["tool:trim", "tool:normalize", "tool:channels", "tool:bleep", "tool:visualizer"].includes(tool))
    return ["voice.wav"];
  if (tool === "tool:collage") return ["grove.png", "second.png"];
  return ["grove.png"];
}

function toast(message: string) {
  emit({ type: "toast", message });
}
function wheelSession() {
  const sample =
    PREVIEW_SAMPLES.find((item) => item.id === wheelSample) || PREVIEW_SAMPLES[0];
  return {
    id: "preview-wheel",
    mode: wheelMode,
    source: "hotkey",
    files: sample.names.map((name) => ({
      path: `preview://${encodeURIComponent(name)}`,
      name,
      size: 2306867,
      ext: name.includes(".") ? name.split(".").pop() : "",
    })),
    hint: "Preview only. Nothing is written to disk.",
    sound: state.settings.fileWheelSound,
    reducedMotion: state.settings.reducedMotion,
    x: 0,
    y: 0,
  };
}
/** The Setup preview screen starts as a brand-new profile. */
export function previewFirstRun() {
  state.settings.setupDone = false;
}
/** The Island preview shows two demo agents so the pill can cycle. */
export function previewAgents() {
  const demo = (id: string, agent: string, phase: string, detail: string) => ({
    id,
    agent,
    project: "Demo workspace",
    cwd: "Demo folder",
    phase,
    detail,
    at: Date.now(),
    source: "hook",
    files: [],
  });
  const sessions = [
    demo("demo-wait", "claude", "waiting", "Wants to run a test (demo)"),
    demo("demo-work", "codex", "working", "Reviewing a change (demo)"),
  ];
  setTimeout(
    () => emit({ type: "agent-activity", session: sessions[0], sessions }),
    300,
  );
}
export function resetPreview() {
  state = createFixture();
  changed();
}
export function installPreviewBridge() {
  window.yami = {
    on(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    filePath(file: File) {
      return `preview://${encodeURIComponent(file.name)}`;
    },
    async invoke(method, args = {}) {
      const a = args;
      if (/^(workbench|terminal|agents|connections|usage|local|context|speech|notes|mcp|meeting|dev)\./.test(method)) return previewWorkbench(method, a, emit);
      if (/^(modules|setup|packs)\./.test(method)) return previewModules(method, a, state, emit, changed);
      switch (method) {
        case "state":
          return structuredClone(state);
        case "window.ready":
          return true;
        case "settings":
          Object.assign(state.settings, a);
          changed();
          return structuredClone(state);
        case "diagnostics":
          return {
            app: "UI preview",
            electron: "Browser",
            windows: "Demo",
            encryption: false,
            native: { ok: false },
          };
        case "keys.models":
          return [];
        case "keys.usage":
          return null;
        case "keys.save":
          throw new Error(
            "Use the Windows app to connect keys. Preview never stores credentials.",
          );
        case "keys.remove":
          return true;
        case "cities":
          return [{ name: "Kyoto", country: "Japan", lat: 35.01, lon: 135.77 }];
        case "apps":
          return demoApps;
        case "apps.icon":
          return "";
        case "launcher.files":
          return [];
        case "apps.favorite":
          state.favorites = state.favorites.includes(a.path)
            ? state.favorites.filter((p) => p !== a.path)
            : [...state.favorites, a.path];
          changed();
          return true;
        case "apps.launch":
        case "files.open":
          toast("Preview only — nothing was opened on Windows.");
          return true;
        case "metrics":
          return demoMetrics;
        case "controls":
          return {
            volume: 64,
            muted: false,
            brightness: 70,
            dark: true,
            wifi: "Preview Wi-Fi",
            wifiConnected: true,
            bluetooth: false,
          };
        case "media":
          return {
            active: true,
            title: "Demo beats to relax to",
            artist: "Preview Radio",
            playing: true,
            position: 42,
            duration: 184,
          };
        case "control":
          toast("Preview only — Windows controls are unchanged.");
          return true;
        case "weather":
          return state.settings.weatherEnabled
            ? { place: "Kyoto", temperature: 21, condition: "partlycloudy_day" }
            : null;
        case "timer.state":
          return { endsAt: 0, duration: 0 };
        case "timer.start": {
          const duration = Number(a.minutes) * 60_000,
            timer = { endsAt: Date.now() + duration, duration };
          emit({ type: "timer", ...timer });
          return timer;
        }
        case "timer.stop":
          emit({ type: "timer", endsAt: 0, duration: 0 });
          return { endsAt: 0, duration: 0 };
        case "panel":
          emit({ type: "panel", open: !!a.open, tab: a.tab || "Controls" });
          return true;
        case "show":
          emit({ type: "navigate", tab: a.tab || "home" });
          return true;
        case "hide":
        case "minimize":
          toast("This is a browser preview.");
          return true;
        case "chat": {
          state.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            text: String(a.text),
            at: new Date().toISOString(),
          });
          state.messages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            text: "This is the UI preview. Voice, research, and Windows actions run in the desktop app.",
            at: new Date().toISOString(),
          });
          changed();
          return { text: state.messages.at(-1)?.text };
        }
        case "todo.add":
          state.todos.push({
            id: crypto.randomUUID(),
            title: String(a.title),
            done: false,
          });
          changed();
          return true;
        case "todo.toggle": {
          const t = state.todos.find((t) => t.id === a.id);
          if (t) t.done = !t.done;
          changed();
          return true;
        }
        case "todo.delete":
          state.todos = state.todos.filter((t) => t.id !== a.id);
          changed();
          return true;
        case "task.save":
          state.tasks = state.tasks.filter((t) => t.id !== a.id);
          state.tasks.push({
            ...a,
            id: a.id || crypto.randomUUID(),
            enabled: true,
          });
          changed();
          return true;
        case "task.toggle": {
          const t = state.tasks.find((t) => t.id === a.id);
          if (t) t.enabled = !t.enabled;
          changed();
          return true;
        }
        case "task.delete":
          state.tasks = state.tasks.filter((t) => t.id !== a.id);
          changed();
          return true;
        case "memory.save": {
          const m = state.memories.find((m) => m.id === a.id);
          if (m) m.text = a.text;
          else
            state.memories.push({
              id: crypto.randomUUID(),
              text: a.text,
              at: new Date().toISOString(),
            });
          changed();
          return true;
        }
        case "memory.delete":
          state.memories = state.memories.filter((m) => m.id !== a.id);
          changed();
          return true;
        case "memory.clear":
          state.memories = [];
          changed();
          return true;
        case "snippets.save":
          state.snippets.push({ ...a, id: crypto.randomUUID() });
          changed();
          return true;
        case "snippets.delete":
          state.snippets = state.snippets.filter((s) => s.id !== a.id);
          changed();
          return true;
        case "clipboard.clear":
          state.clipboard = [];
          changed();
          return true;
        case "clipboard.copy":
        case "snippets.copy":
          toast("Preview only — your system clipboard is unchanged.");
          return true;
        case "wallpapers.folder":
          toast("Use the desktop app to choose a Windows folder.");
          return null;
        case "wallpapers.apply":
          if (state.wallpapers.includes(a.path)) {
            state.currentWallpaper = a.path;
            changed();
          }
          return true;
        case "loadout.equip": {
          const slot =
            a.id === "chad" || a.id === "custom"
              ? "personality"
              : [
                    "yami",
                    "ember",
                    "wisp",
                    "amethyst",
                    "gilded",
                    "void",
                  ].includes(a.id)
                ? "soul"
                : ["collapse", "sidearm"].includes(a.id)
                  ? "ability"
                  : "voice";
          state.settings[slot] = a.id;
          if (!state.owned.includes(a.id)) state.owned.push(a.id);
          changed();
          return true;
        }
        case "power":
          toast("Preview only — no power action was performed.");
          return false;
        case "history.clear":
          state.messages = [];
          changed();
          return true;
        case "data.clear":
          resetPreview();
          return true;
        case "data.export":
          toast("Preview data is temporary and contains no desktop data.");
          return false;
        case "open.external":
          toast("External navigation is disabled in preview.");
          return false;
        case "voice.stop":
        case "ability.arm":
        case "shortcuts.capture":
        case "island.peek":
          sizeIsland(a.open ? peekSize : islandSize(false, ""));
          return true;
        case "island.mouse":
        case "selection.clear":
          return true;
        case "wheel.session":
          return wheelSession();
        case "wheel.caps":
          return { heicEncode: false };
        case "wheel.float.get":
          return {
            files: [
              {
                path: "preview://grove.png",
                name: "grove.png",
                size: 2306867,
                ext: "png",
              },
            ],
          };
        case "wheel.float.close":
          toast("Preview closed the float shelf.");
          return true;
        case "wheel.swap":
          wheelMode = a.mode || wheelMode;
          emit({ type: "wheel-session", session: wheelSession() });
          return wheelSession();
        case "wheel.sample":
          wheelSample = String(a.id || wheelSample);
          emit({ type: "wheel-session", session: wheelSession() });
          return wheelSession();
        case "wheel.close":
          toast("Preview closed the wheel.");
          return true;
        case "wheel.choose":
          toast(
            `Preview only — ${String(a.petalId || "that petal")} was not applied.`,
          );
          return { accepted: false, preview: true, petalId: a.petalId };
        case "wheel.fail":
          toast(String(a.message || "Preview wheel error"));
          return true;
        case "wheel.sendTo":
          toast("Preview only — the Windows Send to menu was not changed.");
          return false;
        case "wheel.shelf":
        case "wheel.shelf.drop":
          toast("Preview only — the drop shelf does not receive real files.");
          return false;
        case "wheel.configure":
          return true;
        case "wheel.tool.get":
          return {
            tool: previewTool,
            files: previewNames(previewTool).map((name) => ({
              path: `preview://${encodeURIComponent(name)}`,
              name,
              size: 2306867,
              ext: name.split(".").pop(),
            })),
          };
        case "wheel.tool.sample":
          previewTool = String(a.tool || previewTool);
          return true;
        case "wheel.tool.apply":
          toast(`Preview only — ${String(a.tool || "the tool")} was not saved.`);
          return { preview: true, outputs: ["grove Background.png"] };
        case "wheel.preview":
          return "";
        case "wheel.metadata":
          return [
            { tag: "EXIF:Artist", value: "Preview" },
            { tag: "EXIF:Copyright", value: "Example only" },
          ];
        case "wheel.backgrounds":
          return [1, 2, 3].map((n) => ({
            id: `starter-${n}`,
            url: `/wallpapers/starter-0${n}.jpg`,
          }));
        case "wheel.engines":
          return [
            ["ffmpeg", "9.0.2"],
            ["magick", "7.1.2-34"],
            ["sevenZip", "26.04"],
            ["sevenExtra", "26.04"],
            ["exiftool", "13.59"],
          ].map(([id, version]) => ({
            id,
            version,
            license: "See the file wheel notes",
            installed: false,
          }));
        case "wheel.engines.install":
          toast("Preview only — engines are not downloaded.");
          return false;
        case "wheel.pdf.info":
          return { pages: 3 };
        case "wheel.copyText":
          toast("Preview only — text was not copied to the desktop clipboard.");
          return false;
        default:
          if (/^(stray|caption)\./.test(method))
            return previewOverlay(method, a, emit);
          throw new Error(`Desktop-only action: ${method}`);
      }
    },
  };
}
