import { useEffect, useRef, useState, type ReactNode } from "react";
import type { State, YamiEvent } from "./shared";
import { api } from "./api";
export function Icon({
  name,
  size = 20,
  fill = false,
  ...rest
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <i
      {...rest}
      className={`${fill ? "ph-fill" : "ph"} ph-${name} ${rest.className || ""}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  );
}
export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
export { YamiSpirit as Spirit } from "./yami/YamiSpirit";
// Mirrors the Living flame setting onto the document so every Yami in this
// window can read it, and wakes them when it changes.
function syncFlame(state: State) {
  const value = state.settings.livingFlame ? "on" : "off",
    root = document.documentElement;
  if (root.dataset.flame === value) return;
  root.dataset.flame = value;
  dispatchEvent(new Event("yami-flame"));
}
export function useYami(callback?: (e: YamiEvent) => void) {
  const latest = useRef(callback);
  latest.current = callback;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const track = (next: State) => {
    syncFlame(next);
    setState(next);
  };
  useEffect(() => {
    api("state")
      .then(track)
      .catch((e) => setError(e.message));
    return window.yami.on((e) => {
      if (e.type === "state") {
        if (e.state) track(e.state);
        else api("state").then(track);
      }
      if (e.type === "error") setError(e.message);
      latest.current?.(e);
    });
  }, []);
  return { state, error, setError };
}
export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={34} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const container = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        container.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      );
    (
      container.current?.querySelector<HTMLElement>("[autofocus]") ||
      focusable()[0]
    )?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={container}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  );
}
