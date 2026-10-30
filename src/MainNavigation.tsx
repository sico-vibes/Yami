import { useLayoutEffect, useRef } from "react";
import type { Tab } from "./shared";
import { Icon } from "./ui";

const tabs: [Tab, string, string][] = [
  ["home", "house", "Home"],
  ["bond", "link", "Bond"],
  ["soul", "flame", "Soul"],
  ["desk", "armchair", "Desk"],
  ["ai", "robot", "AI"],
  ["tune", "sliders-horizontal", "Tune"],
  ["settings", "gear", "Settings"],
];

export function MainNavigation({
  tab,
  onNavigate,
  hidden = [],
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  /** Tabs whose module is off, such as AI or Tune. */
  hidden?: Tab[];
}) {
  const dock = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = dock.current!;
    const update = () => {
      const selected = nav.querySelector<HTMLButtonElement>("button.selected");
      if (!selected?.offsetWidth) return;
      nav.style.setProperty("--dock-x", `${selected.offsetLeft}px`);
      nav.style.setProperty("--dock-width", `${selected.offsetWidth}px`);
      nav.dataset.ready = "true";
    };
    update();
    // Also follow font loading and window resizing; no idle polling.
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [tab, hidden.join()]);
  return (
    <nav ref={dock} className="bottom-dock" aria-label="Main navigation">
      <span className="dock-selection" aria-hidden="true" />
      {tabs
        .filter(([id]) => !hidden.includes(id))
        .map(([id, icon, label]) => (
          <button
            type="button"
            key={id}
            className={tab === id ? "selected" : ""}
            aria-label={label}
            aria-current={tab === id ? "page" : undefined}
            data-tip={tab === id ? undefined : label}
            onClick={() => {
              if (
                window.dispatchEvent(
                  new Event("yami-before-navigate", { cancelable: true }),
                )
              )
                onNavigate(id);
            }}
          >
            <Icon name={icon} size={22} />
            {tab === id && <span>{label}</span>}
          </button>
        ))}
    </nav>
  );
}
