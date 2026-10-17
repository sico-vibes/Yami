import { useEffect, useRef } from "react";
import { api } from "./api";
export function Effects() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    void api("effect.data").then(async (data: any) => {
      const c = ref.current!,
        ctx = c.getContext("2d")!;
      c.width = innerWidth * devicePixelRatio;
      c.height = innerHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const image = async (raw: any) => {
        if (!raw) return null;
        const im = new Image();
        im.src = "data:image/jpeg;base64," + raw.data;
        await im.decode();
        return im;
      };
      const before = await image(data.before),
        after = await image(data.after),
        start = performance.now();
      const draw = (now: number) => {
        const t = Math.min(1, (now - start) / 1100),
          ease = 1 - Math.pow(1 - t, 4);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (data.kind === "wallpaper" && before && after) {
          ctx.drawImage(before, 0, 0, innerWidth, innerHeight);
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            data.x,
            data.y,
            Math.hypot(innerWidth, innerHeight) * ease,
            0,
            Math.PI * 2,
          );
          ctx.clip();
          ctx.drawImage(after, 0, 0, innerWidth, innerHeight);
          ctx.restore();
        } else if (data.kind === "collapse" && before) {
          const strength = Math.sin(t * Math.PI);
          ctx.globalAlpha = Math.min(1, (1 - t) * 4);
          for (let i = 25; i >= 1; i--) {
            const radius = i * 11,
              scale = 1 - strength * 0.45 * (1 - i / 26);
            ctx.save();
            ctx.beginPath();
            ctx.arc(data.x, data.y, radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(data.x, data.y);
            ctx.rotate(strength * 0.15 * (1 - i / 26));
            ctx.scale(scale, scale);
            ctx.drawImage(before, -data.x, -data.y, innerWidth, innerHeight);
            ctx.restore();
          }
          ctx.beginPath();
          ctx.arc(data.x, data.y, 36 * strength, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            data.x,
            data.y,
            0,
            data.x,
            data.y,
            Math.max(1, 50 * strength),
          );
          gradient.addColorStop(0, "#07020f");
          gradient.addColorStop(0.6, "#251135cc");
          gradient.addColorStop(1, "#8a6fc700");
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 1 - t;
          const p = Math.min(1, t * 4);
          ctx.strokeStyle = "#e6c07a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(
            innerWidth / 2 + (data.x - innerWidth / 2) * Math.max(0, p - 0.05),
            30 + (data.y - 30) * Math.max(0, p - 0.05),
          );
          ctx.lineTo(
            innerWidth / 2 + (data.x - innerWidth / 2) * p,
            30 + (data.y - 30) * p,
          );
          ctx.stroke();
          if (p === 1)
            for (let i = 0; i < 12; i++) {
              const angle = (i * Math.PI) / 6,
                travel = (t - 0.25) * 90;
              ctx.beginPath();
              ctx.arc(
                data.x + Math.cos(angle) * travel,
                data.y + Math.sin(angle) * travel,
                1.8,
                0,
                Math.PI * 2,
              );
              ctx.fillStyle = "#f3cf83";
              ctx.fill();
            }
          ctx.globalAlpha = 1;
        }
        if (t < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas className="effect-canvas" ref={ref} />;
}
