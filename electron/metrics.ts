import os from "node:os";
// Loaded on first use; Stats and Controls are the only readers.
const system = () => import("systeminformation");

// Stats are served from what is already known so the tab opens instantly.
// CPU load and memory come straight from Node; the slow Windows queries
// (GPU, disks, processes, network) refresh in the background on their own
// schedules, and each is only queried again while someone keeps asking.
type Slow = {
  cpuName: string;
  speed: number;
  gpu: {
    name: string;
    load: number | null;
    used: number | null;
    total: number | null;
  }[];
  disks: { name: string; used: number; total: number }[];
  network: { rx: number; tx: number };
  processCount: number;
  processes: { name: string; memory: number; cpu: number }[];
};
const AGE: Record<keyof Slow, number> = {
  cpuName: Infinity,
  speed: Infinity,
  gpu: 10_000,
  disks: 30_000,
  network: 2_000,
  processCount: 8_000,
  processes: 8_000,
};

export function createMetrics() {
  const slow: Slow = {
    cpuName: os.cpus()[0]?.model.trim() || "",
    speed: +((os.cpus()[0]?.speed || 0) / 1000).toFixed(2),
    gpu: [],
    disks: [],
    network: { rx: 0, tx: 0 },
    processCount: 0,
    processes: [],
  };
  const at: Partial<Record<string, number>> = {},
    running = new Set<string>();
  function refresh(key: string, maxAge: number, job: () => Promise<void>) {
    if (running.has(key) || Date.now() - (at[key] || 0) < maxAge) return;
    running.add(key);
    job()
      .catch(() => {})
      .finally(() => {
        at[key] = Date.now();
        running.delete(key);
      });
  }
  function refreshSlow() {
    refresh("cpu", AGE.cpuName, async () => {
      const cpu = await (await system()).cpu();
      slow.cpuName = `${cpu.manufacturer} ${cpu.brand}`.trim() || slow.cpuName;
      slow.speed = cpu.speed || slow.speed;
    });
    refresh("gpu", AGE.gpu, async () => {
      const gpu = await (await system()).graphics();
      slow.gpu = gpu.controllers.map((g) => ({
        name: g.model,
        load: g.utilizationGpu ?? null,
        used: g.memoryUsed ?? null,
        total: g.memoryTotal ?? g.vram ?? null,
      }));
    });
    refresh("disks", AGE.disks, async () => {
      slow.disks = (await (await system()).fsSize()).map((d) => ({
        name: d.mount,
        used: d.used,
        total: d.size,
      }));
    });
    refresh("network", AGE.network, async () => {
      slow.network = (await (await system()).networkStats()).reduce(
        (a, n) => ({ rx: a.rx + (n.rx_sec || 0), tx: a.tx + (n.tx_sec || 0) }),
        { rx: 0, tx: 0 },
      );
    });
    refresh("processes", AGE.processes, async () => {
      const list = await (await system()).processes();
      slow.processCount = list.all;
      slow.processes = list.list
        .sort((a, b) => b.memRss - a.memRss)
        .slice(0, 6)
        .map((p) => ({ name: p.name, memory: p.memRss * 1024, cpu: p.cpu }));
    });
  }
  // CPU load from the change in os.cpus() times between calls.
  let previous = os.cpus().map((c) => c.times);
  function cpuLoad() {
    const now = os.cpus().map((c) => c.times);
    let busy = 0,
      total = 0;
    now.forEach((t, i) => {
      const p = previous[i] || t;
      const idle = t.idle - p.idle,
        all =
          t.user -
          p.user +
          (t.nice - p.nice) +
          (t.sys - p.sys) +
          (t.irq - p.irq) +
          idle;
      busy += all - idle;
      total += all;
    });
    previous = now;
    return total > 0 ? (busy / total) * 100 : 0;
  }
  async function metrics() {
    const load = cpuLoad();
    refreshSlow();
    const total = os.totalmem(),
      free = os.freemem();
    return {
      cpu: { name: slow.cpuName, speed: slow.speed, load },
      memory: { used: total - free, total, available: free },
      gpu: slow.gpu,
      disks: slow.disks,
      network: slow.network,
      uptime: os.uptime(),
      processCount: slow.processCount,
      processes: slow.processes,
    };
  }
  // Start the slow queries early (for example when the drawer opens) and
  // begin a fresh CPU sample window so the first reading is current.
  metrics.warm = () => {
    previous = os.cpus().map((c) => c.times);
    refreshSlow();
  };
  return metrics;
}
