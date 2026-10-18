import { useEffect, useState } from "react";
import { api } from "../api";

type EngineRow = { id: string; version: string; installed: boolean; license: string };

export function EngineStatus() {
  const [rows, setRows] = useState<EngineRow[]>([]);
  const [note, setNote] = useState("");
  const load = () => {
    void api("wheel.engines")
      .then(setRows)
      .catch((error: Error) => setNote(error.message));
  };
  useEffect(load, []);
  return (
    <div>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="soft-button"
          disabled={row.installed}
          onClick={() =>
            void api("wheel.engines.install", { id: row.id })
              .then(load)
              .catch((error: Error) => setNote(error.message))
          }
        >
          {row.installed ? `${row.id} ready` : `Get ${row.id}`}
        </button>
      ))}
      {note && <p className="tool-note">{note}</p>}
    </div>
  );
}
