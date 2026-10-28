export type Tab =
  | "home"
  | "bond"
  | "soul"
  | "desk"
  | "ai"
  | "settings"
  | "setup"
  | "tune";
export type UtilityTab =
  | "Controls"
  | "Today"
  | "Stats"
  | "Clipboard"
  | "Apps"
  | "Wallpaper"
  | "Power"
  | "AI";
export type Settings = {
  name: string;
  location: string;
  launchAtLogin: boolean;
  startHidden: boolean;
  alwaysOnTop: boolean;
  reducedMotion: boolean;
  roam: boolean;
  livingFlame: boolean;
  hotkeys: boolean;
  microphone: string;
  noiseSuppression: boolean;
  voiceShortcut: string;
  dictationShortcut: string;
  circleShortcut: string;
  voiceModel: string;
  textModel: string;
  clipboardEnabled: boolean;
  clipboardDays: number;
  contextEnabled: boolean;
  memoryEnabled: boolean;
  weatherEnabled: boolean;
  terminalEnabled: boolean;
  desktopEnabled: boolean;
  voice: string;
  soul: string;
  personality: string;
  ability: string;
  abilityButton: string;
  customPersonality: string;
  dictationEngine: "gemini" | "windows" | "whistle";
  fileWheelEnabled: boolean;
  fileWheelConvert: string;
  fileWheelTools: string;
  fileWheelActions: string;
  fileWheelHotkey: string;
  fileWheelReveal: boolean;
  fileWheelSound: boolean;
  workbenchEnabled: boolean;
  whistleEnabled: boolean;
  tuneEnabled: boolean;
  feedsEnabled: boolean;
  lyricsEnabled: boolean;
  agentLinkEnabled: boolean;
  /** Yami tools coding agents may call through the agent link. */
  agentLinkTools: string[];
  remoteEnabled: boolean;
  browserEnabled: boolean;
  /** The user's own Spotify app (public client ID; PKCE, no secret). */
  spotifyClientId: string;
  /** What a paired phone may do: approvals, media, clipboard. */
  remoteAllow: string[];
  setupDone: boolean;
};
export type Task = {
  id: string;
  title: string;
  at: string;
  repeat: "none" | "daily" | "weekly";
  tool: string;
  args: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string;
  lastResult?: string;
  status?: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  sources?: Source[];
};
export type Source = { title: string; url: string; content?: string };
export type ClipboardItem = {
  id: string;
  text: string;
  at: string;
  pinned: boolean;
};
export type AppItem = {
  name: string;
  path: string;
  icon?: string;
  kind: string;
};
export type State = {
  news?: { day: string; text: string };
  settings: Settings;
  todos: { id: string; title: string; done: boolean; at?: string }[];
  tasks: Task[];
  memories: { id: string; text: string; at: string }[];
  messages: Message[];
  snippets: { id: string; name: string; text: string }[];
  favorites: string[];
  recentApps: string[];
  wallpapers: string[];
  wallpaperFolder: string;
  currentWallpaper: string;
  clipboard: ClipboardItem[];
  embers: number;
  owned: string[];
  usage: Record<
    string,
    {
      words: number;
      dictations: number;
      turns: number;
      searches: number;
      credits: number;
    }
  >;
  keys: { gemini: boolean; tavily: boolean; tavilyHint: string };
};
export type YamiEvent = { type: string; [key: string]: any };
declare global {
  interface Window {
    yami: {
      invoke: (method: string, args?: any) => Promise<any>;
      on: (callback: (event: YamiEvent) => void) => () => void;
      filePath?: (file: File) => string;
    };
  }
}
