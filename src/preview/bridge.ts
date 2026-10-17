import type { YamiEvent, State } from "../shared";
import { createFixture, demoApps, demoMetrics } from "./fixtures";
let state = createFixture();
const listeners = new Set<(event: YamiEvent) => void>();
export function emit(event: YamiEvent) {
  for (const fn of listeners) fn(event);
}
function changed() {
  emit({ type: "state", state: structuredClone(state) });
}
function toast(message: string) {
  emit({ type: "toast", message });
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
    async invoke(method, args = {}) {
      const a = args;
      switch (method) {
        case "state":
          return structuredClone(state);
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
          return { active: false };
        case "control":
          toast("Preview only — Windows controls are unchanged.");
          return true;
        case "weather":
          return null;
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
                    "hitodama",
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
        case "island.mouse":
        case "selection.clear":
          return true;
        default:
          throw new Error(`Desktop-only action: ${method}`);
      }
    },
  };
}
