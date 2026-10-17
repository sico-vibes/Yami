import type { State } from "../shared";
import { defaults } from "../default-settings";
export function createFixture(): State {
  return {
    settings: {
      ...defaults,
      name: "Yami",
      location: "Kyoto",
      clipboardEnabled: false,
      weatherEnabled: true,
    },
    todos: [
      { id: "todo-1", title: "Plan a quiet afternoon", done: false },
      { id: "todo-2", title: "Try the starter wallpapers", done: true },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Open my workspace",
        at: new Date(Date.now() + 86400000).toISOString(),
        repeat: "daily",
        tool: "open_app",
        args: { name: "Notepad" },
        enabled: true,
      },
    ],
    memories: [
      {
        id: "memory-1",
        text: "I prefer short answers and a calm workspace.",
        at: new Date().toISOString(),
      },
    ],
    messages: [],
    snippets: [
      {
        id: "snippet-1",
        name: "A quick hello",
        text: "Hope you have a good day.",
      },
    ],
    favorites: ["demo:notes"],
    recentApps: ["demo:browser"],
    wallpapers: Array.from(
      { length: 10 },
      (_, i) => `/wallpapers/starter-${String(i + 1).padStart(2, "0")}.jpg`,
    ),
    wallpaperFolder: "",
    currentWallpaper: "/wallpapers/starter-01.jpg",
    clipboard: [],
    embers: 67,
    owned: ["yami", "chad", "Charon"],
    usage: {},
    keys: { gemini: false, tavily: false, tavilyHint: "" },
  };
}
export const demoApps = [
  { name: "Notepad", path: "demo:notes", kind: "Application" },
  { name: "Browser", path: "demo:browser", kind: "Application" },
  { name: "File Explorer", path: "demo:files", kind: "Application" },
];
export const demoMetrics = {
  cpu: { name: "Preview processor", speed: 3.2, load: 7 },
  memory: {
    used: 4 * 1024 ** 3,
    total: 16 * 1024 ** 3,
    available: 12 * 1024 ** 3,
  },
  gpu: [{ name: "Preview graphics", load: 3, used: 128, total: 4096 }],
  disks: [{ name: "C:", used: 120 * 1024 ** 3, total: 512 * 1024 ** 3 }],
  network: { rx: 0, tx: 0 },
  uptime: 7200,
  processCount: 100,
  processes: [{ name: "Example app", memory: 40 * 1024 ** 2, cpu: 0.2 }],
};
