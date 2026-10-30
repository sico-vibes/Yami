import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/rubik";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "./style.css";
const mode = new URLSearchParams(location.search).get("window") || "main";
document.documentElement.dataset.window = mode;
// Errors in any window go to Yami's ERR log (the main process limits them).
const report = (e: { message?: string; name?: string; stack?: string }, source: string) =>
  void window.yami
    ?.invoke("log.report", { message: e.message, name: e.name, stack: e.stack, source })
    .catch(() => {});
addEventListener("error", (e) =>
  report(e.error || { message: e.message }, `${e.filename}:${e.lineno}`),
);
addEventListener("unhandledrejection", (e) =>
  report(
    e.reason instanceof Error ? e.reason : { message: String(e.reason) },
    "promise",
  ),
);
// Each window loads only its own screen, so the always-on island and the small
// overlays never parse the main app's code.
const screens: Record<string, () => Promise<{ default: React.ComponentType }>> =
  {
    main: () => import("./App").then((m) => ({ default: m.App })),
    terminal: () => import("./TerminalWindow"),
    browser: () => import("./browser/BrowserApp"),
    island: () => import("./Island").then((m) => ({ default: m.Island })),
    lasso: () => import("./Lasso").then((m) => ({ default: m.Lasso })),
    picker: () => import("./Picker").then((m) => ({ default: m.Picker })),
    dock: () => import("./Dock").then((m) => ({ default: m.Dock })),
    accent: () =>
      import("./AccentStrip").then((m) => ({ default: m.AccentStrip })),
    effect: () => import("./Effects").then((m) => ({ default: m.Effects })),
    stray: () => import("./Stray").then((m) => ({ default: m.Stray })),
    widget: () =>
      import("./DeskWidget").then((m) => ({ default: m.DeskWidget })),
    caption: () =>
      import("./Caption").then((m) => ({ default: m.CaptionOverlay })),
  };
function renderDesktop() {
  if (
    mode === "wheel" ||
    mode === "shelf" ||
    mode === "tool" ||
    mode === "float"
  ) {
    void import("./wheel/entry").then((entry) => entry.mountWheel(mode));
    return;
  }
  const Screen = lazy(screens[mode] || screens.main);
  createRoot(document.getElementById("root")!).render(
    <Suspense
      fallback={
        mode === "terminal" ? (
          <div className="boot">Opening terminal…</div>
        ) : null
      }
    >
      <Screen />
    </Suspense>,
  );
}
if (import.meta.env.VITE_YAMI_PREVIEW === "true" && !window.yami) {
  void import("./preview/bootstrap").then(({ startPreview }) => startPreview());
} else renderDesktop();
