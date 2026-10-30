import type { AgentTool } from "./protocol.ts";

// Tools for coding agents to look into Yami itself: to reproduce a bug a user
// reported, read the logs, see a window, or change a setting (always with the
// user's yes in Yami). Each is switched on separately, like the other tools.

export const yamiToolNames = [
  "yami_status",
  "yami_logs",
  "yami_report",
  "yami_open",
  "yami_screenshot",
  "yami_settings",
  "yami_set_setting",
];

const pages = [
  "home",
  "bond",
  "soul",
  "desk",
  "ai",
  "tune",
  "settings",
  "setup",
];
const drawer = [
  "Controls",
  "Today",
  "Stats",
  "Clipboard",
  "Apps",
  "Wallpaper",
  "Power",
  "Radio",
  "AI",
];
const windows = [
  "main",
  "island",
  "dock",
  "widget",
  "stray",
  "browser",
  "terminal",
];

export function yamiTools(deps: {
  status: () => Record<string, unknown>;
  logs: (channel: string, limit: number, since?: string) => Promise<unknown[]>;
  report: (note?: string) => Promise<{ file: string; text: string }>;
  open: (page: string) => void;
  drawer: (tab: string | null) => void;
  screenshot: (window: string) => Promise<string>;
  settings: () => Record<string, unknown>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  ask: (title: string, detail: string) => Promise<boolean>;
}): AgentTool[] {
  const json = (v: unknown) => JSON.stringify(v, null, 1);
  return [
    {
      name: "yami_status",
      description:
        "Yami's version, the modules that are on, the windows open, and the problems (grouped errors) seen since it started. Start here when looking into a Yami bug.",
      inputSchema: { type: "object", properties: {} },
      run: async () => json(deps.status()),
    },
    {
      name: "yami_logs",
      description:
        "Read Yami's logs, newest last, one JSON object per entry. Channels: ERR (errors with stacks), TRG (one triage entry per distinct problem, with the entries that led up to it), LOG (what Yami did), DEG (debug detail, only while debug logging is on).",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["ERR", "TRG", "LOG", "DEG"] },
          limit: { type: "number", description: "1–300, default 50." },
          since: {
            type: "string",
            description: "Optional ISO time; only newer entries.",
          },
        },
        required: ["channel"],
      },
      run: async (a) =>
        json(
          await deps.logs(
            String(a.channel),
            Math.min(300, Math.max(1, Number(a.limit) || 50)),
            typeof a.since === "string" ? a.since : undefined,
          ),
        ),
    },
    {
      name: "yami_report",
      description:
        "Make the same report as Settings › Your data › Collect logs (system, problems, triage, errors, log, settings; secrets masked) and return its path and text.",
      inputSchema: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "Optional: what you are investigating.",
          },
        },
      },
      run: async (a) => {
        const r = await deps.report(
          typeof a.note === "string" ? a.note.slice(0, 1000) : undefined,
        );
        return `Saved to ${r.file}\n\n${r.text.slice(0, 60_000)}`;
      },
    },
    {
      name: "yami_open",
      description: `Show a page of Yami's main window (${pages.join(", ")}), or open the island drawer on a tab (${drawer.join(", ")}), or close the drawer with "close-drawer". Use it to reproduce what the user did.`,
      inputSchema: {
        type: "object",
        properties: { target: { type: "string" } },
        required: ["target"],
      },
      run: async (a) => {
        const t = String(a.target || "");
        if (t === "close-drawer") deps.drawer(null);
        else if (pages.includes(t.toLowerCase())) deps.open(t.toLowerCase());
        else if (drawer.includes(t)) deps.drawer(t);
        else
          throw new Error(
            `Choose one of: ${[...pages, ...drawer, "close-drawer"].join(", ")}.`,
          );
        return "Opened.";
      },
    },
    {
      name: "yami_screenshot",
      description: `Save a picture of one of Yami's own windows (${windows.join(", ")}), never the rest of the screen, and return the PNG's path.`,
      inputSchema: {
        type: "object",
        properties: { window: { type: "string", enum: windows } },
        required: ["window"],
      },
      run: async (a) => {
        const w = String(a.window || "");
        if (!windows.includes(w))
          throw new Error(`Choose one of: ${windows.join(", ")}.`);
        return await deps.screenshot(w);
      },
    },
    {
      name: "yami_settings",
      description:
        "Read Yami's settings (values that look like secrets are hidden). Keys and types are what yami_set_setting accepts.",
      inputSchema: { type: "object", properties: {} },
      run: async () => json(deps.settings()),
    },
    {
      name: "yami_set_setting",
      description:
        "Change one Yami setting to reproduce or fix a problem. The user is asked in Yami first; no answer counts as no. Only existing keys with a value of the same type are accepted.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: {
            description: "The new value, of the setting's current type.",
          },
        },
        required: ["key", "value"],
      },
      run: async (a) => {
        const key = String(a.key || "");
        const current = deps.settings();
        if (!(key in current))
          throw new Error("There is no setting called " + key + ".");
        if (typeof current[key] !== typeof a.value)
          throw new Error(`${key} takes a ${typeof current[key]}.`);
        const shown = JSON.stringify(a.value).slice(0, 200);
        if (
          !(await deps.ask(
            `Change the setting ${key}?`,
            `A coding agent wants to set ${key} to ${shown}.`,
          ))
        )
          return "The user said no.";
        await deps.setSetting(key, a.value);
        return `Set ${key} to ${shown}.`;
      },
    },
  ];
}
