// One audio element for internet radio, kept for the life of the island
// window, so a station keeps playing when the drawer closes. Windows' media
// overlay and keys see it through the media session.

export type PlayingStation = {
  id: string;
  name: string;
  country?: string;
  tags?: string;
};
export type RadioState = {
  station?: PlayingStation;
  status: "stopped" | "loading" | "playing" | "error";
  volume: number;
};

let audio: HTMLAudioElement | undefined;
let state: RadioState = { status: "stopped", volume: 0.8 };
const listeners = new Set<(s: RadioState) => void>();
const emit = (next: Partial<RadioState>) => {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
};

function element() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "none";
  audio.volume = state.volume;
  audio.addEventListener("playing", () => emit({ status: "playing" }));
  audio.addEventListener("waiting", () => emit({ status: "loading" }));
  audio.addEventListener("error", () => {
    if (state.station) emit({ status: "error" });
  });
  navigator.mediaSession?.setActionHandler("pause", () => stopRadio());
  navigator.mediaSession?.setActionHandler("stop", () => stopRadio());
  navigator.mediaSession?.setActionHandler("play", () => {
    if (state.station) playStation(state.station);
  });
  return audio;
}

export function playStation(station: PlayingStation) {
  const a = element();
  emit({ station, status: "loading" });
  a.src = `yami-radio://${station.id}/`;
  void a.play().catch(() => emit({ status: "error" }));
  if ("mediaSession" in navigator)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: [station.country, station.tags].filter(Boolean).join(" · "),
      album: "Yami Radio",
    });
}

export function stopRadio() {
  if (!audio) return;
  audio.pause();
  // Dropping the source closes the stream, so nothing downloads while stopped.
  audio.removeAttribute("src");
  audio.load();
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  emit({ status: "stopped" });
}

export function setRadioVolume(volume: number) {
  const v = Math.max(0, Math.min(1, volume));
  if (audio) audio.volume = v;
  emit({ volume: v });
}

export function radioState() {
  return state;
}

export function onRadio(listener: (s: RadioState) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
