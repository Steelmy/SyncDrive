const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Instance management
  createInstance: (name) => ipcRenderer.invoke('create-instance', name),
  switchInstance: (instanceId) => ipcRenderer.invoke('switch-instance', instanceId),
  deleteInstance: (instanceId) => ipcRenderer.invoke('delete-instance', instanceId),
  renameInstance: (instanceId, newName) => ipcRenderer.invoke('rename-instance', instanceId, newName),
  
  // Directory management
  selectDirectory: (instanceId) => ipcRenderer.invoke('select-directory', instanceId),
  updateDirectoryPath: (instanceId, newPath) => ipcRenderer.invoke('update-directory-path', instanceId, newPath),
  selectDownloadDirectory: (instanceId) => ipcRenderer.invoke('select-download-directory', instanceId),
  updateDownloadSettings: (instanceId, settings) => ipcRenderer.invoke('update-download-settings', instanceId, settings),
  
  // Sync settings
  updateSyncInterval: (instanceId, intervalMinutes) => ipcRenderer.invoke('update-sync-interval', instanceId, intervalMinutes),
  updateZipMode: (instanceId, zipMode) => ipcRenderer.invoke('update-zip-mode', instanceId, zipMode),
  updateAutoSync: (instanceId, enabled) => ipcRenderer.invoke('update-auto-sync', instanceId, enabled),
  
  // Google authentication
  getGoogleAuthUrl: (instanceId) => ipcRenderer.invoke('get-google-auth-url', instanceId),
  authenticateWithCode: (instanceId, authCode) => ipcRenderer.invoke('authenticate-with-code', instanceId, authCode),
  authenticateGoogle: (instanceId) => ipcRenderer.invoke('authenticate-google', instanceId),
  logoutGoogle: (instanceId) => ipcRenderer.invoke('logout-google', instanceId),
  
  // Sync operations
  syncNow: (instanceId) => ipcRenderer.invoke('sync-now', instanceId),
  downloadFromDrive: (instanceId, options) => ipcRenderer.invoke('download-from-drive', instanceId, options),
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Event listeners
  onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', (_, data) => callback(data)),
  onSyncCompleted: (callback) => ipcRenderer.on('sync-completed', (_, data) => callback(data)),
});