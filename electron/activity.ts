// Short, user-facing descriptions of model tool calls for the island card.
// Arguments come from the model, so only short display text is derived.
export type Activity = { label: string; icon: string };
const clip = (v: unknown, n = 32) => {
  const s = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};
const host = (url: unknown) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return "a page";
  }
};
export function toolActivity(name: string, a: any = {}): Activity {
  const n = clip(a.name);
  switch (name) {
    case "open_app":
      return { label: `Opening ${n || "an app"}`, icon: "app-window" };
    case "open_url":
      return { label: `Opening ${host(a.url)}`, icon: "globe" };
    case "search_web":
      return {
        label: a.deep ? "Researching the web" : "Searching the web",
        icon: "magnifying-glass",
      };
    case "search_site":
      return {
        label: `Searching ${clip(a.site, 20) || "the site"}`,
        icon: "magnifying-glass",
      };
    case "focus_app":
      return { label: `Switching to ${n || "a window"}`, icon: "browsers" };
    case "close_app":
      return { label: `Closing ${n || "a window"}`, icon: "x-circle" };
    case "move_window":
      return {
        label: `Moving ${n || "a window"}`,
        icon: "arrows-out-cardinal",
      };
    case "list_windows":
      return { label: "Looking at open windows", icon: "browsers" };
    case "read_screen":
      return { label: "Reading the screen", icon: "eye" };
    case "click_control":
      return { label: `Clicking ${n || "a control"}`, icon: "cursor-click" };
    case "click_desktop":
      return { label: "Clicking", icon: "cursor-click" };
    case "insert_text":
    case "dictation_insert":
      return { label: "Typing", icon: "keyboard" };
    case "set_volume":
      return {
        label: `Volume to ${Number(a.value) || 0}%`,
        icon: "speaker-high",
      };
    case "set_brightness":
      return { label: `Brightness to ${Number(a.value) || 0}%`, icon: "sun" };
    case "set_theme":
      return {
        label: a.dark ? "Going dark" : "Going light",
        icon: "circle-half",
      };
    case "media_control":
      return { label: "Controlling media", icon: "music-notes" };
    case "add_todo":
    case "complete_todo":
      return { label: "Updating your to-dos", icon: "check-square" };
    case "schedule_task":
      return { label: "Scheduling it", icon: "calendar-plus" };
    case "remember":
      return { label: "Remembering that", icon: "brain" };
    case "list_files":
    case "read_file":
      return { label: "Reading files", icon: "folder-open" };
    case "write_file":
    case "move_file":
      return { label: "Saving a file", icon: "floppy-disk" };
    case "delete_file":
      return { label: "Recycling a file", icon: "trash" };
    case "run_terminal":
      return { label: "Running a command", icon: "terminal-window" };
    default:
      return {
        label: clip(name.replaceAll("_", " ")) || "Working",
        icon: "sparkle",
      };
  }
}
