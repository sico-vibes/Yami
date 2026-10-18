export async function readQr(data: Uint8ClampedArray, width: number, height: number) {
  const { default: jsQR } = await import("jsqr");
  return jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data || "";
}
