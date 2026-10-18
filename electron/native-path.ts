import fs from "node:fs";
import path from "node:path";
export function nativeHostPath(directory: string) {
  try {
    const { executable } = JSON.parse(
      fs.readFileSync(path.join(directory, "host-manifest.json"), "utf8"),
    );
    if (
      typeof executable !== "string" ||
      !/^Yami\.Native-[a-f0-9]{12}\.exe$/.test(executable)
    )
      throw new Error("Invalid native host manifest.");
    const target = path.join(directory, executable);
    if (!fs.existsSync(target))
      throw new Error("The native host is missing. Rebuild Yami.");
    return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return path.join(directory, "Yami.Native.exe");
  }
}
