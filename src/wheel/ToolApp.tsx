import { useEffect, useState } from "react";
import { api } from "../api";
import { BackgroundTool } from "./BackgroundTool";
import { CompressTool, MergeTool, MetadataTool, PendingTool } from "./SimpleTools";
import type { WheelFile } from "./types";

const preview = import.meta.env.VITE_YAMI_PREVIEW === "true";
const previewTools = [
  ["tool:background", "Background"],
  ["tool:compress", "Compress"],
  ["tool:metadata", "Details"],
  ["tool:merge", "Merge"],
];

export function ToolApp() {
  const [tool, setTool] = useState("tool:background");
  const [files, setFiles] = useState<WheelFile[]>([]);
  useEffect(() => {
    void api("wheel.tool.get").then((session) => {
      if (!session) return;
      setTool(session.tool);
      setFiles(session.files || []);
    });
  }, []);
  const body =
    tool === "tool:background" ? (
      <BackgroundTool files={files} />
    ) : tool === "tool:compress" ? (
      <CompressTool files={files} />
    ) : tool === "tool:metadata" ? (
      <MetadataTool files={files} />
    ) : tool === "tool:merge" || tool === "tool:pdf" ? (
      <MergeTool files={files} />
    ) : (
      <PendingTool title="Tool" />
    );
  if (!preview) return body;
  return (
    <div>
      <label className="wheel-sample">
        Tool
        <select aria-label="Preview tool" value={tool} onChange={(event) => {
          setTool(event.target.value);
          void api("wheel.tool.sample", { tool: event.target.value });
        }}>
          {previewTools.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
      {body}
    </div>
  );
}
