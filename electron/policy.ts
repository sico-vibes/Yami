import os from "node:os";
import path from "node:path";

export const sensitiveTools = new Set([
  "delete_file",
  "write_file",
  "move_file",
  "close_app",
  "run_terminal",
  "power",
  "click_control",
  "click_desktop",
  "insert_text",
]);
export function requiredTarget(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Choose an application or control by name.");
  return value.trim();
}
export function checkToolPermission(
  name: string,
  settings: { terminalEnabled: boolean; desktopEnabled: boolean },
) {
  if (name === "run_terminal" && !settings.terminalEnabled)
    throw new Error("Terminal commands are disabled in Settings > Behavior.");
  if (name === "click_desktop" && !settings.desktopEnabled)
    throw new Error(
      "Raw desktop automation is disabled in Settings > Behavior.",
    );
}
export function safeWebUrl(raw: string) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Only HTTP and HTTPS links can be opened.");
  if (url.username || url.password)
    throw new Error("Links containing credentials are not accepted.");
  return url.href;
}
export function nextOccurrence(
  task: { at: string; repeat: string },
  now = new Date(),
) {
  const at = new Date(task.at);
  if (!Number.isFinite(at.getTime()))
    throw new Error("Choose a valid task time.");
  if (task.repeat === "none") return null;
  do {
    at.setDate(at.getDate() + (task.repeat === "weekly" ? 7 : 1));
  } while (at <= now);
  return at.toISOString();
}
export function assertFile(raw: string) {
  const value = path.resolve(raw),
    home = os.homedir();
  const relative = path.relative(home, value);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    /^(AppData|\.ssh|\.aws|\.codex)(\\|$)/i.test(relative) ||
    /\.(env|pem|key)$/i.test(value)
  )
    throw new Error(
      "Choose a regular file in your user folders. Private credential and application-data folders are excluded.",
    );
  return value;
}
const scheduleTools = new Set([
  "remind",
  "open_app",
  "open_url",
  "search_site",
  "set_volume",
  "media_control",
  "routine",
]);
export function validateScheduled(tool: string, args: any, depth = 0) {
  if (!scheduleTools.has(tool) || depth > 1)
    throw new Error("This action cannot run unattended.");
  if (tool === "routine") {
    if (
      !Array.isArray(args.steps) ||
      !args.steps.length ||
      args.steps.length > 10
    )
      throw new Error("A routine needs 1–10 actions.");
    for (const step of args.steps)
      validateScheduled(step.tool, step.args, depth + 1);
  }
}
