import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/rubik";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "./style.css";
import { App } from "./App";
import { Island } from "./Island";
import { Lasso } from "./Lasso";
import { Effects } from "./Effects";
import { Stray } from "./Stray";
import { CaptionOverlay } from "./Caption";
const mode = new URLSearchParams(location.search).get("window") || "main";
const TerminalWindow = lazy(() => import("./TerminalWindow"));
document.documentElement.dataset.window = mode;
function renderDesktop() {
  if (mode === "wheel" || mode === "shelf" || mode === "tool" || mode === "float") {
    void import("./wheel/entry").then((entry) => entry.mountWheel(mode));
    return;
  }
  createRoot(document.getElementById("root")!).render(
    mode === "terminal" ? (
      <Suspense fallback={<div className="boot">Opening terminal…</div>}>
        <TerminalWindow />
      </Suspense>
    ) : mode === "island" ? (
      <Island />
    ) : mode === "lasso" ? (
      <Lasso />
    ) : mode === "effect" ? (
      <Effects />
    ) : mode === "stray" ? (
      <Stray />
    ) : mode === "caption" ? (
      <CaptionOverlay />
    ) : (
      <App />
    ),
  );
}
if (import.meta.env.VITE_YAMI_PREVIEW === "true" && !window.yami) {
  void import("./preview/bootstrap").then(({ startPreview }) => startPreview());
} else renderDesktop();
