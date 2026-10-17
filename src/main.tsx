import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/rubik";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "./style.css";
import { App } from "./App";
import { Island } from "./Island";
import { Lasso } from "./Lasso";
import { Effects } from "./Effects";
const mode = new URLSearchParams(location.search).get("window") || "main";
document.documentElement.dataset.window = mode;
function renderDesktop() {
  createRoot(document.getElementById("root")!).render(
    mode === "island" ? (
      <Island />
    ) : mode === "lasso" ? (
      <Lasso />
    ) : mode === "effect" ? (
      <Effects />
    ) : (
      <App />
    ),
  );
}
if (import.meta.env.VITE_YAMI_PREVIEW === "true" && !window.yami) {
  void import("./preview/bootstrap").then(({ startPreview }) => startPreview());
} else renderDesktop();
