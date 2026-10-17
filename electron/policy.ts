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
