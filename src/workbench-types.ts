import type { Project } from "./dev-types";
export type AgentPhase =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "finished"
  | "error"
  | "disconnected";
export type AgentSession = {
  id: string;
  agent: string;
  project: string;
  cwd: string;
  phase: AgentPhase;
  detail: string;
  at: number;
  terminalId?: string;
  window?: number;
  source: "hook" | "terminal" | "transcript";
  files: string[];
};
export type AgentRequest = {
  id: string;
  sessionId: string;
  agent: string;
  kind: "permission" | "question";
  title: string;
  detail: string;
  expiresAt: number;
  questions?: {
    question: string;
    header?: string;
    multiSelect?: boolean;
    options: { label: string; description?: string }[];
  }[];
};
export type UsageWindow = {
  id: string;
  label: string;
  used: number | null;
  resetsAt?: number;
  group?: string;
  count?: number;
};
export type UsageReading = {
  provider: string;
  account: string;
  status:
    "fresh" | "stale" | "unavailable" | "needs-auth" | "backoff" | "error";
  windows: UsageWindow[];
  fetchedAt: number;
  source: string;
  note: string;
  retryAt?: number;
};
export type ConnectionKind =
  "github" | "vercel" | "n8n" | "notion" | "calcom" | "resend" | "stripe";
export type ConnectionConfig = {
  id: string;
  kind: ConnectionKind;
  name: string;
  url: string;
  enabled: boolean;
  background: boolean;
  interval: number;
  hasKey?: boolean;
};
export type ConnectionItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  url?: string;
  at?: string;
};
export type ConnectionReading = {
  id: string;
  at: number;
  status: string;
  items: ConnectionItem[];
  error?: string;
};
export type DictationRule = {
  id: string;
  heard: string;
  replacement: string;
  kind: "word" | "snippet";
};
export type Note = {
  id: string;
  title: string;
  text: string;
  transcript?: string;
  summary?: string;
  at: string;
};
export type WorkbenchSettings = {
  monitor: boolean;
  terminalShortcut: string;
  terminalShell: string;
  terminalBackground: "yami" | "custom" | "none";
  terminalImage: string;
  terminalBlur: number;
  terminalOpacity: number;
  terminalScrollback: number;
  /** Prompt marks and folder reports from shells Yami opens. */
  terminalMarks: boolean;
  usageAlerts: boolean;
  usageBackground: boolean;
  recapRetention: number;
  dictationEngine: "gemini" | "windows" | "whistle";
  lastDictation: string;
  cleanup: Record<string, "verbatim" | "natural" | "polished">;
  localUrl: string;
  localModel: string;
  localHasKey?: boolean;
  mcpUrl: string;
  codexExecutable: string;
  transcriptFallback: boolean;
  customUsageUrl: string;
  mcpHasKey?: boolean;
};
export type WorkbenchState = {
  settings: WorkbenchSettings;
  projects: Project[];
  connections: ConnectionConfig[];
  readings: ConnectionReading[];
  sessions: AgentSession[];
  requests: AgentRequest[];
  usage: UsageReading[];
  rules: DictationRule[];
  notes: Note[];
  history: {
    session: string;
    agent: string;
    project: string;
    phase: string;
    at: number;
  }[];
};
export const workbenchDefaults: WorkbenchSettings = {
  monitor: false,
  terminalShortcut: "",
  terminalShell: "auto",
  terminalBackground: "yami",
  terminalImage: "",
  terminalBlur: 6,
  terminalOpacity: 0.22,
  terminalScrollback: 3000,
  terminalMarks: true,
  usageAlerts: false,
  usageBackground: false,
  recapRetention: 7,
  dictationEngine: "gemini",
  lastDictation: "",
  cleanup: {},
  localUrl: "http://127.0.0.1:11434/v1",
  localModel: "",
  mcpUrl: "",
  codexExecutable: "",
  transcriptFallback: false,
  customUsageUrl: "",
};
