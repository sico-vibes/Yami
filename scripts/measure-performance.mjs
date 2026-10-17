import { _electron } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const exec = promisify(execFile);
const profile = path.resolve(".artifacts/performance-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(
  path.join(profile, "data.json"),
  JSON.stringify({
    settings: {
      clipboardEnabled: false,
      contextEnabled: false,
      startHidden: true,
      weatherEnabled: false,
      // --no-roam hides the roaming window; --living-flame keeps Yami's
      // flame animating at idle.
      roam: !process.argv.includes("--no-roam"),
      livingFlame: process.argv.includes("--living-flame"),
    },
  }),
);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes("--packaged");
const app = await _electron.launch(
  packaged
    ? {
        executablePath: path.resolve(
          process.env.YAMI_PACKAGE_DIR || "release",
          "win-unpacked/Yami.exe",
        ),
        env,
        args: [],
      }
    : { args: [path.resolve(".")], env },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function snapshot() {
  const root = app.process().pid;
  const script = `$items=Get-CimInstance Win32_Process; $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add(${root});do{$added=$false;foreach($item in $items){if($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)){$added=$true}}}while($added);$perf=Get-CimInstance Win32_PerfFormattedData_PerfProc_Process; $result=@($perf|Where-Object {$ids.Contains([int]$_.IDProcess)}|ForEach-Object {@{name=$_.Name;pid=$_.IDProcess;workingSet=[double]$_.WorkingSet;privateWorkingSet=[double]$_.WorkingSetPrivate;cpuPercent=[double]$_.PercentProcessorTime}});ConvertTo-Json -InputObject $result -Compress`;
  const { stdout } = await exec(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true, timeout: 20000 },
  );
  const processes = JSON.parse(stdout);
  return {
    at: new Date().toISOString(),
    workingSetMB: +(
      processes.reduce((s, p) => s + p.workingSet, 0) /
      1024 ** 2
    ).toFixed(1),
    privateWorkingSetMB: +(
      processes.reduce((s, p) => s + p.privateWorkingSet, 0) /
      1024 ** 2
    ).toFixed(1),
    cpuPercentOfMachine: +(
      processes.reduce((s, p) => s + p.cpuPercent, 0) / os.cpus().length
    ).toFixed(2),
    processes,
  };
}
try {
  await app.firstWindow();
  await sleep(10000);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    samples.push(await snapshot());
    if (i < 2) await sleep(5000);
  }
  const evidence = {
    date: new Date().toISOString(),
    build: packaged ? "packaged" : "production-source",
    os: os.release(),
    cpu: os.cpus()[0].model,
    logicalCPUs: os.cpus().length,
    systemRAMGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    scenario: `Hidden main window, collapsed island, roaming ${process.argv.includes("--no-roam") ? "off" : "on"}, living flame ${process.argv.includes("--living-flame") ? "on" : "off"}, no provider session, clipboard/context/weather disabled; startup settled 10s; three snapshots 5s apart.`,
    method:
      "Windows Win32_PerfFormattedData_PerfProc_Process for the full current parent/child tree. WorkingSet includes shared pages; privateWorkingSet is resident private RAM. CPU is normalized by logical CPU count. Snapshots do not prove a peak or 15-minute stability.",
    samples,
  };
  fs.writeFileSync(
    ".artifacts/performance-results.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...evidence,
        samples: samples.map(({ processes, ...s }) => ({
          ...s,
          processCount: processes.length,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
