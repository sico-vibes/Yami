// Windows tune-up tweaks. Each one writes per-user registry values only
// (HKCU, no administrator), and Yami saves the exact earlier values before it
// applies, so Undo puts back what was there, including "not set".

export type TuneCategory =
  | "Look and feel"
  | "Explorer"
  | "Taskbar and Start"
  | "Privacy"
  | "Gaming"
  | "Comfort";

export type RegValue = {
  /** Under HKEY_CURRENT_USER, e.g. `Software\Microsoft\…\Advanced`. */
  key: string;
  /** Empty for the key's default value. */
  name: string;
  type: "REG_DWORD" | "REG_SZ" | "REG_BINARY";
  data: string;
};

export type Tweak = {
  id: string;
  name: string;
  detail: string;
  category: TuneCategory;
  values: RegValue[];
  /** A key Yami may remove on Undo when it did not exist before. */
  ownsKey?: string;
  /** Explorer reads it at start, so it shows after Explorer restarts. */
  restartExplorer?: boolean;
};

/** DNS choices; "automatic" means the router's DNS (DHCP). */
export const dnsProfiles: {
  id: string;
  name: string;
  detail: string;
  servers: string[];
}[] = [
  {
    id: "automatic",
    name: "Automatic",
    detail: "Your router or provider's DNS",
    servers: [],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    detail: "Fast, no filtering",
    servers: ["1.1.1.1", "1.0.0.1"],
  },
  {
    id: "cloudflareFamily",
    name: "Cloudflare for Families",
    detail: "Blocks malware and adult sites",
    servers: ["1.1.1.3", "1.0.0.3"],
  },
  {
    id: "quad9",
    name: "Quad9",
    detail: "Blocks known malicious domains",
    servers: ["9.9.9.9", "149.112.112.112"],
  },
  {
    id: "adguard",
    name: "AdGuard DNS",
    detail: "Blocks ads and trackers",
    servers: ["94.140.14.14", "94.140.15.15"],
  },
  {
    id: "google",
    name: "Google Public DNS",
    detail: "No filtering",
    servers: ["8.8.8.8", "8.8.4.4"],
  },
];

export type DnsAdapter = {
  index: number;
  name: string;
  description: string;
  servers: string[];
  /** A profile id, or "custom" for servers Yami does not know. */
  profile: string;
  /** Every server is looked up over DNS over HTTPS only. */
  encrypted: boolean;
};

/** An app that starts with Windows. Only your own entries can be switched. */
export type StartupApp = {
  id: string;
  name: string;
  /** The command line, or the shortcut's file name for the Startup folder. */
  command: string;
  source: "user" | "folder" | "machine";
  enabled: boolean;
  editable: boolean;
};

export type TweakState = {
  id: string;
  applied: boolean;
  /** True when Yami holds the earlier values, so Undo is possible. */
  undoable: boolean;
};

const advanced =
  "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
const content =
  "Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager";
const explorer = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer";

export const tweaks: Tweak[] = [
  {
    // The values Settings › Personalization › Colours writes. The accent is a
    // deeper violet from Yami's glow (#bcaaff), so white text stays readable.
    id: "yamiAccent",
    name: "Yami's violet as the Windows accent",
    detail:
      "Start, the taskbar's highlights, selections and buttons take Yami's violet. Undo puts your own colour back.",
    category: "Look and feel",
    values: [
      {
        key: explorer + "\\Accent",
        name: "AccentPalette",
        type: "REG_BINARY",
        data: "D9CFFF00BCAAFF00A48CFA008B6FF0006F53D6005539B3003B238A00F1A7D600",
      },
      {
        key: explorer + "\\Accent",
        name: "AccentColorMenu",
        type: "REG_DWORD",
        data: "4293947275",
      },
      {
        key: explorer + "\\Accent",
        name: "StartColorMenu",
        type: "REG_DWORD",
        data: "4292236143",
      },
      {
        key: "Software\\Microsoft\\Windows\\DWM",
        name: "AccentColor",
        type: "REG_DWORD",
        data: "4293947275",
      },
      {
        key: "Software\\Microsoft\\Windows\\DWM",
        name: "ColorizationColor",
        type: "REG_DWORD",
        data: "3297472496",
      },
    ],
    restartExplorer: true,
  },
  // Yami's own versions of popular Explorer and taskbar mods: settings
  // Windows already reads, so nothing is injected into Explorer.
  {
    id: "hideSearchBox",
    name: "Hide the taskbar search box",
    detail: "Start search still works when you press the Windows key and type.",
    category: "Look and feel",
    values: [
      {
        key: "Software\\Microsoft\\Windows\\CurrentVersion\\Search",
        name: "SearchboxTaskbarMode",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "hideTaskView",
    name: "Hide the Task View button",
    detail: "Win+Tab still opens Task View.",
    category: "Look and feel",
    values: [
      {
        key: advanced,
        name: "ShowTaskViewButton",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "neverCombine",
    name: "Never combine taskbar buttons",
    detail: "Each window gets its own labelled button.",
    category: "Look and feel",
    values: [
      {
        key: advanced,
        name: "TaskbarGlomLevel",
        type: "REG_DWORD",
        data: "2",
      },
    ],
  },
  {
    id: "compactExplorer",
    name: "Compact File Explorer",
    detail: "Tighter rows and less padding, like Windows 10.",
    category: "Look and feel",
    values: [
      {
        key: advanced,
        name: "UseCompactMode",
        type: "REG_DWORD",
        data: "1",
      },
    ],
  },
  {
    id: "fullPathTitle",
    name: "Full path in the title bar",
    detail: "File Explorer's title shows the whole folder path.",
    category: "Look and feel",
    values: [
      {
        key: explorer + "\\CabinetState",
        name: "FullPath",
        type: "REG_DWORD",
        data: "1",
      },
    ],
  },
  {
    id: "checkboxes",
    name: "Selection checkboxes",
    detail: "Tick files in File Explorer to select several without Ctrl.",
    category: "Look and feel",
    values: [
      {
        key: advanced,
        name: "AutoCheckSelect",
        type: "REG_DWORD",
        data: "1",
      },
    ],
  },
  {
    id: "noRecentFiles",
    name: "No recent files in Home",
    detail:
      "File Explorer's Home and Quick access stop listing recently opened files.",
    category: "Look and feel",
    values: [
      {
        key: explorer,
        name: "ShowRecent",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "noSnapFlyout",
    name: "No snap layouts on the maximize button",
    detail:
      "Hovering the maximize button no longer opens the layout picker; Win+Z still does.",
    category: "Look and feel",
    values: [
      {
        key: advanced,
        name: "EnableSnapAssistFlyout",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "fileExtensions",
    name: "Show file extensions",
    detail: "See .exe, .pdf and the rest in File Explorer.",
    category: "Explorer",
    values: [
      { key: advanced, name: "HideFileExt", type: "REG_DWORD", data: "0" },
    ],
  },
  {
    id: "hiddenFiles",
    name: "Show hidden files",
    detail: "Hidden files and folders appear dimmed in File Explorer.",
    category: "Explorer",
    values: [{ key: advanced, name: "Hidden", type: "REG_DWORD", data: "1" }],
  },
  {
    id: "openThisPc",
    name: "Open File Explorer to This PC",
    detail: "Start on your drives instead of Home.",
    category: "Explorer",
    values: [{ key: advanced, name: "LaunchTo", type: "REG_DWORD", data: "1" }],
  },
  {
    id: "classicMenu",
    name: "Classic right-click menu",
    detail: "Show the full Windows 10 style menu without “Show more options”.",
    category: "Explorer",
    values: [
      {
        key: "Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32",
        name: "",
        type: "REG_SZ",
        data: "",
      },
    ],
    ownsKey: "Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}",
    restartExplorer: true,
  },
  {
    id: "taskbarLeft",
    name: "Taskbar icons on the left",
    detail: "Align the Start button and apps to the left edge.",
    category: "Taskbar and Start",
    values: [
      { key: advanced, name: "TaskbarAl", type: "REG_DWORD", data: "0" },
    ],
  },
  {
    id: "endTask",
    name: "End task in the taskbar menu",
    detail: "Right-click an app on the taskbar to close it when it hangs.",
    category: "Taskbar and Start",
    values: [
      {
        key: advanced + "\\TaskbarDeveloperSettings",
        name: "TaskbarEndTask",
        type: "REG_DWORD",
        data: "1",
      },
    ],
  },
  {
    id: "clockSeconds",
    name: "Seconds on the taskbar clock",
    detail: "Uses a little more power, as Windows notes.",
    category: "Taskbar and Start",
    values: [
      {
        key: advanced,
        name: "ShowSecondsInSystemClock",
        type: "REG_DWORD",
        data: "1",
      },
    ],
  },
  {
    id: "webSearch",
    name: "No web results in Start search",
    detail: "Search your PC only; Bing suggestions stay out of Start.",
    category: "Taskbar and Start",
    values: [
      {
        key: "Software\\Policies\\Microsoft\\Windows\\Explorer",
        name: "DisableSearchBoxSuggestions",
        type: "REG_DWORD",
        data: "1",
      },
    ],
    restartExplorer: true,
  },
  {
    id: "startSuggestions",
    name: "No suggested apps in Start",
    detail: "Turns off promoted apps and tips Windows places in Start.",
    category: "Taskbar and Start",
    values: [
      {
        key: content,
        name: "SystemPaneSuggestionsEnabled",
        type: "REG_DWORD",
        data: "0",
      },
      {
        key: content,
        name: "SubscribedContent-338388Enabled",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "advertisingId",
    name: "No advertising ID",
    detail: "Apps cannot use your advertising ID for personalised ads.",
    category: "Privacy",
    values: [
      {
        key: "Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo",
        name: "Enabled",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "tailored",
    name: "No tailored experiences",
    detail: "Microsoft does not use your diagnostic data for tips and offers.",
    category: "Privacy",
    values: [
      {
        key: "Software\\Microsoft\\Windows\\CurrentVersion\\Privacy",
        name: "TailoredExperiencesWithDiagnosticDataEnabled",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "tips",
    name: "No tips and suggestions",
    detail: "Turns off “Get tips and suggestions when using Windows”.",
    category: "Privacy",
    values: [
      {
        key: content,
        name: "SubscribedContent-338389Enabled",
        type: "REG_DWORD",
        data: "0",
      },
      {
        key: content,
        name: "SoftLandingEnabled",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "gameDvr",
    name: "No background game recording",
    detail:
      "Stops Game Bar recording in the background, which can cost frames.",
    category: "Gaming",
    values: [
      {
        key: "System\\GameConfigStore",
        name: "GameDVR_Enabled",
        type: "REG_DWORD",
        data: "0",
      },
      {
        key: "Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR",
        name: "AppCaptureEnabled",
        type: "REG_DWORD",
        data: "0",
      },
    ],
  },
  {
    id: "stickyKeys",
    name: "No Sticky Keys prompt",
    detail: "Pressing Shift five times no longer asks to turn on Sticky Keys.",
    category: "Comfort",
    values: [
      {
        key: "Control Panel\\Accessibility\\StickyKeys",
        name: "Flags",
        type: "REG_SZ",
        data: "506",
      },
    ],
  },
];

/**
 * Requests: `tune.list` → TweakState[]; `tune.apply` { ids } and `tune.undo`
 * { ids } → TweakState[]; `tune.restartExplorer` restarts Explorer after the
 * page asked you.
 */
export const tuneCategories: TuneCategory[] = [
  "Look and feel",
  "Explorer",
  "Taskbar and Start",
  "Privacy",
  "Gaming",
  "Comfort",
];
