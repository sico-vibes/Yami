// Coding-agent CLIs Yami can find and start, and the project folders it
// remembers. Commands come only from this list; the page never sends one.

export type AgentCliId =
  | "claude"
  | "codex"
  | "opencode"
  | "cursor"
  | "gemini"
  | "copilot"
  | "pi"
  | "qwen"
  | "amp"
  | "aider"
  | "crush"
  | "goose";

export type AgentCli = {
  id: AgentCliId;
  name: string;
  /** What Yami types into the terminal; also the executable it looks for. */
  command: string;
  /** Two letters for the tile; brand marks are not bundled. */
  mark: string;
  site: string;
  /**
   * How an interactive session takes a first prompt, checked against each
   * CLI's own --help. Without it the agent cannot join a fan-out.
   */
  prompt?: "argument" | "--prompt";
};

export const agentClis: AgentCli[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    mark: "Cl",
    site: "https://www.anthropic.com/claude-code",
    prompt: "argument",
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    mark: "Cx",
    site: "https://github.com/openai/codex",
    prompt: "argument",
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    mark: "Oc",
    site: "https://opencode.ai",
    prompt: "--prompt",
  },
  {
    id: "cursor",
    name: "Cursor CLI",
    command: "cursor-agent",
    mark: "Cu",
    site: "https://cursor.com/cli",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    mark: "Ge",
    site: "https://github.com/google-gemini/gemini-cli",
    prompt: "argument",
  },
  {
    id: "copilot",
    name: "Copilot CLI",
    command: "copilot",
    mark: "Co",
    site: "https://github.com/github/copilot-cli",
  },
  {
    id: "pi",
    name: "Pi",
    command: "pi",
    mark: "Pi",
    site: "https://github.com/badlogic/pi-mono",
  },
  {
    id: "qwen",
    name: "Qwen Code",
    command: "qwen",
    mark: "Qw",
    site: "https://github.com/QwenLM/qwen-code",
  },
  {
    id: "amp",
    name: "Amp",
    command: "amp",
    mark: "Am",
    site: "https://ampcode.com",
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider",
    mark: "Ai",
    site: "https://aider.chat",
  },
  {
    id: "crush",
    name: "Crush",
    command: "crush",
    mark: "Cr",
    site: "https://github.com/charmbracelet/crush",
  },
  {
    id: "goose",
    name: "Goose",
    command: "goose",
    mark: "Go",
    site: "https://github.com/block/goose",
  },
];

/** An installed CLI: where it was found on this PC. */
export type DetectedAgent = { id: AgentCliId; path: string };

export type Project = {
  id: string;
  path: string;
  name: string;
  added: number;
  /** The agent the card launches first. */
  agent?: AgentCliId;
};

/** A project as shown: read from disk and git when the page opens. */
export type ProjectInfo = Project & {
  exists: boolean;
  git?: {
    branch: string;
    /** Changed, added, deleted or untracked paths. */
    changes: number;
    ahead: number;
    behind: number;
  };
  /** Latest agent session reported in this folder. */
  activity?: { agent: string; phase: string; at: number };
};

export type Editor = "vscode" | "cursor";

/**
 * Requests: `dev.agents` { rescan? } → DetectedAgent[]; `dev.projects` →
 * ProjectInfo[]; `dev.suggestions` → string[] (folders agents worked in);
 * `dev.projects.add` { path? } (no path opens a folder picker);
 * `dev.projects.update` { id, agent?, name? }; `dev.projects.remove` { id };
 * `dev.launch` { project?, cwd?, agent? } opens a Yami Terminal tab there and
 * starts the agent; `dev.open` { id, target: "explorer" | Editor };
 * `dev.editors` → Editor[] (editors registered for their link scheme);
 * `dev.worktrees` { id } → Worktree[]; `dev.task` { id, name, agent? } adds
 * a worktree on `yami/<name>` and opens it; `dev.task.remove` { id, path }.
 */

export type Worktree = {
  path: string;
  branch: string;
  head: string;
  /** The project's own checkout, which is never removed. */
  main: boolean;
};
