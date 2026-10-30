import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./ui";
export function Lasso() {
  const [capture, setCapture] = useState<any>();
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const points = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    api("lasso.capture").then(setCapture);
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") void api("lasso.cancel");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  function draw() {
    const c = canvas.current!;
    c.width = innerWidth * devicePixelRatio;
    c.height = innerHeight * devicePixelRatio;
    const ctx = c.getContext("2d")!;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.strokeStyle = "#bcaaff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#bcaaff";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    points.current.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    ctx.stroke();
  }
  async function finish() {
    if (!drawing || !capture) return;
    setDrawing(false);
    const p = points.current;
    if (p.length < 4) {
      setError("Draw around something on your screen.");
      return;
    }
    const left = Math.max(0, Math.min(...p.map((p) => p.x))),
      top = Math.max(0, Math.min(...p.map((p) => p.y))),
      right = Math.min(innerWidth, Math.max(...p.map((p) => p.x))),
      bottom = Math.min(innerHeight, Math.max(...p.map((p) => p.y)));
    if (right - left < 10 || bottom - top < 10) return;
    const image = new Image();
    image.src = "data:image/jpeg;base64," + capture.data;
    await image.decode();
    const c = document.createElement("canvas");
    const sx = image.width / innerWidth,
      sy = image.height / innerHeight;
    c.width = (right - left) * sx;
    c.height = (bottom - top) * sy;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.beginPath();
    p.forEach((v, i) =>
      i
        ? ctx.lineTo((v.x - left) * sx, (v.y - top) * sy)
        : ctx.moveTo((v.x - left) * sx, (v.y - top) * sy),
    );
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      image,
      left * sx,
      top * sy,
      c.width,
      c.height,
      0,
      0,
      c.width,
      c.height,
    );
    await api("lasso.done", { data: c.toDataURL("image/png").split(",")[1] });
  }
  return (
    <div
      className="lasso-screen"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        points.current = [{ x: e.clientX, y: e.clientY }];
        setDrawing(true);
        draw();
      }}
      onPointerMove={(e) => {
        if (drawing) {
          points.current.push({ x: e.clientX, y: e.clientY });
          draw();
        }
      }}
      onPointerUp={() => void finish()}
    >
      {capture && <img src={"data:image/jpeg;base64," + capture.data} alt="" />}
      <div className="lasso-dim" />
      <canvas ref={canvas} />
      <div className="lasso-hint">
        <Icon name="selection" />
        {error || "Circle anything. Ask about it."}
        <kbd>Esc to cancel</kbd>
      </div>
    </div>
  );
}
