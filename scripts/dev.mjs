import { spawn } from "node:child_process";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await new Promise((resolve, reject) => {
  const p = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/build-native.ps1",
    ],
    { cwd: root, stdio: "inherit" },
  );
  p.on("exit", (c) =>
    c ? reject(new Error("Native build failed")) : resolve(),
  );
});
await import("./build-electron.mjs");
const server = await createServer();
await server.listen();
const electron = (await import("electron")).default;
const child = spawn(electron, ["."], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    YAMI_DEV_URL: "http://127.0.0.1:5173",
    ELECTRON_RUN_AS_NODE: "",
  },
});
child.on("exit", async (c) => {
  await server.close();
  process.exit(c || 0);
});
process.on("SIGINT", () => child.kill());
