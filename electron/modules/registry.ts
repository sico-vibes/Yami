import {
  modules,
  type ModuleId,
  type ModulesEvent,
  type ModuleSpec,
  type ModuleStatus,
  type PackId,
  type PackStatus,
} from "../../src/modules.ts";

/** Builds a module's main-process code on first use and tears it down. */
export type Loader<T = any> = {
  load(): T;
  dispose(instance: T): void;
  /** A reason the module cannot be switched off right now. */
  busy?(instance: T): string | undefined;
};

type Deps = {
  settings: () => Record<string, unknown>;
  /** Persists settings and tells every window; may reconfigure native. */
  save: () => void | Promise<unknown>;
  broadcast: (event: ModulesEvent) => void;
  packs: () => PackStatus[];
  loaders: Partial<Record<ModuleId, Loader>>;
};

// Modules without a loader are plain settings (clipboard, weather, roam):
// their existing code already checks the setting before doing any work.
export class ModuleRegistry {
  private instances = new Map<ModuleId, unknown>();
  private last = "";
  constructor(private deps: Deps) {}

  spec(id: unknown): ModuleSpec {
    const spec = modules.find((m) => m.id === id);
    if (!spec) throw new Error("Unknown module.");
    return spec;
  }
  enabled(id: ModuleId) {
    return this.deps.settings()[this.spec(id).setting] === true;
  }
  loaded(id: ModuleId) {
    return this.instances.has(id);
  }
  list(): ModuleStatus[] {
    const packs = this.deps.packs();
    return modules.map((m) => {
      const enabled = this.enabled(m.id);
      return {
        id: m.id,
        enabled,
        loaded: this.deps.loaders[m.id] ? this.instances.has(m.id) : enabled,
        packs: packs.filter((p) => m.packs.includes(p.id)),
      };
    });
  }
  /** The live instance, without building one. */
  peek<T>(id: ModuleId): T | undefined {
    return this.instances.get(id) as T | undefined;
  }
  get<T>(id: ModuleId): T {
    const spec = this.spec(id);
    if (!this.enabled(id))
      throw new Error(
        `${spec.name} is turned off. Turn it on in Settings › Modules.`,
      );
    if (!this.instances.has(id)) {
      const loader = this.deps.loaders[id];
      if (!loader) throw new Error(`${spec.name} has nothing to load.`);
      this.instances.set(id, loader.load());
      this.publish();
    }
    return this.instances.get(id) as T;
  }
  async set(id: unknown, enabled: unknown) {
    return this.apply({ [String(id)]: enabled });
  }
  /** Switches several modules at once; validates everything first. */
  async apply(choice: Record<string, unknown>, extra?: () => void) {
    if (!choice || typeof choice !== "object" || Array.isArray(choice))
      throw new Error("Choose modules to switch.");
    const entries = Object.entries(choice).map(([id, value]) => {
      const spec = this.spec(id);
      if (typeof value !== "boolean")
        throw new Error(`Choose on or off for ${spec.name}.`);
      return [spec, value] as const;
    });
    for (const [spec, value] of entries) {
      const instance = this.instances.get(spec.id);
      const reason =
        !value && instance !== undefined
          ? this.deps.loaders[spec.id]?.busy?.(instance)
          : undefined;
      if (reason) throw new Error(reason);
    }
    const settings = this.deps.settings();
    for (const [spec, value] of entries) settings[spec.setting] = value;
    extra?.();
    this.sync();
    await this.deps.save();
    return this.list();
  }
  /** Disposes modules whose setting was switched off elsewhere. */
  sync() {
    for (const [id, instance] of [...this.instances])
      if (!this.enabled(id)) {
        this.instances.delete(id);
        this.deps.loaders[id]?.dispose(instance);
      }
    this.publish();
  }
  dispose() {
    for (const [id, instance] of [...this.instances]) {
      this.instances.delete(id);
      this.deps.loaders[id]?.dispose(instance);
    }
  }
  private publish() {
    const snapshot = modules
      .map((m) => `${this.enabled(m.id)}${this.instances.has(m.id)}`)
      .join();
    if (snapshot === this.last) return;
    this.last = snapshot;
    this.deps.broadcast({ type: "modules", modules: this.list() });
  }
}

export function validPacks(packs: unknown): PackId[] {
  if (packs === undefined) return [];
  if (!Array.isArray(packs)) throw new Error("Choose downloads as a list.");
  const known = new Set(modules.flatMap((m) => m.packs));
  for (const id of packs)
    if (!known.has(id as PackId)) throw new Error("Unknown download.");
  return [...new Set(packs as PackId[])];
}

/**
 * True when the AI workspace has work that must run without its page open:
 * the agent relay, background usage or connection refreshes, or a terminal
 * shortcut. Otherwise it is built on its first request.
 */
export function workbenchDuties(
  settings: {
    monitor?: boolean;
    usageBackground?: boolean;
    terminalShortcut?: string;
  },
  connections: { enabled?: boolean; background?: boolean }[],
  hotkeys: boolean,
) {
  return (
    !!settings.monitor ||
    !!settings.usageBackground ||
    (!!settings.terminalShortcut && hotkeys) ||
    connections.some((c) => c.enabled && c.background)
  );
}
