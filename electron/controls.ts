import * as si from "systeminformation";
import type { Native } from "./native";
import { nativeScript } from "./platform";

// Windows quick controls shared by the Controls panel and model tools.
export async function windowsBrightness(
  native: Native,
  args: { value: number },
) {
  const value = Number(args?.value);
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error("Brightness must be between 0 and 100.");
  if ((await native.call("controls")).brightness < 0)
    throw new Error("Brightness control is not available on this monitor.");
  await native.call("brightness", { value: Math.round(value) });
  for (let attempt = 0; attempt < 4; attempt++) {
    const observed = (await native.call("controls")).brightness;
    if (Math.abs(observed - value) <= 1) return { brightness: observed };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Windows did not confirm the requested brightness.");
}
export async function windowsControls(native: Native) {
  const [base, wifi, radios] = await Promise.all([
    native.call("controls"),
    si.wifiConnections().catch(() => []),
    nativeScript("Radios").catch(() => ({})),
  ]);
  return {
    ...base,
    ...radios,
    wifi: wifi[0]?.ssid || "",
    wifiConnected: wifi.length > 0,
  };
}
