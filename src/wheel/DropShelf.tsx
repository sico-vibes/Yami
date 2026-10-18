import { useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";

export function DropShelf() {
  const [hot, setHot] = useState(false);
  return (
    <div
      className={`shelf-root${hot ? " hot" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(event) => {
        event.preventDefault();
        const paths = [...event.dataTransfer.files].map(
          (file) => window.yami.filePath?.(file) || file.name,
        );
        void api("wheel.shelf.drop", { paths });
      }}
    >
      <div className="shelf-card">
        <Icon name="tray-arrow-down" size={28} />
        <h1>Drop files</h1>
        <p>Release files here to open the wheel.</p>
      </div>
    </div>
  );
}
