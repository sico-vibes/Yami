// Yami's own form controls and overlays: a styled Select, a tooltip layer
// that replaces native title tooltips, status chips and usage meters.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";
import { statusTone } from "./status-tone";
export { statusTone };

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
  icon?: string;
  disabled?: boolean;
};
const asOption = (o: string | SelectOption): SelectOption =>
  typeof o === "string" ? { value: o, label: o } : o;
type Place = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

/** A listbox select. Focus stays on the trigger; the menu floats in a portal
 *  so scroll containers, masks and the drawer never clip it. */
export function Select({
  value,
  options,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  value: string;
  options: (string | SelectOption)[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const items = options.map(asOption),
    id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    typed = useRef({ text: "", at: 0 }),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [place, setPlace] = useState<Place | null>(null);
  const selected = items.find((o) => o.value === value);
  const show = () => {
    if (disabled || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect(),
      want = Math.min(288, items.length * 38 + 12),
      below = innerHeight - r.bottom - 10,
      above = r.top - 10,
      up = below < want && above > below,
      width = Math.max(r.width, 168),
      left = Math.min(Math.max(8, r.left), innerWidth - width - 8);
    setPlace(
      up
        ? { left, width, bottom: innerHeight - r.top + 6, maxHeight: Math.min(288, above) }
        : { left, width, top: r.bottom + 6, maxHeight: Math.min(288, below) },
    );
    setActive(Math.max(0, items.findIndex((o) => o.value === value)));
    setOpen(true);
    trigger.current.focus();
  };
  const choose = (index: number) => {
    const option = items[index];
    if (!option || option.disabled) return;
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  };
  const step = (from: number, by: number) => {
    for (let i = from, n = 0; n < items.length; n++) {
      i = (i + by + items.length) % items.length;
      if (!items[i].disabled) return i;
    }
    return from;
  };
  const find = (letter: string) => {
    const now = Date.now(),
      t = typed.current;
    t.text = (now - t.at < 700 ? t.text : "") + letter.toLowerCase();
    t.at = now;
    return items.findIndex(
      (o) => !o.disabled && o.label.toLowerCase().startsWith(t.text),
    );
  };
  const key = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const hit = find(e.key);
        if (hit >= 0 && items[hit].value !== value) onChange(items[hit].value);
      }
      return;
    }
    if (e.key === "Escape") {
      // Close the menu without letting a surrounding dialog close too.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => step(i, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? step(-1, 1) : step(items.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const hit = find(e.key);
      if (hit >= 0) setActive(hit);
    }
  };
  // Listeners exist only while the menu is open.
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const target = e.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target))
        setOpen(false);
    };
    const close = () => setOpen(false);
    addEventListener("pointerdown", outside, true);
    addEventListener("scroll", outside, true);
    addEventListener("resize", close);
    addEventListener("blur", close);
    return () => {
      removeEventListener("pointerdown", outside, true);
      removeEventListener("scroll", outside, true);
      removeEventListener("resize", close);
      removeEventListener("blur", close);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`select ${open ? "open" : ""} ${className}`}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={key}
      >
        {selected?.icon && <Icon name={selected.icon} size={16} />}
        <span className="select-value">{selected?.label ?? value}</span>
        <Icon name="caret-down" size={13} className="select-caret" />
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className={`select-menu ${place.bottom !== undefined ? "up" : ""}`}
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              minWidth: place.width,
              maxHeight: place.maxHeight,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {items.map((o, i) => (
              <div
                key={o.value}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={`select-option ${i === active ? "active" : ""}`}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => choose(i)}
              >
                {o.icon && <Icon name={o.icon} size={16} />}
                <span>
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                {o.value === value && (
                  <Icon name="check" size={14} className="select-check" />
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

type Tip = { text: string; x: number; y: number; below: boolean };
/** One tooltip per window. Any element with `title` or `data-tip` gets a Yami
 *  tooltip; the native one is suppressed by moving `title` to `data-tip`.
 *  Event listeners only: nothing runs while the pointer is still. */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null),
    box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined,
      current: HTMLElement | null = null;
    const owner = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[title],[data-tip]")
        : null;
    const adopt = (el: HTMLElement) => {
      const title = el.getAttribute("title");
      if (title) {
        el.dataset.tip = title;
        el.removeAttribute("title");
        if (!el.hasAttribute("aria-label") && !el.textContent?.trim())
          el.setAttribute("aria-label", title);
      }
      return el.dataset.tip || "";
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const show = (el: HTMLElement, delay: number) => {
      clearTimeout(timer);
      current = el;
      const text = adopt(el);
      if (!text) return;
      timer = setTimeout(() => {
        if (current !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect(),
          below = r.top < 48;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
      }, delay);
    };
    const over = (e: PointerEvent) => {
      const el = owner(e.target);
      if (el === current) return;
      setTip(null);
      if (el) show(el, 420);
      else hide();
    };
    const focus = (e: FocusEvent) => {
      const el = owner(e.target);
      if (el && (e.target as Element).matches(":focus-visible")) show(el, 250);
    };
    addEventListener("pointerover", over, true);
    addEventListener("pointerdown", hide, true);
    addEventListener("keydown", hide, true);
    addEventListener("scroll", hide, true);
    addEventListener("focusin", focus);
    addEventListener("focusout", hide);
    addEventListener("blur", hide);
    return () => {
      clearTimeout(timer);
      removeEventListener("pointerover", over, true);
      removeEventListener("pointerdown", hide, true);
      removeEventListener("keydown", hide, true);
      removeEventListener("scroll", hide, true);
      removeEventListener("focusin", focus);
      removeEventListener("focusout", hide);
      removeEventListener("blur", hide);
    };
  }, []);
  // Keep the bubble inside the window once its width is known.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tip) return;
    const half = el.offsetWidth / 2,
      x = Math.min(Math.max(tip.x, half + 8), innerWidth - half - 8);
    el.style.left = `${x}px`;
  }, [tip]);
  return tip
    ? createPortal(
        <div
          ref={box}
          role="tooltip"
          className={`tooltip ${tip.below ? "below" : ""}`}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>,
        document.body,
      )
    : null;
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className="status-chip" data-tone={statusTone(status)}>
      <i aria-hidden="true" />
      {status}
    </span>
  );
}
/** A slim bar for a 0–1 share; warm past 75%, rose past 90%. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  const share = value === null ? 0 : Math.min(1, Math.max(0, value)),
    tone = value === null ? "unknown" : share >= 0.9 ? "high" : share >= 0.75 ? "warm" : "calm";
  return (
    <span
      className="meter"
      data-tone={tone}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(share * 100)}
    >
      <i style={{ width: `${share * 100}%` }} />
    </span>
  );
}
/** Short local date and time, e.g. "Oct 19, 12:30 AM". */
export function shortTime(at: number | string, withDate = true) {
  return new Date(at).toLocaleString(undefined, {
    ...(withDate ? { month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}
/** "Just now", "12 min ago", "3 h ago", else a short date. */
export function relativeTime(at: number) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return shortTime(at);
}
