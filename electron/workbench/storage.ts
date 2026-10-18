import fs from "node:fs";
import path from "node:path";
import type { Store } from "../store";
import {
  workbenchDefaults,
  type WorkbenchState,
} from "../../src/workbench-types";
export class WorkbenchStorage {
  deleted = false;
  private saveTimer?: NodeJS.Timeout;
  state: WorkbenchState;
  file: string;
  constructor(public store: Store) {
    this.file = path.join(path.dirname(store.file), "workbench.json");
    let saved: Partial<WorkbenchState> = {};
    try {
      saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {}
    this.state = {
      connections: [],
      readings: [],
      rules: [],
      notes: [],
      history: [],
      ...saved,
      settings: { ...workbenchDefaults, ...saved.settings },
      sessions: [],
      requests: [],
      usage: (saved.usage || []).map((u) => ({ ...u, status: "stale" })),
    };
    this.trim();
  }
  trim() {
    const days = Math.min(90, Math.max(0, this.state.settings.recapRetention));
    this.state.history = days
      ? this.state.history
          .filter((e) => e.at > Date.now() - days * 86400000)
          .slice(-5000)
      : [];
  }
  save() {
    if (this.deleted) return;
    clearTimeout(this.saveTimer);
    this.trim();
    const temp = this.file + ".tmp";
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      temp,
      JSON.stringify({ ...this.state, sessions: [], requests: [] }),
    );
    fs.renameSync(temp, this.file);
  }
  publicState(): WorkbenchState {
    return {
      ...this.state,
      notes: this.state.notes.map((n) => ({
        id: n.id,
        title: n.title,
        text: n.text.slice(0, 200),
        at: n.at,
      })),
      settings: {
        ...this.state.settings,
        localHasKey: !!this.store.key("provider:local"),
        mcpHasKey: !!this.store.key("provider:mcp"),
      },
      connections: this.state.connections.map((c) => ({
        ...c,
        hasKey: !!this.store.key(`connection:${c.id}`),
      })),
    };
  }
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }
  dispose() {
    clearTimeout(this.saveTimer);
    this.save();
  }
}
