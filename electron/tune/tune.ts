import fs from "node:fs";
import path from "node:path";
import { tweaks, type Tweak, type TweakState } from "../../src/tune-types.ts";
import { sameValue, type RegistryIo, type Stored } from "./registry.ts";

/** What a value was before Yami applied a tweak; null means "not set". */
type Snapshot = {
  at: number;
  values: { key: string; name: string; before: Stored | null }[];
  createdKey?: boolean;
};

/**
 * Applies and undoes tweaks. Earlier values are written to disk before any
 * registry change, so Undo still works after a crash or restart.
 */
export class TuneController {
  private snapshots: Record<string, Snapshot>;
  constructor(
    private file: string,
    private io: RegistryIo,
    private catalogue: Tweak[] = tweaks,
  ) {
    let saved: Record<string, Snapshot> = {};
    try {
      saved = JSON.parse(fs.readFileSync(file, "utf8")).snapshots || {};
    } catch {}
    this.snapshots = saved;
  }

  async list(): Promise<TweakState[]> {
    return Promise.all(
      this.catalogue.map(async (t) => ({
        id: t.id,
        applied: await this.applied(t),
        undoable: !!this.snapshots[t.id],
      })),
    );
  }

  async apply(ids: unknown) {
    for (const tweak of this.pick(ids)) {
      if (await this.applied(tweak)) continue;
      const snapshot: Snapshot = {
        at: Date.now(),
        values: await Promise.all(
          tweak.values.map(async (v) => ({
            key: v.key,
            name: v.name,
            before: await this.io.read(v.key, v.name),
          })),
        ),
        createdKey: tweak.ownsKey
          ? !(await this.io.keyExists(tweak.ownsKey))
          : undefined,
      };
      // An older snapshot wins: it holds the values from before Yami.
      this.snapshots[tweak.id] ??= snapshot;
      this.save();
      for (const value of tweak.values) await this.io.write(value);
    }
    return this.list();
  }

  async undo(ids: unknown) {
    for (const tweak of this.pick(ids)) {
      const snapshot = this.snapshots[tweak.id];
      if (!snapshot) continue;
      for (const v of snapshot.values) {
        const spec = tweak.values.find(
          (t) => t.key === v.key && t.name === v.name,
        );
        if (!spec) continue;
        if (v.before)
          await this.io.write({
            ...spec,
            type: v.before.type as typeof spec.type,
            data: v.before.data,
          });
        else await this.io.deleteValue(v.key, v.name);
      }
      if (snapshot.createdKey && tweak.ownsKey)
        await this.io.deleteKey(tweak.ownsKey);
      delete this.snapshots[tweak.id];
      this.save();
    }
    return this.list();
  }

  /** Tweaks applied by Yami that show only after Explorer restarts. */
  needsRestart(ids: string[]) {
    return this.pick(ids).some((t) => t.restartExplorer);
  }

  private async applied(tweak: Tweak) {
    for (const v of tweak.values)
      if (!sameValue(await this.io.read(v.key, v.name), v)) return false;
    return true;
  }
  private pick(ids: unknown) {
    if (!Array.isArray(ids) || !ids.length)
      throw new Error("Choose tweaks to change.");
    return ids.map((id) => {
      const tweak = this.catalogue.find((t) => t.id === id);
      if (!tweak) throw new Error("Unknown tweak.");
      return tweak;
    });
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify({ snapshots: this.snapshots }));
    fs.renameSync(temp, this.file);
  }
}
