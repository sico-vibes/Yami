import { createRoot } from "react-dom/client";
import "../styles/wheel.css";
import { DropShelf } from "./DropShelf";
import { ToolApp } from "./ToolApp";
import { WheelApp } from "./WheelApp";

export function mountWheel(mode: string) {
  const node = document.getElementById("root");
  if (!node) return;
  createRoot(node).render(
    mode === "shelf" ? <DropShelf /> : mode === "tool" ? <ToolApp /> : <WheelApp />,
  );
}
