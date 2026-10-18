import fs from "node:fs";
import path from "node:path";
import type { WheelFile } from "../../src/wheel/types";

const compounds = [".tar.gz", ".tar.bz2", ".tar.xz"];
function extensionOf(name: string) {
  const lower = name.toLowerCase();
  const compound = compounds.find((ext) => lower.endsWith(ext));
  if (compound) return compound.slice(1);
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot + 1) : "";
}

const blockedName = /(\.env|\.pem|\.key)$/i;

/** User-chosen wheel files may live on any drive. Credential locations stay blocked. */
export function assertWheelPath(raw: string) {
  if (typeof raw !== "string" || !raw.trim())
    throw new Error("Choose a file.");
  if (raw.startsWith("preview://")) return raw;
  const value = path.resolve(raw);
  const base = path.basename(value);
  const folded = value.replace(/\\/g, "/").toLowerCase();
  if (
    blockedName.test(base) ||
    base.toLowerCase() === "credentials.bin" ||
    folded.includes("/.ssh/") ||
    folded.includes("/.aws/") ||
    folded.includes("/appdata/roaming/yami/")
  )
    throw new Error("That file is blocked.");
  return value;
}

export async function describeWheelFiles(inputs: string[]): Promise<WheelFile[]> {
  const files: WheelFile[] = [];
  for (const input of inputs) {
    const resolved = assertWheelPath(input);
    if (resolved.startsWith("preview://")) {
      const name = decodeURIComponent(resolved.slice("preview://".length));
      files.push({ path: resolved, name, size: 0, ext: extensionOf(name) });
      continue;
    }
    const stat = await fs.promises.stat(resolved);
    if (!stat.isFile()) throw new Error("Choose a file, not a folder.");
    files.push({
      path: resolved,
      name: path.basename(resolved),
      size: stat.size,
      ext: extensionOf(resolved),
    });
  }
  return files;
}
