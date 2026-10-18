export type AdjustSettings = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  sharpness: number;
  clarity: number;
  dehaze: number;
  vignette: number;
  grain: number;
};

export const adjustDefaults: AdjustSettings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  sharpness: 0,
  clarity: 0,
  dehaze: 0,
  vignette: 0,
  grain: 0,
};

const LABELS: [keyof AdjustSettings, string][] = [
  ["exposure", "Exposure"],
  ["contrast", "Contrast"],
  ["highlights", "Highlights"],
  ["shadows", "Shadows"],
  ["temperature", "Temperature"],
  ["tint", "Tint"],
  ["saturation", "Saturation"],
  ["vibrance", "Vibrance"],
  ["sharpness", "Sharpness"],
  ["clarity", "Clarity"],
  ["dehaze", "Dehaze"],
  ["vignette", "Vignette"],
  ["grain", "Grain"],
];

export const adjustFields = LABELS;

function unit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-100, Math.min(100, value)) / 100;
}

function clamp(value: number) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function hash(index: number) {
  let x = index | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function adjustRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: AdjustSettings,
) {
  const out = new Uint8ClampedArray(data);
  const exposure = Math.pow(2, unit(settings.exposure));
  const contrast = 1 + unit(settings.contrast);
  const highlights = unit(settings.highlights);
  const shadows = unit(settings.shadows);
  const temperature = unit(settings.temperature) * 36;
  const tint = unit(settings.tint) * 28;
  const saturation = 1 + unit(settings.saturation);
  const vibrance = unit(settings.vibrance);
  const clarity = unit(settings.clarity);
  const dehaze = unit(settings.dehaze);
  const vignette = Math.max(0, unit(settings.vignette));
  const grain = Math.max(0, unit(settings.grain));
  const cx = width / 2;
  const cy = height / 2;
  const far = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      let r = out[index] * exposure;
      let g = out[index + 1] * exposure;
      let b = out[index + 2] * exposure;
      r = (r / 255 - 0.5) * contrast * 255 + 127.5;
      g = (g / 255 - 0.5) * contrast * 255 + 127.5;
      b = (b / 255 - 0.5) * contrast * 255 + 127.5;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma > 160) {
        const lift = highlights * (luma - 160);
        r += lift;
        g += lift;
        b += lift;
      }
      if (luma < 90) {
        const lift = shadows * (90 - luma);
        r += lift;
        g += lift;
        b += lift;
      }
      r += temperature;
      b -= temperature;
      g += tint;
      const mid = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = mid + (r - mid) * saturation;
      g = mid + (g - mid) * saturation;
      b = mid + (b - mid) * saturation;
      const peak = Math.max(r, g, b);
      const floor = Math.min(r, g, b);
      const dull = peak <= 0 ? 0 : 1 - (peak - floor) / peak;
      const extra = 1 + vibrance * dull;
      r = mid + (r - mid) * extra;
      g = mid + (g - mid) * extra;
      b = mid + (b - mid) * extra;
      const haze = 1 + dehaze * 0.35 + clarity * 0.2;
      r = (r / 255 - 0.5) * haze * 255 + 127.5;
      g = (g / 255 - 0.5) * haze * 255 + 127.5;
      b = (b / 255 - 0.5) * haze * 255 + 127.5;
      if (vignette > 0) {
        const falloff = Math.min(1, Math.hypot(x - cx, y - cy) / far);
        const shade = 1 - vignette * falloff * falloff;
        r *= shade;
        g *= shade;
        b *= shade;
      }
      if (grain > 0) {
        const noise = ((hash(index + 17) % 255) / 255 - 0.5) * grain * 48;
        r += noise;
        g += noise;
        b += noise;
      }
      out[index] = clamp(r);
      out[index + 1] = clamp(g);
      out[index + 2] = clamp(b);
    }
  }
  sharpen(out, width, height, unit(settings.sharpness));
  return out;
}

function sharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (Math.abs(amount) < 0.01 || width < 3 || height < 3) return;
  const copy = data.slice();
  const strength = amount * 0.85;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = copy[index + channel];
        const around =
          copy[index - width * 4 + channel] +
          copy[index + width * 4 + channel] +
          copy[index - 4 + channel] +
          copy[index + 4 + channel];
        data[index + channel] = clamp(center + (center - around / 4) * strength);
      }
    }
  }
}

export function fitSize(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
