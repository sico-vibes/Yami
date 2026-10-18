import { build } from "esbuild";
await build({
  entryPoints: ["electron/workbench/terminal-host.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/terminal-host.cjs",
  external: ["node-pty"],
  target: "node22",
});
await build({
  entryPoints: ["electron/main.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/main.cjs",
  external: ["electron", "node-pty"],
  target: "node22",
});
await build({
  entryPoints: ["electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/preload.cjs",
  external: ["electron"],
  target: "node22",
});
