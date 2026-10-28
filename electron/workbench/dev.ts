import { app, dialog, shell } from "electron";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  agentClis,
  type AgentCliId,
  type DetectedAgent,
  type Editor,
  type ProjectInfo,
} from "../../src/dev-types.ts";
import type { WorkbenchStorage } from "./storage";
import type { TerminalController } from "./terminal";
import {
  agentFolders,
  editorLink,
  findCommand,
  parseGitStatus,
  parseWorktrees,
  projectName,
  sameFolder,
  worktreePlan,
  fanOutPlan,
  TASK_FILE,
} from "./dev-rules.ts";

const exec = promisify(execFile);
const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
const isFolder = (folder: string) => {
  try {
    return fs.statSync(folder).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Projects and agent launches. Everything here runs when the Dev pages ask:
 * no watcher, timer or background git call.
 */
export class DevController {
  private found?: DetectedAgent[];
  constructor(
    private data: WorkbenchStorage,
    private changed: () => void,
    private terminal: TerminalController,
  ) {}

  agents(rescan = false) {
    if (!this.found || rescan) {
      const folders = agentFolders(process.env, os.homedir());
      this.found = agentClis.flatMap((cli) => {
        const file = findCommand(cli.command, folders, isFile);
        return file ? [{ id: cli.id, path: file }] : [];
      });
    }
    return this.found;
  }

  async projects(): Promise<ProjectInfo[]> {
    const sessions = this.data.state.sessions;
    const list = this.data.state.projects;
    const out: ProjectInfo[] = [];
    // Four git calls at a time keeps a long list from spawning a crowd.
    for (let i = 0; i < list.length; i += 4)
      out.push(
        ...(await Promise.all(
          list.slice(i, i + 4).map(async (p) => {
            const exists = isFolder(p.path);
            const latest = sessions
              .filter((s) => s.cwd && sameFolder(s.cwd, p.path))
              .sort((a, b) => b.at - a.at)[0];
            return {
              ...p,
              exists,
              git: exists ? await this.git(p.path) : undefined,
              activity: latest && {
                agent: latest.agent,
                phase: latest.phase,
                at: latest.at,
              },
            };
          }),
        )),
      );
    return out;
  }

  /** Folders agents reported working in that are not projects yet. */
  suggestions() {
    const known = this.data.state.projects;
    const seen: string[] = [];
    for (const s of [...this.data.state.sessions].sort((a, b) => b.at - a.at))
      if (
        s.cwd &&
        isFolder(s.cwd) &&
        !known.some((p) => sameFolder(p.path, s.cwd)) &&
        !seen.some((p) => sameFolder(p, s.cwd))
      )
        seen.push(s.cwd);
    return seen.slice(0, 6);
  }

  async add(folder?: string) {
    if (!folder) {
      const choice = await dialog.showOpenDialog({
        title: "Add a project folder",
        properties: ["openDirectory"],
      });
      folder = choice.filePaths[0];
      if (!folder) return null;
    }
    if (!isFolder(folder)) throw new Error("Choose a folder that exists.");
    const existing = this.data.state.projects.find((p) =>
      sameFolder(p.path, folder!),
    );
    if (existing) return existing;
    if (this.data.state.projects.length >= 100)
      throw new Error("Remove a project before adding another (up to 100).");
    const project = {
      id: randomUUID(),
      path: folder,
      name: projectName(folder),
      added: Date.now(),
    };
    this.data.state.projects = [...this.data.state.projects, project];
    this.save();
    return project;
  }

  update(a: { id: string; agent?: unknown; name?: unknown }) {
    const project = this.project(a.id);
    if (a.agent !== undefined) project.agent = this.cli(a.agent).id;
    if (a.name !== undefined) {
      const name = String(a.name).trim().slice(0, 80);
      if (!name) throw new Error("Give the project a name.");
      project.name = name;
    }
    this.save();
    return project;
  }

  remove(id: string) {
    this.data.state.projects = this.data.state.projects.filter(
      (p) => p.id !== id,
    );
    this.save();
    return true;
  }

  /** Opens a Yami Terminal tab in the folder and starts the agent there. */
  launch(a: { project?: string; cwd?: string; agent?: unknown }) {
    const project = a.project ? this.project(a.project) : undefined;
    const cwd = project?.path || (a.cwd ? String(a.cwd) : "");
    if (!cwd || !isFolder(cwd)) throw new Error("That folder is not there.");
    const id = a.agent ?? project?.agent;
    if (id === undefined || id === "") {
      this.terminal.launch({ cwd, title: project?.name || projectName(cwd) });
      return true;
    }
    const cli = this.cli(id);
    if (!this.agents().some((d) => d.id === cli.id))
      throw new Error(`${cli.name} is not installed on this PC.`);
    this.terminal.launch({ cwd, command: cli.command, title: cli.name });
    return true;
  }

  editors(): Editor[] {
    return (["vscode", "cursor"] as const).filter(
      (scheme) => !!app.getApplicationNameForProtocol(`${scheme}://`),
    );
  }

  async open(a: { id: string; target: unknown }) {
    const project = this.project(a.id);
    if (!isFolder(project.path)) throw new Error("That folder is not there.");
    if (a.target === "explorer") {
      const error = await shell.openPath(project.path);
      if (error) throw new Error(error);
      return true;
    }
    if (a.target !== "vscode" && a.target !== "cursor")
      throw new Error("Choose where to open the project.");
    if (!this.editors().includes(a.target))
      throw new Error("That editor is not installed.");
    await shell.openExternal(editorLink(a.target, project.path));
    return true;
  }

  /** The project's worktrees; the main checkout comes first. */
  async worktrees(id: string) {
    const project = this.project(id);
    try {
      const { stdout } = await exec(
        "git",
        ["-C", project.path, "worktree", "list", "--porcelain"],
        { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 },
      );
      return parseWorktrees(stdout);
    } catch {
      return [];
    }
  }

  /**
   * A new task: a worktree on its own `yami/<name>` branch beside the
   * project, then a terminal tab there, with the agent if one was chosen.
   */
  async newTask(a: { id: string; name: unknown; agent?: unknown }) {
    const project = this.project(a.id);
    const plan = worktreePlan(project.path, String(a.name ?? ""));
    if (fs.existsSync(plan.folder))
      throw new Error("A task with that name already has a folder.");
    try {
      await exec("git", plan.args, { windowsHide: true, timeout: 30000 });
    } catch (error) {
      const text = String((error as { stderr?: string }).stderr || "");
      throw new Error(
        /not a git repository/i.test(text)
          ? "This project is not a git repository."
          : /already exists/i.test(text)
            ? `The branch ${plan.branch} already exists.`
            : text.trim().split(/\r?\n/).pop() ||
              "git could not add the worktree.",
      );
    }
    this.launch({ cwd: plan.folder, agent: a.agent || undefined });
    return { branch: plan.branch, path: plan.folder };
  }

  /**
   * Fan out: one task for several agents, each in its own worktree with the
   * task written to a file there, so no prompt text is typed into a shell.
   */
  async fanOut(a: {
    id: string;
    name: unknown;
    prompt: unknown;
    agents: unknown;
  }) {
    const project = this.project(a.id);
    const prompt = String(a.prompt ?? "").trim();
    if (!prompt) throw new Error("Describe the task for the agents.");
    if (prompt.length > 20000)
      throw new Error("Keep the task under 20,000 characters.");
    const installed = new Set(this.agents().map((d) => d.id));
    const clis = (Array.isArray(a.agents) ? a.agents : []).map((id) => {
      const cli = this.cli(id);
      if (!installed.has(cli.id))
        throw new Error(`${cli.name} is not installed on this PC.`);
      return cli;
    });
    const plans = fanOutPlan(project.path, String(a.name ?? ""), clis);
    for (const p of plans)
      if (fs.existsSync(p.folder))
        throw new Error(`A task folder already exists: ${p.folder}`);
    const started: { agent: string; branch: string; path: string }[] = [];
    for (const p of plans) {
      try {
        await exec("git", p.args, { windowsHide: true, timeout: 30000 });
        await fs.promises.writeFile(
          path.join(p.folder, TASK_FILE),
          `# Task\n\n${prompt}\n`,
          "utf8",
        );
        await this.excludeTaskFile(p.folder);
      } catch (error) {
        const text = String(
          (error as { stderr?: string }).stderr || (error as Error).message,
        );
        throw new Error(
          (started.length
            ? `Started ${started.length} of ${plans.length}; `
            : "") +
            (/not a git repository/i.test(text)
              ? "this project is not a git repository."
              : /already exists/i.test(text)
                ? `the branch ${p.branch} already exists.`
                : text.trim().split(/\r?\n/).pop() ||
                  "git could not add the worktree."),
        );
      }
      this.terminal.launch({
        cwd: p.folder,
        command: p.command,
        title: `${p.cli.name} · ${p.branch.slice(5)}`,
      });
      started.push({ agent: p.cli.id, branch: p.branch, path: p.folder });
    }
    return started;
  }

  /** Adds the task file to the repository's shared info/exclude once. */
  private async excludeTaskFile(folder: string) {
    const { stdout } = await exec(
      "git",
      ["-C", folder, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { windowsHide: true, timeout: 5000 },
    );
    const file = path.join(stdout.trim(), "info", "exclude");
    const line = "/" + TASK_FILE;
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (text.split(/\r?\n/).includes(line)) return;
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.appendFile(
      file,
      (text && !text.endsWith("\n") ? "\n" : "") +
        `# Yami fan-out task files\n${line}\n`,
    );
  }

  /** Removes a task worktree; git refuses when it has uncommitted changes. */
  async removeTask(a: { id: string; path: unknown }) {
    const project = this.project(a.id);
    const tree = (await this.worktrees(a.id)).find((w) =>
      sameFolder(w.path, String(a.path ?? "")),
    );
    if (!tree) throw new Error("That worktree is gone.");
    if (tree.main) throw new Error("The main checkout cannot be removed.");
    try {
      await exec("git", ["-C", project.path, "worktree", "remove", tree.path], {
        windowsHide: true,
        timeout: 30000,
      });
    } catch (error) {
      const text = String((error as { stderr?: string }).stderr || "");
      throw new Error(
        /modified or untracked|is dirty/i.test(text)
          ? "This worktree has changes that are not committed. Commit or discard them first."
          : /permission denied|being used|resource busy|Invalid argument/i.test(
                text,
              )
            ? "Something still has this folder open. Close its terminal tabs and editors, then try again."
            : text.trim().split(/\r?\n/).pop() ||
              "git could not remove the worktree.",
      );
    }
    return this.worktrees(a.id);
  }

  private async git(folder: string) {
    try {
      const { stdout } = await exec(
        "git",
        ["-C", folder, "status", "--porcelain=v2", "--branch"],
        { windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
      );
      return parseGitStatus(stdout);
    } catch {
      return undefined;
    }
  }
  private project(id: string) {
    const project = this.data.state.projects.find((p) => p.id === id);
    if (!project) throw new Error("That project was removed.");
    return project;
  }
  private cli(id: unknown) {
    const cli = agentClis.find((c) => c.id === (id as AgentCliId));
    if (!cli) throw new Error("Unknown coding agent.");
    return cli;
  }
  private save() {
    this.data.save();
    this.changed();
  }
}
