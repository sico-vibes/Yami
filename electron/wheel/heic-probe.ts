import { heicEncodeAvailable } from "../../src/wheel/heic.ts";
import type { EngineStore } from "./engines.ts";
import { runProcess } from "./spawn.ts";

let cached: boolean | null = null;

export async function cachedHeic(engines: EngineStore) {
  if (cached != null) return cached;
  const installed = engines
    .list()
    .some((item) => item.id === "ffmpeg" && item.installed);
  if (!installed) {
    cached = false;
    return false;
  }
  const exe = await engines.ensure("ffmpeg");
  const encoders = await runProcess(exe, ["-hide_banner", "-encoders"]);
  const muxers = await runProcess(exe, ["-hide_banner", "-muxers"]);
  cached = heicEncodeAvailable(
    `${encoders.stdout}\n${encoders.stderr}`,
    `${muxers.stdout}\n${muxers.stderr}`,
  );
  return cached;
}
