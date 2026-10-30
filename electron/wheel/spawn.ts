import { spawn } from "node:child_process";

export function runProcess(
  command: string,
  args: string[],
  onText?: (text: string) => void,
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (text) => {
        stdout += text;
        onText?.(text);
      });
      child.stderr.on("data", (text) => {
        stderr += text;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    },
  );
}

export async function runChecked(
  command: string,
  args: string[],
  label: string,
  notify: (message: string) => void,
) {
  let bucket = 0;
  const result = await runProcess(command, args, (text) => {
    const fraction = text.includes("progress=end") ? 1 : null;
    if (fraction == null) return;
    const next = Math.ceil(fraction * 4);
    if (next <= bucket) return;
    bucket = next;
    notify(`${label} ${Math.min(100, Math.round(fraction * 100))}%`);
  });
  if (result.code !== 0)
    throw new Error(
      result.stderr.trim().split(/\r?\n/).at(-1) || `${label} failed.`,
    );
  return result;
}

export function decodePng(value: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) throw new Error("The preview was not a PNG.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 8 || bytes.length > 25 * 1024 * 1024)
    throw new Error("That image is too large.");
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("That image is not a PNG.");
  return bytes;
}
