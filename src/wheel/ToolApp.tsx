import { useEffect, useState } from "react";
import { api } from "../api";
import { Select, TooltipLayer } from "../controls";
import { ToolIdContext } from "./ToolShell";
import { AdjustTool } from "./AdjustTool";
import { BackgroundTool } from "./BackgroundTool";
import { CollageTool } from "./CollageTool";
import { CropTool } from "./CropTool";
import { MarkupTool } from "./MarkupTool";
import {
  BleepTool,
  ChannelsTool,
  JoinTool,
  NormalizeTool,
  SnapTool,
  SpeedTool,
  SplitTool,
  TrimTool,
  VideoCropTool,
  VideoRedactTool,
  VisualizerTool,
} from "./MediaTools";
import { OrganizeTool, PdfSplitTool } from "./PdfTools";
import { QrTool } from "./QrTool";
import { RenameTool } from "./RenameTool";
import { RedactTool } from "./RedactTool";
import { CompressTool, MergeTool, MetadataTool, PendingTool } from "./SimpleTools";
import type { WheelFile } from "./types";

const preview = import.meta.env.VITE_YAMI_PREVIEW === "true";
const previewTools = [
  ["tool:background", "Background"],
  ["tool:compress", "Compress"],
  ["tool:metadata", "Details"],
  ["tool:merge", "Merge"],
  ["tool:adjust", "Adjust"],
  ["tool:markup", "Markup"],
  ["tool:crop", "Crop"],
  ["tool:redact", "Redact"],
  ["tool:collage", "Collage"],
  ["tool:qr", "QR"],
  ["tool:trim", "Trim"],
  ["tool:video-crop", "Video crop"],
  ["tool:speed", "Speed"],
  ["tool:join", "Join"],
  ["tool:snapshots", "Snapshots"],
  ["tool:split", "Split"],
  ["tool:video-redact", "Video redact"],
  ["tool:normalize", "Normalize"],
  ["tool:channels", "Channels"],
  ["tool:bleep", "Bleep"],
  ["tool:visualizer", "Visualizer"],
  ["tool:pdf-split", "Split pages"],
  ["tool:organize", "Organize"],
  ["tool:rename", "Rename"],
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
  const body = (
    <ToolIdContext.Provider value={tool}>
      {bodyFor(tool, files)}
      <TooltipLayer />
    </ToolIdContext.Provider>
  );
  if (!preview) return body;
  return (
    <div className="tool-preview-frame">
      <div className="tool-sample">
        <Select
          label="Preview tool"
          value={tool}
          options={previewTools.map(([value, label]) => ({ value, label }))}
          onChange={(next) => {
            setTool(next);
            void api("wheel.tool.sample", { tool: next }).then(() => api("wheel.tool.get")).then((session) => {
              if (session) setFiles(session.files || []);
            });
          }}
        />
      </div>
      {body}
    </div>
  );
}

function bodyFor(tool: string, files: WheelFile[]) {
  switch (tool) {
    case "tool:rename":
      return <RenameTool files={files} />;
    case "tool:background":
      return <BackgroundTool files={files} />;
    case "tool:compress":
      return <CompressTool files={files} />;
    case "tool:metadata":
      return <MetadataTool files={files} />;
    case "tool:merge":
    case "tool:pdf":
      return <MergeTool files={files} />;
    case "tool:adjust":
      return <AdjustTool files={files} />;
    case "tool:markup":
      return <MarkupTool files={files} />;
    case "tool:crop":
      return <CropTool files={files} />;
    case "tool:redact":
      return <RedactTool files={files} />;
    case "tool:collage":
      return <CollageTool files={files} />;
    case "tool:qr":
      return <QrTool files={files} />;
    case "tool:trim":
      return <TrimTool files={files} />;
    case "tool:video-crop":
      return <VideoCropTool />;
    case "tool:speed":
      return <SpeedTool />;
    case "tool:join":
      return <JoinTool files={files} />;
    case "tool:snapshots":
      return <SnapTool />;
    case "tool:split":
      return <SplitTool />;
    case "tool:video-redact":
      return <VideoRedactTool />;
    case "tool:normalize":
      return <NormalizeTool />;
    case "tool:channels":
      return <ChannelsTool />;
    case "tool:bleep":
      return <BleepTool />;
    case "tool:visualizer":
      return <VisualizerTool />;
    case "tool:pdf-split":
      return <PdfSplitTool />;
    case "tool:organize":
      return <OrganizeTool files={files} />;
    default:
      return <PendingTool title="Tool" />;
  }
}
