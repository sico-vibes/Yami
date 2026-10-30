import { useEffect, useState } from "react";
import { api } from "./api";

type Item = {
  key: string;
  name: string;
  icon: string;
  handles: number[];
  pinned: boolean;
};

/**
 * The dock window: pinned apps, then open ones, with a dot under each app
 * that has a window. Icons grow toward the pointer (not with reduced
 * motion); a click opens or brings forward, right-click pins or unpins.
 */
export function Dock() {
  const [items, setItems] = useState<Item[]>([]),
    [hover, setHover] = useState(-1);
  useEffect(() => {
    void api("dock.items")
      .then(setItems)
      .catch(() => {});
    // Yami's own Reduced motion setting, as the other windows apply it.
    void api("state")
      .then((s) => {
        document.documentElement.dataset.reduced = String(
          !!s.settings.reducedMotion,
        );
      })
      .catch(() => {});
    return window.yami.on((e) => {
      if (e.type === "dock") setItems(e.items);
    });
  }, []);
  const grow = (i: number) => {
    const d = hover < 0 ? 9 : Math.abs(i - hover);
    return d === 0 ? 1.45 : d === 1 ? 1.2 : d === 2 ? 1.06 : 1;
  };
  const firstOpen = items.findIndex((i) => !i.pinned);
  return (
    <div
      className="dock"
      onMouseEnter={() =>
        void api("dock.items")
          .then(setItems)
          .catch(() => {})
      }
      onMouseLeave={() => setHover(-1)}
    >
      <nav className="dock-shelf" aria-label="Dock">
        {items.map((item, i) => (
          <div className="dock-slot" key={item.key}>
            {i === firstOpen && firstOpen > 0 && (
              <span className="dock-gap" aria-hidden />
            )}
            <button
              type="button"
              className="dock-item"
              style={{ "--grow": grow(i) } as React.CSSProperties}
              aria-label={
                item.handles.length ? `${item.name}, open` : item.name
              }
              onMouseEnter={() => setHover(i)}
              onClick={() =>
                void api("dock.activate", { key: item.key }).catch(() => {})
              }
              onContextMenu={(e) => {
                e.preventDefault();
                void api("dock.menu", { key: item.key });
              }}
            >
              {item.icon ? (
                <img src={item.icon} alt="" draggable={false} />
              ) : (
                <span className="dock-letter">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="dock-name">{item.name}</span>
            </button>
            <i
              className={"dock-dot" + (item.handles.length ? " on" : "")}
              aria-hidden
            />
          </div>
        ))}
        {!items.length && (
          <span className="dock-empty">Open an app to see it here</span>
        )}
      </nav>
    </div>
  );
}
