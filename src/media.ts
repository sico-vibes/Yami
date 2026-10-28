import { api } from "./api";

export type MediaAction =
  "toggle" | "next" | "previous" | "seek" | "shuffle" | "repeat";

const keys: Partial<Record<MediaAction, string>> = {
  toggle: "play_pause",
  next: "next",
  previous: "previous",
};

/**
 * Acts on the playing app's own media session, so shuffle, repeat and seek
 * work in apps that offer them (Spotify's desktop app does). Play, pause and
 * skip fall back to the media keys when the session refuses. Resolves to the
 * fresh media state.
 */
export async function mediaControl(action: MediaAction, seconds?: number) {
  try {
    return await api("media.action", { action, seconds });
  } catch (error) {
    const key = keys[action];
    if (!key) throw error;
    await api("control", { method: "mediaKey", args: { action: key } });
    return api("media");
  }
}

export const repeatLabel: Record<string, string> = {
  None: "Repeat is off",
  List: "Repeating the playlist",
  Track: "Repeating this track",
};
