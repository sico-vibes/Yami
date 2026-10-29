import { calculate, formatResult } from "./calc.ts";
import { convertUnits } from "./units.ts";
import { windowLayouts } from "./window-layouts.ts";
import { resolveInput } from "./browser-rules.ts";
import { agentClis } from "./dev-types.ts";
import type { Settings, Tab } from "./shared";

export type PaletteItem = {
  id: string;
  title: string;
  hint: string;
  icon: string;
  /** A request to send; `copy` puts text on the clipboard instead. */
  run: { method: string; args?: object } | { copy: string };
};

type Page = {
  tab: Tab;
  title: string;
  icon: string;
  words: string;
  when?: keyof Settings;
};
const pages: Page[] = [
  { tab: "home", title: "Home", icon: "house", words: "chat talk" },
  { tab: "bond", title: "Bond", icon: "link", words: "memory memories" },
  {
    tab: "soul",
    title: "Soul",
    icon: "flame",
    words: "loadout skins abilities",
  },
  {
    tab: "desk",
    title: "Desk",
    icon: "armchair",
    words: "plans tasks todo reminders inbox feeds",
  },
  {
    tab: "ai",
    title: "AI workspace",
    icon: "robot",
    words: "agents projects terminal usage mcp",
    when: "workbenchEnabled",
  },
  {
    tab: "tune",
    title: "Tune",
    icon: "sliders-horizontal",
    words: "tweaks windows startup explorer",
    when: "tuneEnabled",
  },
  {
    tab: "settings",
    title: "Settings",
    icon: "gear",
    words: "preferences options modules",
  },
  {
    tab: "setup",
    title: "Choose features",
    icon: "puzzle-piece",
    words: "modules setup install downloads",
  },
];

const matches = (query: string, ...texts: string[]) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = texts.join(" ").toLowerCase();
  return words.length > 0 && words.every((w) => hay.includes(w));
};

/**
 * Launcher results beyond apps and files: a sum, Yami's pages, module
 * actions and projects. Only what the user's modules allow is offered.
 */
export function paletteItems(
  query: string,
  settings: Settings,
  projects: { id: string; name: string; path: string }[] = [],
  /** Installed agent CLIs, by id, for "claude myproject". */
  agents: string[] = [],
): PaletteItem[] {
  const q = query.trim();
  if (!q) return [];
  const out: PaletteItem[] = [];
  const sum = calculate(q);
  if (sum !== undefined) {
    const text = formatResult(sum);
    out.push({
      id: "calc",
      title: "= " + text,
      hint: "Enter copies the result",
      icon: "calculator",
      run: { copy: text },
    });
  }
  const unit = convertUnits(q);
  if (unit)
    out.push({
      id: "units",
      title: `${unit.from} = ${unit.text}`,
      hint: "Enter copies the result",
      icon: "ruler",
      run: { copy: unit.text },
    });
  // A typed address or a !bang opens straight away, in Yami Browser if on.
  const bang = /(?:^|\s)![a-z]+(?:\s|$)/i.test(q);
  const address = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(q);
  if (bang || address) {
    const url = resolveInput(q);
    out.push({
      id: "web",
      title: bang ? q : url.replace(/^https?:\/\//, ""),
      hint: settings.browserEnabled
        ? "Open in Yami Browser"
        : "Open in your browser",
      icon: bang ? "magnifying-glass" : "globe",
      run: settings.browserEnabled
        ? { method: "browser.show", args: { url } }
        : { method: "open.external", args: { url } },
    });
  }
  // "snap left", "snap top right", "arrange centre": the last window used.
  const snap = /^(snap|arrange|move window)\s+(.+)$/i.exec(q);
  if (snap) {
    const want = snap[2]
      .toLowerCase()
      .replace(/centre/g, "center")
      .replace(/\s+/g, " ");
    for (const l of windowLayouts)
      if (
        l.label.toLowerCase().includes(want) ||
        l.id.replace(/-/g, " ").includes(want)
      )
        out.push({
          id: "snap:" + l.id,
          title: `Snap window: ${l.label}`,
          hint: "Moves the last window you used",
          icon: l.icon,
          run: { method: "window.snap", args: { layout: l.id } },
        });
  }
  for (const p of pages)
    if ((!p.when || settings[p.when]) && matches(q, p.title, p.words))
      out.push({
        id: "page:" + p.tab,
        title: p.title,
        hint: "Open in Yami",
        icon: p.icon,
        run: { method: "show", args: { tab: p.tab } },
      });
  if (
    settings.browserEnabled &&
    matches(q, "browser web tabs bookmarks internet")
  )
    out.push({
      id: "browser",
      title: "Yami Browser",
      hint: "Open the browser",
      icon: "globe",
      run: { method: "browser.show" },
    });
  if (settings.fileWheelEnabled && matches(q, "drop shelf file wheel convert"))
    out.push({
      id: "shelf",
      title: "Drop shelf",
      hint: "Drop files to convert them",
      icon: "tray-arrow-down",
      run: { method: "wheel.shelf" },
    });
  if (settings.workbenchEnabled) {
    if (matches(q, "terminal shell console"))
      out.push({
        id: "terminal",
        title: "Yami Terminal",
        hint: "Open a terminal",
        icon: "terminal-window",
        run: { method: "terminal.open" },
      });
    for (const p of projects)
      if (matches(q, p.name, p.path, "project"))
        out.push({
          id: "project:" + p.id,
          title: p.name,
          hint: "Terminal in this project",
          icon: "folder-simple",
          run: { method: "dev.launch", args: { project: p.id } },
        });
    // "claude yami": the agent's command or name, then a project's name.
    const [first, ...rest] = q.toLowerCase().split(/\s+/);
    const cli = agentClis.find(
      (c) =>
        agents.includes(c.id) &&
        (c.id === first ||
          c.command === first ||
          c.name.toLowerCase().startsWith(first)),
    );
    if (cli && rest.length)
      for (const p of projects)
        if (matches(rest.join(" "), p.name))
          out.unshift({
            id: `agent:${cli.id}:${p.id}`,
            title: `${cli.name} in ${p.name}`,
            hint: "Start the agent in a Yami Terminal tab",
            icon: "robot",
            run: {
              method: "dev.launch",
              args: { project: p.id, agent: cli.id },
            },
          });
  }
  if (!out.length && !bang && !address && q.length > 1)
    out.push({
      id: "search",
      title: `Search the web for “${q}”`,
      hint: settings.browserEnabled
        ? "Open in Yami Browser"
        : "Open in your browser",
      icon: "magnifying-glass",
      run: settings.browserEnabled
        ? { method: "browser.show", args: { url: resolveInput(q) } }
        : { method: "open.external", args: { url: resolveInput(q) } },
    });
  return out.slice(0, 8);
}
