import type { PackId, PackStatus } from "../../src/modules.ts";
import type { EngineProgress } from "../wheel/engines.ts";

type Engines = {
  list(): {
    id: PackId;
    version: string;
    license: string;
    installed: boolean;
  }[];
  ensure(
    id: PackId,
    options?: { signal?: AbortSignal; progress?: EngineProgress },
  ): Promise<string>;
  installFile(id: PackId, file: string): Promise<string>;
  remove(id: PackId): Promise<void>;
};
type Live = {
  state: "queued" | "downloading" | "failed";
  received?: number;
  bytes?: number;
  error?: string;
  controller?: AbortController;
};

/**
 * Downloads packs one at a time through the pinned engine store. Progress is
 * reported at most every quarter second; nothing runs while the queue is empty.
 */
export class PackManager {
  private live = new Map<PackId, Live>();
  private queue: PackId[] = [];
  private running = false;
  private sent = 0;
  constructor(
    private engines: Engines,
    private changed: () => void,
    private now = Date.now,
  ) {}

  list(): PackStatus[] {
    return this.engines.list().map((e) => {
      const live = e.installed ? undefined : this.live.get(e.id);
      return {
        id: e.id,
        version: e.version,
        license: e.license,
        state: e.installed ? "installed" : live?.state || "missing",
        ...(live && {
          received: live.received,
          bytes: live.bytes,
          error: live.error,
        }),
      };
    });
  }
  install(ids: PackId[]) {
    const installed = new Set(
      this.engines
        .list()
        .filter((e) => e.installed)
        .map((e) => e.id),
    );
    let added = false;
    for (const id of ids) {
      const state = this.live.get(id)?.state;
      if (installed.has(id) || state === "queued" || state === "downloading")
        continue;
      this.live.set(id, { state: "queued" });
      this.queue.push(id);
      added = true;
    }
    if (!added) return;
    this.changed();
    void this.pump();
  }
  cancel(id: PackId) {
    const live = this.live.get(id);
    if (!live) return;
    if (live.state === "downloading") live.controller?.abort();
    else {
      this.live.delete(id);
      this.queue = this.queue.filter((q) => q !== id);
      this.changed();
    }
  }
  async remove(id: PackId) {
    if (this.live.get(id)?.state === "downloading")
      throw new Error("Cancel the download first.");
    this.cancel(id);
    await this.engines.remove(id);
    this.changed();
  }
  async installFile(id: PackId, file: string) {
    if (this.live.get(id)?.state === "downloading")
      throw new Error("Cancel the download first.");
    this.queue = this.queue.filter((q) => q !== id);
    this.live.set(id, { state: "downloading" });
    this.changed();
    try {
      await this.engines.installFile(id, file);
      this.live.delete(id);
    } catch (error) {
      this.live.set(id, { state: "failed", error: message(error) });
      throw error;
    } finally {
      this.changed();
    }
  }
  /** Aborts the running download; used when Yami quits. */
  dispose() {
    this.queue = [];
    for (const live of this.live.values()) live.controller?.abort();
  }
  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      for (let id = this.queue.shift(); id; id = this.queue.shift()) {
        if (this.live.get(id)?.state !== "queued") continue;
        const controller = new AbortController();
        const live: Live = { state: "downloading", received: 0, controller };
        this.live.set(id, live);
        this.changed();
        try {
          await this.engines.ensure(id, {
            signal: controller.signal,
            progress: (received, total) => {
              live.received = received;
              live.bytes = total || undefined;
              if (this.now() - this.sent < 250) return;
              this.sent = this.now();
              this.changed();
            },
          });
          this.live.delete(id);
        } catch (error) {
          if (controller.signal.aborted) this.live.delete(id);
          else this.live.set(id, { state: "failed", error: message(error) });
        }
        this.changed();
      }
    } finally {
      this.running = false;
    }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Download failed.";
}
