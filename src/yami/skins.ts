// Cat-ghost colourways. `body` runs from the lit core to the shaded edge.
export type Skin = {
  body: [string, string, string];
  line: string;
  eye: string;
  glow: string;
};
export const skins: Record<string, Skin> = {
  yami: {
    body: ["#ffffff", "#f3f5ff", "#d3d9f2"],
    line: "#15161c",
    eye: "#0b0c10",
    glow: "#b8c6ff",
  },
  ember: {
    body: ["#fff7f0", "#ffc6a3", "#ff7c4c"],
    line: "#4a1a0c",
    eye: "#341107",
    glow: "#ff8a55",
  },
  wisp: {
    body: ["#f5fff9", "#cdf6db", "#6fd79a"],
    line: "#123a24",
    eye: "#0d2a1a",
    glow: "#6fd79a",
  },
  amethyst: {
    body: ["#fcf8ff", "#e4d0ff", "#a97bff"],
    line: "#2c1652",
    eye: "#21103b",
    glow: "#a97bff",
  },
  gilded: {
    body: ["#fffdf3", "#ffefbd", "#ffc24a"],
    line: "#4a3205",
    eye: "#352403",
    glow: "#ffc24a",
  },
  void: {
    body: ["#46357a", "#261b47", "#130d26"],
    line: "#d9ccff",
    eye: "#f1ebff",
    glow: "#7b5cd6",
  },
};
export const skinFor = (soul?: string) => skins[soul || ""] || skins.yami;
