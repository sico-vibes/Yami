import * as si from "systeminformation";
import os from "node:os";
export function createMetrics() {
  let lastMetrics: any,
    metricsAt = 0;
  return async function metrics() {
    if (Date.now() - metricsAt < 1500 && lastMetrics) return lastMetrics;
    const [cpu, load, mem, gpu, disks, network, processes] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.graphics(),
      si.fsSize(),
      si.networkStats(),
      si.processes(),
    ]);
    lastMetrics = {
      cpu: {
        name: cpu.manufacturer + " " + cpu.brand,
        speed: cpu.speed,
        load: load.currentLoad,
      },
      memory: { used: mem.active, total: mem.total, available: mem.available },
      gpu: gpu.controllers.map((g) => ({
        name: g.model,
        load: g.utilizationGpu ?? null,
        used: g.memoryUsed ?? null,
        total: g.memoryTotal ?? g.vram ?? null,
      })),
      disks: disks.map((d) => ({ name: d.mount, used: d.used, total: d.size })),
      network: network.reduce(
        (a, n) => ({ rx: a.rx + (n.rx_sec || 0), tx: a.tx + (n.tx_sec || 0) }),
        { rx: 0, tx: 0 },
      ),
      uptime: os.uptime(),
      processCount: processes.all,
      processes: processes.list
        .sort((a, b) => b.memRss - a.memRss)
        .slice(0, 6)
        .map((p) => ({ name: p.name, memory: p.memRss * 1024, cpu: p.cpu })),
    };
    metricsAt = Date.now();
    return lastMetrics;
  };
}
