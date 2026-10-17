import { useEffect, useState } from "react";
import { api } from "./api";

type Caption = { mode: string; keys: string[]; you: string; yami: string };
// Long turns keep the most recent words in view.
const tail = (text: string, n = 150) =>
  text.length > n ? "…" + text.slice(-n).replace(/^\S*\s/, "") : text;

// Bottom-of-screen pill shown only during a voice or dictation turn.
export function CaptionOverlay() {
  const [data, setData] = useState<Caption>({
    mode: "",
    keys: [],
    you: "",
    yami: "",
  });
  useEffect(() => {
    void api("caption.data").then((d) => d && setData(d));
    return window.yami.on((e) => {
      if (e.type === "caption") setData(e.data);
    });
  }, []);
  const label =
    data.mode === "dictated"
      ? "Typed"
      : data.mode === "dictation"
        ? "Dictating"
        : "You";
  return (
    <div className="caption-window" aria-live="polite">
      {data.keys.length > 0 && (
        <div className="caption-keys">
          {data.keys.map((k, i) => (
            <span key={k + i}>
              {i > 0 && <i>+</i>}
              <kbd>{k}</kbd>
            </span>
          ))}
        </div>
      )}
      {data.yami ? (
        <div className="caption-pill reply" key="yami">
          <b>Yami</b>
          <span>{tail(data.yami)}</span>
        </div>
      ) : (
        data.mode && (
          <div className="caption-pill" key="you">
            <b>{label}</b>
            <span className={data.you ? "" : "waiting"}>
              {data.you ? tail(data.you) : "Listening…"}
            </span>
          </div>
        )
      )}
    </div>
  );
}
