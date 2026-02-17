// ─── Single dotenv entry point for the app ───────────────────────────
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { app, BrowserWindow } = require("electron");
const { getConfig } = require("./utils/instanceStore.cjs");
const { getInstances } = require("./utils/instanceStore.cjs");
const setupIpcHandlers = require("./ipcHandlers.cjs");
const { syncIntervals, startSyncInterval } = require("./sync.cjs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log("Configuration path:", app.getPath("userData"));

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("config-loaded", getConfig());
  });
}

app.whenReady().then(() => {
  createWindow();
  global.mainWindow = mainWindow;
  setupIpcHandlers(mainWindow);

  // Start sync intervals for authenticated instances with auto-sync
  getInstances().forEach((instance) => {
    if (instance.isAuthenticated && instance.autoSyncEnabled !== false) {
      startSyncInterval(instance.id);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  syncIntervals.forEach((interval) => clearInterval(interval));
  syncIntervals.clear();
});
