import { calculate, formatResult } from "./calc.ts";
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
  }
  return out.slice(0, 8);
}
