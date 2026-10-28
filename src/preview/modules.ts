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
import type { FeedItem, FeedSource, FeedsView } from "../feeds-types";

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
const previewStartup = [
  {
    id: "user:Demo Chat",
    name: "Demo Chat",
    command: '"C:\\Demo\\chat.exe" --minimized',
    source: "user" as const,
    enabled: true,
    editable: true,
  },
  {
    id: "folder:Demo Notes.lnk",
    name: "Demo Notes",
    command: "Demo Notes.lnk",
    source: "folder" as const,
    enabled: false,
    editable: true,
  },
  {
    id: "machine:Demo Driver",
    name: "Demo Driver Helper",
    command: "C:\\Demo\\driver.exe",
    source: "machine" as const,
    enabled: true,
    editable: false,
  },
];
const feedSources: FeedSource[] = [
  {
    id: "demo-rust",
    kind: "reddit",
    name: "r/rust",
    url: "https://www.reddit.com/r/rust/.rss",
    added: 0,
  },
  {
    id: "demo-hn",
    kind: "hackernews",
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    added: 0,
  },
  {
    id: "demo-gh",
    kind: "github",
    name: "electron/electron",
    url: "https://github.com/electron/electron/releases.atom",
    added: 0,
  },
];
const feedItems: FeedItem[] = [
  {
    id: "1",
    source: "demo-hn",
    title: "Show HN: A tiny offline speech model (demo item)",
    link: "https://example.com/1",
    at: Date.now() - 20 * 60_000,
    author: "demo",
  },
  {
    id: "2",
    source: "demo-rust",
    title: "What are you building this week? (demo item)",
    link: "https://example.com/2",
    at: Date.now() - 55 * 60_000,
    summary:
      "Synthetic preview text. No feed was read; this stands in for a post's first lines.",
    author: "u/demo",
  },
  {
    id: "3",
    source: "demo-gh",
    title: "v44.1.0 (demo item)",
    link: "https://example.com/3",
    at: Date.now() - 5 * 3600_000,
    summary: "Release notes would appear here.",
  },
  {
    id: "4",
    source: "demo-hn",
    title: "Designing quiet desktop software (demo item)",
    link: "https://example.com/4",
    at: Date.now() - 26 * 3600_000,
  },
];
const feedView = (): FeedsView => ({
  sources: [...feedSources],
  items: feedItems.filter((i) => feedSources.some((s) => s.id === i.source)),
  status: feedSources.map((s) => ({
    id: s.id,
    state: "fresh",
    fetchedAt: Date.now(),
  })),
});

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
    // Feeds read nothing in preview; items are synthetic.
    case "feeds.list":
    case "feeds.refresh":
      return feedView();
    case "feeds.add":
      throw new Error("Preview only — no feed was added or read.");
    case "feeds.remove":
      feedSources.splice(feedSources.findIndex((s) => s.id === a.id) >>> 0, 1);
      return feedView();
    // Tune changes nothing in preview; it only flips demo states.
    case "tune.list":
      return tuneStates();
    case "tune.apply":
      for (const id of a.ids || []) applied.add(id);
      return tuneStates();
    case "tune.undo":
      for (const id of a.ids || []) applied.delete(id);
      return tuneStates();
    // A demo token; no server listens in preview.
    case "agentlink.info":
    case "agentlink.tools":
    case "agentlink.rotate":
      if (method === "agentlink.tools")
        state.settings.agentLinkTools = [
          ...state.settings.agentLinkTools.filter((t) => t !== a.name),
          ...(a.allowed ? [a.name] : []),
        ];
      return {
        enabled: state.settings.agentLinkEnabled,
        url: "http://127.0.0.1:47821/mcp",
        token: state.settings.agentLinkEnabled ? "preview-token-not-real" : "",
        error: "",
        tools: ["notify", "ask_user", "list_projects", "open_terminal"].map(
          (name) => ({
            name,
            allowed: state.settings.agentLinkTools.includes(name),
          }),
        ),
      };
    case "tune.startup":
      return [...previewStartup];
    case "tune.startup.set": {
      const app = previewStartup.find((s) => s.id === a.id);
      if (app?.editable) app.enabled = !!a.enabled;
      return [...previewStartup];
    }
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
