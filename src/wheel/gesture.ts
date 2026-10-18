import type { GestureEvent, GestureMode } from "./types";

/** Screen-pixel slop before a left-button hold counts as a drag. Match native/Wheel.cs. */
export const DRAG_SLOP_PX = 12;
/** Key-up sooner than this, during a drag, counts as a tap. Match native/Wheel.cs. */
export const TAP_MS = 350;

export type ModifierMap = Record<GestureMode, number>;
export const DEFAULT_MODIFIERS: ModifierMap = {
  convert: 0x10,
  tools: 0x11,
  actions: 0x12,
};

type Down = { at: number; count: number };

/**
 * Pure model of the Windows drag gesture. The C# host is the real hook;
 * this class is the contract covered by unit tests.
 * A modifier counts only when it is released quickly while the left button
 * is still down and the pointer has moved. Holding the key is ignored so a
 * copy/move drag can finish without opening the wheel.
 */
export class DragGesture {
  private left = false;
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private x = 0;
  private y = 0;
  private open: GestureMode | null = null;
  private readonly down = new Map<number, Down>();
  constructor(private readonly map: ModifierMap = DEFAULT_MODIFIERS) {}

  pointerDown(x: number, y: number) {
    this.left = true;
    this.dragging = false;
    this.startX = this.x = x;
    this.startY = this.y = y;
  }

  pointerMove(x: number, y: number) {
    this.x = x;
    this.y = y;
    if (!this.left || this.dragging) return;
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (dx * dx + dy * dy >= DRAG_SLOP_PX * DRAG_SLOP_PX) this.dragging = true;
  }

  pointerUp(x: number, y: number): GestureEvent | null {
    this.x = x;
    this.y = y;
    this.left = false;
    this.dragging = false;
    this.down.clear();
    if (!this.open) return null;
    return { type: "release", x, y };
  }

  keyDown(family: number, at: number) {
    if (!family) return;
    const row = this.down.get(family);
    if (row) row.count += 1;
    else this.down.set(family, { at, count: 1 });
  }

  keyUp(family: number, at: number): GestureEvent | null {
    const row = this.down.get(family);
    if (!row) return null;
    row.count -= 1;
    if (row.count > 0) return null;
    this.down.delete(family);
    if (!this.left || !this.dragging) return null;
    if (at - row.at > TAP_MS) return null;
    const mode = this.modeFor(family);
    if (!mode) return null;
    const type = this.open ? "swap" : "open";
    this.open = mode;
    return { type, mode, x: this.x, y: this.y };
  }

  cancel(): GestureEvent | null {
    const was = this.open;
    this.open = null;
    this.left = false;
    this.dragging = false;
    this.down.clear();
    return was ? { type: "close" } : null;
  }

  get mode() {
    return this.open;
  }

  private modeFor(family: number): GestureMode | null {
    for (const mode of ["convert", "tools", "actions"] as const)
      if (this.map[mode] === family) return mode;
    return null;
  }
}
