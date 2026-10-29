import { useEffect, useRef, useState } from "react";
import { api } from "./api";

// The colour picker overlay: a still screenshot of this display, a magnifier
// that follows the pointer, and the colour under it. Click copies the
// colour; Esc closes. The screenshot is PNG, so the colour is exact.

const ZOOM = 10,
  CELLS = 11;
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

export function Picker() {
  const source = useRef<HTMLCanvasElement>(null),
    loupe = useRef<HTMLCanvasElement>(null),
    scale = useRef({ x: 1, y: 1 }),
    [ready, setReady] = useState(false),
    [at, setAt] = useState({ x: -1000, y: -1000, color: "" });
  useEffect(() => {
    void api("color.capture").then(async (shot) => {
      if (!shot) return void api("color.cancel");
      const image = new Image();
      image.src = "data:image/png;base64," + shot.data;
      await image.decode();
      const c = source.current!;
      c.width = image.width;
      c.height = image.height;
      c.getContext("2d", { willReadFrequently: true })!.drawImage(image, 0, 0);
      scale.current = {
        x: image.width / innerWidth,
        y: image.height / innerHeight,
      };
      setReady(true);
    });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") void api("color.cancel");
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const move = (e: React.PointerEvent) => {
    if (!ready) return;
    const px = Math.floor(e.clientX * scale.current.x),
      py = Math.floor(e.clientY * scale.current.y),
      half = Math.floor(CELLS / 2);
    const data = source
      .current!.getContext("2d", { willReadFrequently: true })!
      .getImageData(px - half, py - half, CELLS, CELLS).data;
    const l = loupe.current!.getContext("2d")!;
    l.imageSmoothingEnabled = false;
    for (let y = 0; y < CELLS; y++)
      for (let x = 0; x < CELLS; x++) {
        const i = (y * CELLS + x) * 4;
        l.fillStyle = hex(data[i], data[i + 1], data[i + 2]);
        l.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
      }
    const c = (half * CELLS + half) * 4;
    setAt({
      x: e.clientX,
      y: e.clientY,
      color: hex(data[c], data[c + 1], data[c + 2]),
    });
  };
  const size = CELLS * ZOOM;
  const right = at.x + 24 + size > innerWidth,
    below = at.y + 24 + size + 40 > innerHeight;
  return (
    <div
      className="picker"
      onPointerMove={move}
      onClick={() => at.color && void api("color.done", { hex: at.color })}
      onContextMenu={(e) => {
        e.preventDefault();
        void api("color.cancel");
      }}
    >
      <canvas ref={source} className="picker-source" />
      <div
        className="picker-loupe"
        style={{
          left: right ? at.x - 24 - size : at.x + 24,
          top: below ? at.y - 24 - size - 40 : at.y + 24,
          visibility: ready && at.color ? "visible" : "hidden",
        }}
      >
        <canvas ref={loupe} width={size} height={size} />
        <div className="picker-label">
          <i style={{ background: at.color }} />
          {at.color.toUpperCase()}
        </div>
      </div>
      <p className="picker-hint">Click to copy a colour · Esc to cancel</p>
    </div>
  );
}
