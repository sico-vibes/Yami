import { useEffect, useState } from "react";
import { api } from "../api";
import { TooltipLayer } from "../controls";
import { Icon, IconButton } from "../ui";
import type { WheelFile } from "./types";

export function FloatShelf() {
  const [files, setFiles] = useState<WheelFile[]>([]);
  useEffect(() => {
    void api("wheel.float.get").then((session) =>
      setFiles(session?.files || []),
    );
  }, []);
  return (
    <div className="float-root">
      <div className="float-card">
        <header className="tool-head">
          <div className="tool-title">
            <span className="tool-icon">
              <Icon name="push-pin" size={18} />
            </span>
            <h1>Float</h1>
          </div>
          <IconButton
            icon="x"
            label="Close"
            onClick={() => void api("wheel.float.close")}
          />
        </header>
        {files.length ? (
          files.map((file) => <p key={file.path}>{file.name}</p>)
        ) : (
          <p>No files are pinned.</p>
        )}
      </div>
      <TooltipLayer />
    </div>
  );
}
