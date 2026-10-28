import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon, IconButton } from "./ui";
import { mediaControl, type MediaAction } from "./media";
import { currentLine, type LyricLine } from "./lyrics-line";

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Now-playing card that grows out of the collapsed island while hovered.
// Progress ticks locally once a second and re-reads Windows every few
// seconds, only while the card is open.
export function MediaPeek({
  media,
  lyrics = false,
  onMedia,
  onLeave,
  onOpen,
}: {
  media: any;
  /** Opt-in: show the current line from LRCLIB under the artist. */
  lyrics?: boolean;
  onMedia: (m: any) => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const [position, setPosition] = useState(media.position || 0);
  const [lines, setLines] = useState<LyricLine[]>([]);
  // One lookup per track while the card is open; the main process caches it.
  useEffect(() => {
    setLines([]);
    if (!lyrics || !media.title) return;
    let alive = true;
    void api("lyrics", {
      artist: media.artist,
      title: media.title,
      duration: media.duration,
    })
      .then((found) => alive && setLines(found?.lines || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lyrics, media.title, media.artist]);
  const line = currentLine(lines, position);
  useEffect(() => setPosition(media.position || 0), [media.position]);
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n % 5 === 0)
        void api("media")
          .then(onMedia)
          .catch(() => {});
      else if (media.playing)
        setPosition((p: number) => Math.min(media.duration || p + 1, p + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [media.playing, media.duration]);
  const key = (action: MediaAction) =>
    void mediaControl(action)
      .then(onMedia)
      .catch(() => {});
  return (
    <div className="media-peek" onMouseLeave={onLeave}>
      <button
        className="media-peek-art"
        aria-label="Open controls"
        onClick={onOpen}
      >
        <Icon name="music-notes" size={22} />
      </button>
      <div className="media-peek-body">
        <b>{media.title}</b>
        <span>{media.artist || "Now playing"}</span>
        {line?.text && (
          <span className="media-peek-lyric" aria-live="off">
            {line.text}
          </span>
        )}
        <div className="media-peek-progress">
          <small>{clock(position)}</small>
          <progress max={Math.max(1, media.duration || 1)} value={position} />
          <small>{clock(media.duration || 0)}</small>
        </div>
      </div>
      <div className="media-peek-keys">
        <IconButton
          icon="skip-back"
          label="Previous track"
          onClick={() => key("previous")}
        />
        <button
          className="play-button"
          aria-label={media.playing ? "Pause" : "Play"}
          onClick={() => key("toggle")}
        >
          <Icon name={media.playing ? "pause" : "play"} fill size={16} />
        </button>
        <IconButton
          icon="skip-forward"
          label="Next track"
          onClick={() => key("next")}
        />
      </div>
    </div>
  );
}
