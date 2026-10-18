export type BackgroundChoice =
  | { id: string; kind: "gradient"; stops: string[] }
  | { id: string; kind: "solid"; color: string }
  | { id: string; kind: "image"; url: string };

export const BACKGROUND_PRESETS: BackgroundChoice[] = [
  { id: "night", kind: "gradient", stops: ["#1a242c", "#2a4560", "#12161c"] },
  { id: "ember", kind: "gradient", stops: ["#ffc2a1", "#d4654a", "#3a2030"] },
  { id: "wisp", kind: "gradient", stops: ["#e7fff2", "#6fd79a", "#163832"] },
  { id: "gold", kind: "gradient", stops: ["#f6e7bf", "#c9ad5c", "#2c2412"] },
  { id: "tide", kind: "gradient", stops: ["#d7eeff", "#6aa4d4", "#1b1730"] },
  { id: "paper", kind: "solid", color: "#f4f1ea" },
  { id: "ink", kind: "solid", color: "#17140b" },
  { id: "cloud", kind: "solid", color: "#f7f7f5" },
];

export type BackgroundSettings = {
  background: string;
  padding: number;
  corners: number;
  shadow: number;
  ratio: "auto" | "1:1" | "16:9" | "4:5";
  blur: number;
};

export const backgroundDefaults: BackgroundSettings = {
  background: "night",
  padding: 160,
  corners: 24,
  shadow: 24,
  ratio: "auto",
  blur: 0,
};

export function paintBackground(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource | null,
  settings: BackgroundSettings,
  choices: BackgroundChoice[],
  backdrop: CanvasImageSource | null = null,
) {
  const source = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null;
  const imageWidth = source?.naturalWidth || source?.width || 960;
  const imageHeight = source?.naturalHeight || source?.height || 640;
  const ratio =
    settings.ratio === "1:1" ? 1 : settings.ratio === "16:9" ? 16 / 9 : settings.ratio === "4:5" ? 4 / 5 : imageWidth / imageHeight;
  let width = imageWidth + settings.padding * 2;
  let height = imageHeight + settings.padding * 2;
  if (width / height > ratio) height = width / ratio;
  else width = height * ratio;
  const scale = Math.min(1, 4096 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return;
  const choice = choices.find((item) => item.id === settings.background) || choices[0];
  fillChoice(context, canvas.width, canvas.height, choice, settings.blur, backdrop);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;
  const x = (canvas.width - drawnWidth) / 2;
  const y = (canvas.height - drawnHeight) / 2;
  const radius = settings.corners * scale;
  if (settings.shadow > 0) {
    context.save();
    context.shadowColor = "rgba(0,0,0,0.45)";
    context.shadowBlur = settings.shadow * scale;
    rounded(context, x, y, drawnWidth, drawnHeight, radius);
    context.fillStyle = "rgba(0,0,0,0.25)";
    context.fill();
    context.restore();
  }
  context.save();
  rounded(context, x, y, drawnWidth, drawnHeight, radius);
  context.clip();
  if (image) context.drawImage(image, x, y, drawnWidth, drawnHeight);
  context.restore();
}

function fillChoice(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  choice: BackgroundChoice,
  blur: number,
  backdrop: CanvasImageSource | null,
) {
  if (choice.kind === "solid") {
    context.fillStyle = choice.color;
    context.fillRect(0, 0, width, height);
    return;
  }
  if (choice.kind === "image") {
    context.fillStyle = "#12181d";
    context.fillRect(0, 0, width, height);
    if (!backdrop) return;
    context.save();
    if (blur > 0) context.filter = `blur(${blur}px)`;
    context.drawImage(backdrop, -blur, -blur, width + blur * 2, height + blur * 2);
    context.filter = "none";
    context.restore();
    return;
  }
  const linear = context.createLinearGradient(0, 0, width, height);
  choice.stops.forEach((stop, index) => linear.addColorStop(index / Math.max(1, choice.stops.length - 1), stop));
  context.fillStyle = linear;
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * 0.2, height * 0.15, 10, width * 0.2, height * 0.15, width * 0.7);
  glow.addColorStop(0, "rgba(255,255,255,0.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  if (blur > 0) context.filter = "none";
}

function rounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const curve = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + curve, y);
  context.arcTo(x + width, y, x + width, y + height, curve);
  context.arcTo(x + width, y + height, x, y + height, curve);
  context.arcTo(x, y + height, x, y, curve);
  context.arcTo(x, y, x + width, y, curve);
  context.closePath();
}

export function sampleStill() {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 480;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const sky = context.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, "#9fd4ff");
  sky.addColorStop(1, "#1c2830");
  context.fillStyle = sky;
  context.fillRect(0, 0, 720, 480);
  context.fillStyle = "#6fd79a";
  context.beginPath();
  context.arc(210, 300, 90, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c9ad5c";
  context.fillRect(360, 210, 180, 130);
  return canvas;
}
