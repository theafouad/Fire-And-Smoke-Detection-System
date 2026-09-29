const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flameEyeDesktop", {
  getRuntimeStatus: () => ipcRenderer.invoke("runtime-status"),
  restartRuntime: () => ipcRenderer.invoke("restart-runtime"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url)
});
