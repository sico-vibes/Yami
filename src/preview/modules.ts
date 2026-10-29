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
import { previewShield } from "./shield";
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
// One caught message for the Dev mail catcher.
const previewMail = {
  id: "00000000-0000-4000-8000-000000000001",
  from: "app@demo.test",
  to: "ana@demo.test",
  subject: "Reset your password",
  at: Date.now() - 4 * 60_000,
  size: 1840,
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
  if (method.startsWith("tune.shield")) return previewShield(method, a);
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
    case "feeds.mail":
    case "feeds.mail.refresh":
      return [
        {
          id: "demo-mail",
          provider: "gmail",
          host: "imap.gmail.com",
          user: "demo@example.com",
          added: 0,
          checkedAt: Date.now(),
          glance: {
            unread: 3,
            total: 128,
            latest: [
              {
                from: "Demo Shop",
                subject: "Your order shipped (demo)",
                at: Date.now() - 900_000,
              },
              {
                from: "Ada",
                subject: "Notes from today (demo)",
                at: Date.now() - 7_200_000,
              },
            ],
          },
        },
      ];
    case "feeds.podcasts":
      return [
        {
          name: "Demo Show",
          author: "Sample Studio",
          feed: "https://example.com/demo.xml",
        },
        {
          name: "Another Demo",
          author: "Example Radio",
          feed: "https://example.com/another.xml",
        },
      ];
    case "feeds.bluesky":
    case "feeds.bluesky.refresh":
      return {
        handle: "demo.bsky.social",
        fetchedAt: Date.now() - 60_000,
        posts: [
          {
            id: "demo-1",
            author: "Demo Writer",
            handle: "writer.example.com",
            text: "Shipped a small tool today. Local first, no account needed.",
            link: "https://bsky.app/",
            at: Date.now() - 20 * 60_000,
          },
          {
            id: "demo-2",
            author: "Sample Studio",
            handle: "studio.example.com",
            text: "New wallpaper pack is out.",
            link: "https://bsky.app/",
            at: Date.now() - 2 * 3600_000,
            note: "Reposted by Demo Writer",
          },
        ],
      };
    case "feeds.bluesky.signIn":
    case "feeds.bluesky.signOut":
    case "feeds.mail.outlook.start":
    case "feeds.mail.outlook.finish":
      throw new Error("Preview only — no account was contacted.");
    case "feeds.mail.outlook.clientId":
      return "";
    case "feeds.mail.outlook.cancel":
      return [];
    case "feeds.mail.add":
    case "feeds.mail.remove":
      throw new Error("Preview only — no mail account was touched.");
    case "feeds.brief":
      return [
        "- Demo brief: a tiny offline speech model is trending on Hacker News.",
        "- r/rust asks what people are building this week.",
        "- Electron shipped a new release.",
        "(Preview text; Gemini was not called.)",
      ].join("\n");
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
    // A demo pairing; nothing listens in preview.
    case "remote.info":
    case "remote.allow":
    case "remote.rotate":
      if (method === "remote.allow")
        state.settings.remoteAllow = [
          ...state.settings.remoteAllow.filter((n) => n !== a.name),
          ...(a.allowed ? [a.name] : []),
        ];
      return {
        enabled: state.settings.remoteEnabled,
        url: "http://192.168.1.20:47822/",
        pairing: state.settings.remoteEnabled
          ? "http://192.168.1.20:47822/#k=preview-not-a-real-pairing"
          : "",
        error: "",
        abilities: ["approvals", "media", "clipboard"].map((name) => ({
          name,
          allowed: state.settings.remoteAllow.includes(name),
        })),
      };
    case "mailcatcher.status":
    case "mailcatcher.stop":
      return { running: false, smtp: "127.0.0.1:1025", count: 1 };
    case "mailcatcher.start":
      throw new Error("Preview only — the mail catcher was not started.");
    case "mailcatcher.list":
      return [previewMail];
    case "mailcatcher.remove":
    case "mailcatcher.clear":
      return [];
    case "mailcatcher.read":
      return {
        ...previewMail,
        date: "Wed, 28 Oct 2026 19:30:00 +0200",
        text: "Hi Ana,\n\nClick the link below to reset your password.\n\nThe demo app",
        attachments: [],
      };
    case "mailcatcher.open":
      throw new Error("Preview only — no mail app was opened.");
    case "tune.admin":
      return [
        {
          name: "DiagTrack",
          label: "Connected User Experiences and Telemetry",
          start: "Automatic",
          running: true,
        },
        {
          name: "MapsBroker",
          label: "Downloaded Maps Manager",
          start: "Disabled",
          running: false,
          savedStart: "Automatic",
        },
      ];
    case "tune.apps":
      return [
        {
          id: "a1",
          name: "Demo Editor",
          publisher: "Demo Co",
          version: "2.4.1",
          sizeKb: 412000,
          user: true,
        },
        {
          id: "a2",
          name: "Sample Game",
          publisher: "Example Studio",
          version: "1.0",
          sizeKb: 3800000,
          user: false,
        },
        {
          id: "a3",
          name: "Tiny Tool",
          publisher: "",
          version: "0.3",
          sizeKb: 900,
          user: true,
        },
      ];
    case "tune.cursors":
    case "tune.cursors.set":
    case "tune.cursors.restore":
      return {
        schemes: [
          { id: "system:Windows Aero", name: "Windows Default" },
          { id: "system:Windows Black", name: "Windows Black" },
          { id: "system:Windows Inverted", name: "Windows Inverted" },
        ],
        current:
          a.scheme === "system:Windows Black"
            ? "Windows Black"
            : "Windows Default",
        size: Number(a.size) || 1,
        saved: method === "tune.cursors.set",
      };
    case "tune.space.drives":
      return [
        { path: "C:\\", total: 1_000_000_000_000, free: 212_000_000_000 },
        { path: "D:\\", total: 2_000_000_000_000, free: 1_400_000_000_000 },
      ];
    case "tune.space":
      return {
        folder: String(a.folder || "C:\\"),
        parent: /^[A-Z]:[\\/]?$/i.test(String(a.folder || ""))
          ? undefined
          : "C:\\",
        total: 640_000_000_000,
        items: [
          {
            name: "Users",
            dir: true,
            bytes: 410_000_000_000,
            files: 820_114,
            capped: false,
          },
          {
            name: "Program Files",
            dir: true,
            bytes: 120_000_000_000,
            files: 301_552,
            capped: false,
          },
          {
            name: "Windows",
            dir: true,
            bytes: 98_000_000_000,
            files: 290_008,
            capped: false,
          },
          {
            name: "pagefile.sys",
            dir: false,
            bytes: 12_000_000_000,
            files: 1,
            capped: false,
          },
        ],
        rest: { count: 0, bytes: 0 },
      };
    case "tune.space.reveal":
      throw new Error("Preview only — Explorer was not opened.");
    case "tune.cleanup":
      return [
        {
          id: "temp",
          name: "Temporary files",
          detail: "Files apps left in your temp folder, untouched for a day",
          bytes: 1_840_000_000,
          files: 12840,
        },
        {
          id: "shaders",
          name: "Graphics shader caches",
          detail:
            "DirectX, NVIDIA and AMD build these again the next time a game or app needs them",
          bytes: 412_000_000,
          files: 903,
        },
        {
          id: "reports",
          name: "Error reports",
          detail: "Problem reports Windows saved after apps crashed or hung",
          bytes: 0,
          files: 0,
        },
        {
          id: "dumps",
          name: "Crash dumps",
          detail: "Memory snapshots apps saved when they crashed",
          bytes: 96_000_000,
          files: 3,
        },
        {
          id: "recycle",
          name: "Recycle Bin",
          detail:
            "Files you deleted, on every drive. They cannot be restored after this",
          bytes: 2_300_000_000,
          files: 41,
        },
      ];
    case "tune.cleanup.run":
    case "tune.apps.uninstall":
    case "tune.admin.service":
    case "tune.admin.restorePoint":
      throw new Error("Preview only — nothing was changed.");
    case "tune.dns":
      return [
        {
          index: 7,
          name: "Ethernet",
          description: "Demo adapter",
          servers: ["192.168.1.1"],
          profile: "custom",
          encrypted: false,
        },
        {
          index: 12,
          name: "Wi-Fi",
          description: "Demo adapter",
          servers: ["9.9.9.9", "149.112.112.112"],
          profile: "quad9",
          encrypted: true,
        },
      ];
    case "tune.dns.set":
      throw new Error("Preview only — DNS was not changed.");
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
