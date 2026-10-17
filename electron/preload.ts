import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("yami", {
  invoke: (method: string, args?: unknown) =>
    ipcRenderer.invoke("yami:invoke", method, args),
  on: (callback: (event: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("yami:event", handler);
    return () => ipcRenderer.removeListener("yami:event", handler);
  },
});
