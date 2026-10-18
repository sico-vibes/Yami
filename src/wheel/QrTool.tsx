import { useEffect, useState } from "react";
import { api } from "../api";
import { fitSize } from "./adjust";
import { readQr } from "./qr-read";
import { sourceSize, useStill } from "./stage";
import { ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

export function QrTool({ files }: { files: WheelFile[] }) {
  const { image, note, setNote } = useStill(files[0]);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!image) return;
    const canvas = document.createElement("canvas");
    const fitted = fitSize(sourceSize(image).width, sourceSize(image).height, 360);
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, fitted.width, fitted.height);
    const frame = ctx.getImageData(0, 0, fitted.width, fitted.height);
    void readQr(frame.data, fitted.width, fitted.height)
      .then((found) => {
        setText(found);
        if (!found) setNote("No QR code was found in this image.");
      })
      .catch((error: Error) => setNote(error.message));
  }, [image]);
  return (
    <ToolShell title="QR code" note={note}>
      <p className="tool-note">{text || "Looking for a code…"}</p>
      <div className="tool-actions">
        <span />
        <button
          type="button"
          className="primary"
          disabled={!text}
          onClick={() => void api("wheel.copyText", { text }).catch((error: Error) => setNote(error.message))}
        >
          Copy text
        </button>
      </div>
    </ToolShell>
  );
}
