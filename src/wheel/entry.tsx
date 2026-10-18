import { createRoot } from "react-dom/client";
import "../styles/wheel.css";
import { DropShelf } from "./DropShelf";
import { WheelApp } from "./WheelApp";

export function mountWheel(mode: string) {
  const node = document.getElementById("root");
  if (!node) return;
  const root = createRoot(node);
  if (mode === "shelf") root.render(<DropShelf />);
  else if (mode === "tool")
    void import("./ToolApp").then(({ ToolApp }) => root.render(<ToolApp />));
  else if (mode === "float")
    void import("./FloatShelf").then(({ FloatShelf }) => root.render(<FloatShelf />));
  else root.render(<WheelApp />);
}
