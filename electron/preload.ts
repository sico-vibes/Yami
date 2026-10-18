import { contextBridge, ipcRenderer, webUtils } from "electron";
contextBridge.exposeInMainWorld("yami", {
  invoke: (method: string, args?: unknown) =>
    ipcRenderer.invoke("yami:invoke", method, args),
  on: (callback: (event: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("yami:event", handler);
    return () => ipcRenderer.removeListener("yami:event", handler);
  },
  // File objects cannot cross invoke(). This is the supported way to read a drop path.
  filePath: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return "";
    }
  },
});
