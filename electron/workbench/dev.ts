import { app, dialog, shell } from "electron";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
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
  projectName,
  sameFolder,
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
