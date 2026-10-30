import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../App";
import { Island } from "../Island";
import { Stray } from "../Stray";
import { CaptionOverlay } from "../Caption";
import { DeskWidget } from "../DeskWidget";
import { Spirit } from "../ui";
import {
  emit,
  installPreviewBridge,
  previewAgents,
  previewFirstRun,
} from "./bridge";
import "./preview.css";
const TerminalWindow = lazy(() => import("../TerminalWindow"));
const screens = [
  "Home",
  "Bond",
  "Soul",
  "Desk",
  "Settings",
  "Island",
  "Controls",
  "Today",
  "Stats",
  "Clipboard",
  "Apps",
  "Wallpaper",
  "Power",
  "Radio",
  "Stray",
  "Caption",
  "Desk widget",
  "AI",
  "Terminal",
  "File wheel",
  "Background",
  "Setup",
  "Tune",
];
const overlays = ["Stray", "Caption", "Desk widget"];
function Preview() {
  const requested =
    new URLSearchParams(location.search).get("screen") || "Home";
  const [screen, setScreen] = useState(
    screens.includes(requested) ? requested : "Home",
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const island = ![
    "Home",
    "Bond",
    "Soul",
    "Desk",
    "Settings",
    "AI",
    "Terminal",
    "Setup",
    "Tune",
  ].includes(screen);
  useEffect(() => {
    history.replaceState(null, "", `?screen=${encodeURIComponent(screen)}`);
  }, [screen]);
  return (
    <div className="preview-workbench">
      <header className="preview-toolbar">
        <div>
          <Spirit size={26} />
          <b>Yami</b>
          <span>UI preview</span>
        </div>
        <label>
          Screen
          <select
            aria-label="Preview screen"
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
          >
            {screens.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button onClick={() => frame.current?.contentWindow?.location.reload()}>
          Reset demo
        </button>
        <a href="/docs/internal/index.html" target="_blank" rel="noreferrer">
          Documentation ↗
        </a>
      </header>
      <div className="preview-notice">
        Demo data · no API keys · no Windows access{" "}
        <span>
          Edit the shared React components here, then verify in the desktop app.
        </span>
      </div>
      <div
        className={`preview-stage ${screen === "File wheel" ? "preview-wheel" : screen === "Background" ? "preview-tool" : island ? "preview-island" : "preview-main"}`}
      >
        <iframe
          ref={frame}
          id="preview-frame"
          title={`Yami ${screen} screen`}
          src={`?stage=1&screen=${encodeURIComponent(screen)}`}
        />
      </div>
    </div>
  );
}
export function startPreview() {
  const params = new URLSearchParams(location.search);
  if (params.get("stage") === "1") {
    const screen = params.get("screen") || "Home",
      overlay = overlays.includes(screen),
      tool = screen === "File wheel" || screen === "Background",
      utility =
        !overlay &&
        !tool &&
        ![
          "Home",
          "Bond",
          "Soul",
          "Desk",
          "Settings",
          "AI",
          "Terminal",
          "Island",
          "Setup",
          "Tune",
        ].includes(screen),
      island = utility || screen === "Island";
    document.documentElement.dataset.window = overlay
      ? screen === "Desk widget"
        ? "widget"
        : screen.toLowerCase()
      : screen === "File wheel"
        ? "wheel"
        : screen === "Background"
          ? "tool"
          : island
            ? "island"
            : "main";
    document.documentElement.classList.add("preview-frame");
    installPreviewBridge();
    if (screen === "Setup") previewFirstRun();
    if (screen === "Island") previewAgents();
    if (screen === "File wheel" || screen === "Background") {
      void import("../wheel/entry").then((entry) =>
        entry.mountWheel(screen === "Background" ? "tool" : "wheel"),
      );
      return;
    }
    createRoot(document.getElementById("root")!).render(
      screen === "Terminal" ? (
        <Suspense fallback={<p>Opening demo terminal…</p>}>
          <TerminalWindow />
        </Suspense>
      ) : screen === "Stray" ? (
        <Stray />
      ) : screen === "Caption" ? (
        <CaptionOverlay />
      ) : screen === "Desk widget" ? (
        <DeskWidget />
      ) : island ? (
        <Island />
      ) : (
        <App />
      ),
    );
    // Place the stray layer at its starting spot on the demo desktop.
    if (screen === "Stray")
      setTimeout(() => window.yami.invoke("stray.drag", { dx: 0, dy: 0 }), 50);
    if (!overlay)
      setTimeout(
        () =>
          emit(
            island
              ? {
                  type: "panel",
                  open: utility,
                  tab: utility ? screen : "Controls",
                }
              : { type: "navigate", tab: screen.toLowerCase() },
          ),
        100,
      );
  } else createRoot(document.getElementById("root")!).render(<Preview />);
}
