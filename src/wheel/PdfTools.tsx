import { useEffect, useState } from "react";
import { api } from "../api";
import { Save, ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

type Row = { id: number; sourceIndex: number; rotation: 0 | 90 | 180 | 270 };

export function PdfSplitTool() {
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Split pages"
      note={
        note ||
        "Each page becomes its own PDF in a new folder. More than 200 pages is refused."
      }
    >
      <Save
        label="Save pages"
        onClick={() =>
          api("wheel.tool.apply", { tool: "tool:pdf-split" }).catch(
            (error: Error) => setNote(error.message),
          )
        }
      />
    </ToolShell>
  );
}

export function OrganizeTool({ files }: { files: WheelFile[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => {
    const file = files[0];
    if (!file) return;
    void api("wheel.pdf.info", { path: file.path })
      .then((info: { pages: number }) => {
        setRows(
          Array.from(
            { length: Math.min(info.pages || 1, 200) },
            (_, index) => ({
              id: index + 1,
              sourceIndex: index,
              rotation: 0 as const,
            }),
          ),
        );
      })
      .catch((error: Error) => setNote(error.message));
  }, [files]);
  const move = (index: number, step: number) => {
    const next = [...rows];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };
  return (
    <ToolShell
      title="Organize"
      note={
        note ||
        "Reorder, rotate, duplicate, or drop pages. The original PDF stays put."
      }
    >
      {rows.map((row, index) => (
        <div className="tool-row" key={row.id}>
          <span>Page {row.sourceIndex + 1}</span>
          <span>
            <button
              type="button"
              aria-label={`Rotate page ${row.sourceIndex + 1}`}
              onClick={() => {
                const rotation = ((row.rotation + 90) % 360) as Row["rotation"];
                setRows(
                  rows.map((item) =>
                    item.id === row.id ? { ...item, rotation } : item,
                  ),
                );
              }}
            >
              {row.rotation}°
            </button>
            <button
              type="button"
              aria-label="Duplicate page"
              onClick={() => {
                const copy = { ...row, id: Date.now() + index };
                setRows([
                  ...rows.slice(0, index + 1),
                  copy,
                  ...rows.slice(index + 1),
                ]);
              }}
            >
              Copy
            </button>
            <button
              type="button"
              aria-label="Delete page"
              onClick={() => setRows(rows.filter((item) => item.id !== row.id))}
            >
              Drop
            </button>
          </span>
          <span>
            <button
              type="button"
              aria-label="Move earlier"
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move later"
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </span>
        </div>
      ))}
      <Save
        label="Save organized PDF"
        onClick={() =>
          api("wheel.tool.apply", {
            tool: "tool:organize",
            pages: rows.map(({ sourceIndex, rotation }) => ({
              sourceIndex,
              rotation,
            })),
          }).catch((error: Error) => setNote(error.message))
        }
      />
    </ToolShell>
  );
}
