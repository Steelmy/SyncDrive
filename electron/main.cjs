const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { app, BrowserWindow } = require('electron');
let mainWindow; // Déclaration de la fenêtre principale

const store = require('./store.cjs');
const setupIpcHandlers = require('./ipcHandlers.cjs');
const { syncIntervals, startSyncInterval } = require('./sync.cjs');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log('Configuration path:', app.getPath('userData'));

  // In development mode, load the dev server URL
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Send initial configuration to the renderer
  mainWindow.webContents.on('did-finish-load', () => {
    const instances = store.get('instances') || [];
    const currentInstanceId = store.get('currentInstanceId');
    const hasCompletedSetup = instances.length > 0;
    
    mainWindow.webContents.send('config-loaded', {
      instances,
      currentInstanceId,
      hasCompletedSetup,
    });
  });
}

// Start the app
app.whenReady().then(() => {
  createWindow();
  // Make mainWindow available globally
  global.mainWindow = mainWindow;

  // Set up IPC handlers
  setupIpcHandlers(mainWindow);

  // Start sync intervals for all instances that have auto-sync enabled
  const instances = store.get('instances') || [];
  instances.forEach(instance => {
    if (instance.isAuthenticated && instance.autoSyncEnabled !== false) {
      startSyncInterval(instance.id);
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up intervals when the app is quitting
app.on('before-quit', () => {
  syncIntervals.forEach((interval) => {
    clearInterval(interval);
  });
  syncIntervals.clear();
});
