import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./ui";
import { Select } from "./controls";
import { windowLayouts } from "./window-layouts";

/**
 * Controls card: pick a colour from the screen, recent colours (click to
 * copy again), and pin the last window you used on top of the others.
 */
export function ScreenTools({ report }: { report: (m: string) => void }) {
  const [colors, setColors] = useState<string[]>([]),
    [pin, setPin] = useState<{ window: string; pinned: boolean }>({
      window: "",
      pinned: false,
    });
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("color.history")
      .then(setColors)
      .catch(() => {});
    void api("window.pinned")
      .then(setPin)
      .catch(() => {});
    return window.yami.on((e) => {
      if (e.type !== "colors") return;
      setColors(e.colors);
      if (e.picked) report(`Copied ${e.picked.toUpperCase()}.`);
    });
  }, []);
  const name = pin.window || "the last window";
  return (
    <div className="screen-tools">
      <div className="screen-tools-row">
        <button
          className="soft-button"
          onClick={() => void api("color.pick").catch(fail)}
        >
          <Icon name="eyedropper" size={16} />
          Pick a colour
        </button>
        <button
          className={"soft-button" + (pin.pinned ? " active" : "")}
          aria-pressed={pin.pinned}
          onClick={() =>
            void api("window.pin")
              .then((r) => {
                setPin({ window: r.process, pinned: r.pinned });
                report(
                  r.pinned
                    ? `${r.title || r.process} stays on top.`
                    : `${r.title || r.process} is no longer on top.`,
                );
              })
              .catch(fail)
          }
          data-tip="Click the window first, then this"
        >
          <Icon name={pin.pinned ? "push-pin-slash" : "push-pin"} size={16} />
          {pin.pinned ? `Unpin ${name}` : `Keep ${name} on top`}
        </button>
      </div>
      <Select
        label={`Arrange ${name}`}
        value=""
        onChange={(layout) =>
          void api("window.snap", { layout })
            .then((r) =>
              report(
                `${r.window} moved: ${windowLayouts.find((l) => l.id === layout)?.label.toLowerCase()}.`,
              ),
            )
            .catch(fail)
        }
        options={[
          { value: "", label: `Arrange ${name}…`, icon: "layout" },
          ...windowLayouts.map((l) => ({
            value: l.id,
            label: l.label,
            icon: l.icon,
          })),
        ]}
      />
      {!!colors.length && (
        <div className="screen-tools-colors" aria-label="Recent colours">
          {colors.map((c) => (
            <button
              key={c}
              className="color-swatch"
              style={{ background: c }}
              aria-label={`Copy ${c.toUpperCase()}`}
              data-tip={c.toUpperCase()}
              onClick={() =>
                void navigator.clipboard
                  .writeText(c)
                  .then(() => report(`Copied ${c.toUpperCase()}.`))
                  .catch(fail)
              }
            />
          ))}
          <button
            className="text-button"
            onClick={() => void api("color.clear").then(setColors).catch(fail)}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
