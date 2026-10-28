export type WheelMode = "convert" | "tools" | "actions";
export type WheelSource = "drag" | "hotkey" | "sendto" | "shelf";
export type WheelFile = {
  path: string;
  name: string;
  size: number;
  ext: string;
  /** A folder; only actions fit it. */
  folder?: boolean;
};
export type Petal = {
  id: string;
  label: string;
  group: WheelMode;
  window: boolean;
};
export type WheelCaps = { heicEncode?: boolean };
export type WheelSession = {
  id: string;
  mode: WheelMode;
  source: WheelSource;
  files: WheelFile[];
  hint: string;
  sound: boolean;
  reducedMotion: boolean;
  x: number;
  y: number;
};
export type GestureMode = WheelMode;
export type GestureEvent =
  | { type: "open" | "swap"; mode: GestureMode; x: number; y: number }
  | { type: "release"; x: number; y: number }
  | { type: "close" };
