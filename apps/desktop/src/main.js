const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const API_URL = process.env.FLAMEEYE_API_URL || "http://127.0.0.1:8000";
const WEB_URL = process.env.FLAMEEYE_WEB_URL || "http://127.0.0.1:3000/platform";
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

let mainWindow;
let apiProcess;
let edgeProcess;

function pythonCommand() {
  return process.env.FLAMEEYE_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function startPythonProcesses() {
  if (process.env.FLAMEEYE_MANAGED_RUNTIME === "false") return;

  const python = pythonCommand();
  apiProcess = spawn(python, ["-m", "uvicorn", "apps.api.main:app", "--host", "127.0.0.1", "--port", "8000"], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
    windowsHide: true
  });
  apiProcess.on("error", (error) => {
    dialog.showErrorBox("FlameEye API could not start", `${error.message}\n\nSet FLAMEEYE_PYTHON to the correct Python executable.`);
  });

  if (process.env.FLAMEEYE_START_EDGE !== "false") {
    edgeProcess = spawn(python, ["-m", "apps.edge_agent.main"], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
      windowsHide: true
    });
    edgeProcess.on("error", (error) => {
      dialog.showErrorBox("FlameEye edge agent could not start", `${error.message}\n\nInstall apps/edge_agent/requirements.txt.`);
    });
  }
}

function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill();
}

function checkApi() {
  return new Promise((resolve) => {
    const request = http.get(`${API_URL}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await checkApi()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f4f7f3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const apiReady = await waitForApi();
  if (!apiReady && process.env.FLAMEEYE_MANAGED_RUNTIME !== "false") {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "FlameEye runtime unavailable",
      message: "The local API could not be started.",
      detail: "Install the API and edge-agent requirements, then restart FlameEye."
    });
  }

  await mainWindow.loadURL(WEB_URL);
}

ipcMain.handle("runtime-status", async () => ({
  api: await checkApi(),
  managed: process.env.FLAMEEYE_MANAGED_RUNTIME !== "false",
  edge: Boolean(edgeProcess && !edgeProcess.killed)
}));

ipcMain.handle("restart-runtime", async () => {
  stopProcess(apiProcess);
  stopProcess(edgeProcess);
  startPythonProcesses();
  return waitForApi();
});

ipcMain.handle("open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) return shell.openExternal(url);
  return false;
});

app.whenReady().then(async () => {
  startPythonProcesses();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopProcess(apiProcess);
  stopProcess(edgeProcess);
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopProcess(apiProcess);
  stopProcess(edgeProcess);
});
