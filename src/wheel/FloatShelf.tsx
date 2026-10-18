import { useEffect, useState } from "react";
import { api } from "../api";
import type { WheelFile } from "./types";

export function FloatShelf() {
  const [files, setFiles] = useState<WheelFile[]>([]);
  useEffect(() => {
    void api("wheel.float.get").then((session) => setFiles(session?.files || []));
  }, []);
  return (
    <div className="float-root">
      <div className="float-card">
        <header className="tool-head">
          <h1>Float</h1>
          <button type="button" aria-label="Close" onClick={() => void api("wheel.float.close")}>
            ×
          </button>
        </header>
        {files.length ? (
          files.map((file) => (
            <p key={file.path}>
              {file.name}
            </p>
          ))
        ) : (
          <p>No files are pinned.</p>
        )}
      </div>
    </div>
  );
}
