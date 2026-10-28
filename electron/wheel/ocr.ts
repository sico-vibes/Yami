import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { helperPath } from "../workbench/terminal";

const exec = promisify(execFile);

/** Text in an image, read by Windows' own OCR engine; nothing is uploaded. */
export async function readImageText(file: string) {
  try {
    const { stdout } = await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        helperPath("Ocr.ps1"),
        "-Path",
        file,
      ],
      { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
    );
    const result = JSON.parse(stdout.trim() || "{}");
    if (result.error) throw new Error(result.error);
    return String(result.text || "");
  } catch (error) {
    const out = (error as { stdout?: string }).stdout;
    const parsed = out
      ? (JSON.parse(out.trim() || "{}") as { error?: string })
      : {};
    throw new Error(
      parsed.error || "Windows could not read text from that image.",
    );
  }
}
