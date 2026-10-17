import type { State } from "./shared";
export const api = (method: string, args?: any): Promise<any> =>
  window.yami.invoke(method, args);
export const asset = (path: string) =>
  path.startsWith("/wallpapers/")
    ? path
    : "yami-asset://file/" + encodeURIComponent(path);
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const bytes = (n: number) =>
  !Number.isFinite(n)
    ? "—"
    : n >= 1073741824
      ? (n / 1073741824).toFixed(1) + " GB"
      : n >= 1048576
        ? (n / 1048576).toFixed(0) + " MB"
        : (n / 1024).toFixed(0) + " KB";
export const todayUsage = (state: State) =>
  Object.values(state.usage).reduce(
    (a, b) => ({
      words: a.words + b.words,
      dictations: a.dictations + b.dictations,
      turns: a.turns + b.turns,
      searches: a.searches + b.searches,
      credits: a.credits + b.credits,
    }),
    { words: 0, dictations: 0, turns: 0, searches: 0, credits: 0 },
  );
