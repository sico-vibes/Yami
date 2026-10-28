import fs from "node:fs";
import path from "node:path";
import { petalsFor } from "../../src/wheel/catalog.ts";

export type WatchFolder = {
  id: string;
  folder: string;
  target: string;
  enabled: boolean;
};

/**
 * Watch folders: a new file in a watched folder is converted with one wheel
 * petal (for example to:pdf). It listens for file-system events only, waits
 * until a file stops growing, and never converts its own output.
 */
export function createWatchers(deps: {
  convert: (petalId: string, file: string) => Promise<unknown>;
  notify: (message: string) => void;
  settleMs?: number;
}) {
  const settle = deps.settleMs ?? 1500;
  const watchers = new Map<string, fs.FSWatcher>();
  const pending = new Map<string, NodeJS.Timeout>();
  const done = new Set<string>();

  const consider = (watch: WatchFolder, name: string) => {
    const file = path.join(watch.folder, name);
    const key = watch.id + "|" + file;
    clearTimeout(pending.get(key));
    pending.set(
      key,
      setTimeout(async () => {
        pending.delete(key);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          return;
        }
        if (
          !stat.isFile() ||
          done.has(file) ||
          /^~\$|\.(tmp|part|crdownload)$/i.test(name)
        )
          return;
        if (!petalsFor([name], "convert").some((p) => p.id === watch.target))
          return;
        done.add(file);
        if (done.size > 2000) done.delete(done.values().next().value!);
        try {
          await deps.convert(watch.target, file);
        } catch (error) {
          deps.notify(
            `${name}: ${error instanceof Error ? error.message : "could not be converted."}`,
          );
        }
      }, settle),
    );
  };

  return {
    sync(list: WatchFolder[]) {
      const wanted = new Map(
        list.filter((w) => w.enabled).map((w) => [w.id, w]),
      );
      for (const [id, watcher] of watchers)
        if (!wanted.has(id)) {
          watcher.close();
          watchers.delete(id);
        }
      for (const [id, watch] of wanted) {
        if (watchers.has(id)) continue;
        try {
          // Files already there are left alone; only new arrivals convert.
          for (const name of fs.readdirSync(watch.folder))
            done.add(path.join(watch.folder, name));
          const watcher = fs.watch(watch.folder, (_event, name) => {
            if (name) consider(watch, String(name));
          });
          watcher.on("error", () => {
            watcher.close();
            watchers.delete(id);
          });
          watchers.set(id, watcher);
        } catch {
          deps.notify(`Yami cannot watch ${watch.folder}.`);
        }
      }
    },
    count: () => watchers.size,
    dispose() {
      for (const w of watchers.values()) w.close();
      watchers.clear();
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    },
  };
}
