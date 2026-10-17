// Yami colourways: three flame layers from the outer flame to the core, plus
// face line, eye and glow colours.
export type Skin = {
  // Outer flame, middle flame, core.
  flame: [string, string, string];
  line: string;
  eye: string;
  glow: string;
};
export const skins: Record<string, Skin> = {
  yami: {
    flame: ["#c3cffc", "#e9eeff", "#ffffff"],
    line: "#15161c",
    eye: "#0b0c10",
    glow: "#b8c6ff",
  },
  ember: {
    flame: ["#ff7a3d", "#ffb27a", "#fff1e4"],
    line: "#4a1a0c",
    eye: "#341107",
    glow: "#ff8a55",
  },
  wisp: {
    flame: ["#43c47f", "#a8efc4", "#f2fff7"],
    line: "#123a24",
    eye: "#0d2a1a",
    glow: "#6fd79a",
  },
  amethyst: {
    flame: ["#8b5cf6", "#cdb4ff", "#faf6ff"],
    line: "#2c1652",
    eye: "#21103b",
    glow: "#a97bff",
  },
  gilded: {
    flame: ["#f0a92a", "#ffdc85", "#fffbea"],
    line: "#4a3205",
    eye: "#352403",
    glow: "#ffc24a",
  },
  void: {
    flame: ["#5a3fb0", "#2b1f52", "#160f2c"],
    line: "#d9ccff",
    eye: "#f1ebff",
    glow: "#7b5cd6",
  },
};
export const skinFor = (soul?: string) => skins[soul || ""] || skins.yami;
