import { useEffect, useState } from "react";
import { api } from "./api";

/** The accent choices while a letter is held; the chosen one is lit. */
export function AccentStrip() {
  const [state, setState] = useState({ open: false, choices: "", index: 0 });
  useEffect(() => {
    void api("accent.state")
      .then(setState)
      .catch(() => {});
    return window.yami.on((e) => {
      if (e.type === "accent") setState(e as any);
    });
  }, []);
  return (
    <div className="accent-strip" role="listbox" aria-label="Accent choices">
      {[...state.choices].map((c, i) => (
        <span
          key={i}
          role="option"
          aria-selected={i === state.index}
          className={i === state.index ? "on" : ""}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
