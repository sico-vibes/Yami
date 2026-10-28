// The part of the qrcode package Yami uses (it ships no types).
declare module "qrcode" {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" },
  ): { modules: { size: number; get(x: number, y: number): boolean | number } };
  const QRCode: { create: typeof create };
  export default QRCode;
}
