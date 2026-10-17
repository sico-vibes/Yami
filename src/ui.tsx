import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
export function Spirit({
  state = "idle",
  soul = "hitodama",
  size = 100,
  onClick,
}: {
  state?: string;
  soul?: string;
  size?: number;
  onClick?: () => void;
}) {
  const id = useId().replaceAll(":", "");
  const palettes: Record<string, string[]> = {
    hitodama: ["#fff", "#bfe9ff", "#5cb8ff"],
    ember: ["#fff", "#ffa070", "#ff4530"],
    wisp: ["#fff", "#c9f5d8", "#6fd79a"],
    amethyst: ["#fff", "#e2ccff", "#a97bff"],
    gilded: ["#fff", "#ffeeb8", "#ffc24a"],
    void: ["#f2e9ff", "#8a6fc7", "#2b1e52"],
  };
  const c = palettes[soul] || palettes.hitodama;
  return (
    <span
      className={`spirit spirit-${state}`}
      style={
        { width: size, height: size, "--glow": c[2] } as React.CSSProperties
      }
      onClick={onClick}
    >
      <svg viewBox="0 0 100 110" role="img" aria-label={`Yami ${state}`}>
        <defs>
          <radialGradient id={id + "a"} cx="48%" cy="74%" r="70%">
            <stop offset="0" stopColor={c[0]} />
            <stop offset=".6" stopColor={c[1]} />
            <stop offset="1" stopColor={c[2]} />
          </radialGradient>
          <filter id={id + "b"} x="-80%" y="-60%" width="260%" height="240%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <path
          className="spirit-aura"
          d="M49 13C57 37 77 44 77 68C77 91 64 100 49 100C31 100 19 90 19 73C19 49 43 44 49 13Z"
          fill={c[2]}
          opacity=".4"
          filter={`url(#${id}b)`}
        />
        <g className="spirit-body">
          <path
            d="M51 7C54 26 72 36 75 54C82 72 77 96 59 98C52 103 33 100 28 95C11 93 14 77 19 65C24 51 38 47 43 33C47 24 47 16 51 7Z"
            fill={`url(#${id}a)`}
          />
          <ellipse cx="20" cy="86" rx="6" ry="7" fill={c[1]} />
          <ellipse cx="77" cy="86" rx="5" ry="6" fill={c[1]} />
          <g
            className="spirit-eyes"
            fill={soul === "void" ? "#ede7ff" : "#244b68"}
          >
            <ellipse cx="37" cy="74" rx="3.5" ry="5.4" />
            <ellipse cx="60" cy="74" rx="3.5" ry="5.4" />
          </g>
          <ellipse
            className="spirit-mouth"
            cx="49"
            cy="85"
            rx="2"
            ry={state === "speaking" ? 4 : 1}
            fill="#34607a"
            opacity=".6"
          />
        </g>
      </svg>
    </span>
  );
}
export function useYami(callback?: (e: YamiEvent) => void) {
  const latest = useRef(callback);
  latest.current = callback;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("state")
      .then(setState)
      .catch((e) => setError(e.message));
    return window.yami.on((e) => {
      if (e.type === "state") {
        if (e.state) setState(e.state);
        else api("state").then(setState);
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
