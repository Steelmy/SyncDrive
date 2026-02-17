const { ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const url = require("url");
const { google } = require("googleapis");

const {
  createOAuth2Client,
  validateCredentials,
  OAUTH_SCOPES,
} = require("./utils/oauth.cjs");
const {
  getInstances,
  findInstance,
  updateInstance,
  saveInstances,
  getConfig,
  setCurrentInstanceId,
  getCurrentInstanceId,
} = require("./utils/instanceStore.cjs");
const {
  DEFAULT_SYNC_INTERVAL,
  startSyncInterval,
  stopSyncInterval,
  syncWithDrive,
} = require("./sync.cjs");
const { createInstanceFolders } = require("./folders.cjs");
const { downloadFromDrive } = require("./download.cjs");

let mainWindow;

function setupIpcHandlers(win) {
  mainWindow = win;

  // ─── Instance management ────────────────────────────────────────
  registerInstanceHandlers();

  // ─── Directory & settings ───────────────────────────────────────
  registerDirectoryHandlers();
  registerSettingsHandlers();

  // ─── Google authentication ──────────────────────────────────────
  registerAuthHandlers();

  // ─── Sync & download ───────────────────────────────────────────
  registerSyncHandlers();
}

// ─── Instance Handlers ────────────────────────────────────────────────

function registerInstanceHandlers() {
  ipcMain.handle("create-instance", async (event, name) => {
    const instances = getInstances();
    const newInstance = {
      id: Date.now().toString(),
      name: name || `Instance ${instances.length + 1}`,
      rootDirectory: null,
      isAuthenticated: false,
      userInfo: null,
      tokens: null,
      syncInterval: DEFAULT_SYNC_INTERVAL,
      lastSyncTime: null,
      syncHistory: [],
      zipMode: false,
      autoSyncEnabled: true,
      driveFolderId: null,
      currentFolderId: null,
      backupFolderId: null,
      backupLocalFolderId: null,
      downloadPath: null,
      downloadUnzip: true,
      downloadReplace: false,
    };

    instances.push(newInstance);
    saveInstances(instances);
    setCurrentInstanceId(newInstance.id);

    return newInstance;
  });

  ipcMain.handle("switch-instance", async (event, instanceId) => {
    setCurrentInstanceId(instanceId);
    return true;
  });

  ipcMain.handle("delete-instance", async (event, instanceId) => {
    const instances = getInstances();
    const filteredInstances = instances.filter(
      (inst) => inst.id !== instanceId,
    );
    saveInstances(filteredInstances);
    stopSyncInterval(instanceId);

    if (getCurrentInstanceId() === instanceId && filteredInstances.length > 0) {
      setCurrentInstanceId(filteredInstances[0].id);
    }

    return filteredInstances;
  });

  ipcMain.handle("rename-instance", async (event, instanceId, newName) => {
    if (!newName.trim()) return false;
    const { success } = updateInstance(instanceId, { name: newName.trim() });
    return success;
  });
}

// ─── Directory Handlers ───────────────────────────────────────────────

function registerDirectoryHandlers() {
  ipcMain.handle("select-directory", async (event, instanceId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (!result.canceled) {
      const { success } = updateInstance(instanceId, {
        rootDirectory: result.filePaths[0],
      });
      return success ? result.filePaths[0] : null;
    }
    return null;
  });

  ipcMain.handle(
    "update-directory-path",
    async (event, instanceId, newPath) => {
      try {
        if (!fs.existsSync(newPath))
          return { success: false, error: "Path does not exist" };

        const stats = fs.statSync(newPath);
        if (!stats.isDirectory())
          return { success: false, error: "Path is not a directory" };

        const { success } = updateInstance(instanceId, {
          rootDirectory: newPath,
        });
        return success
          ? { success: true, path: newPath }
          : { success: false, error: "Instance not found" };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("select-download-directory", async (event, instanceId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (!result.canceled) {
      const { success } = updateInstance(instanceId, {
        downloadPath: result.filePaths[0],
      });
      return success ? result.filePaths[0] : null;
    }
    return null;
  });
}

// ─── Settings Handlers ───────────────────────────────────────────────

function registerSettingsHandlers() {
  ipcMain.handle(
    "update-download-settings",
    async (event, instanceId, settings) => {
      const updates = {};
      if (settings.downloadPath !== undefined)
        updates.downloadPath = settings.downloadPath;
      if (settings.downloadUnzip !== undefined)
        updates.downloadUnzip = settings.downloadUnzip;
      if (settings.downloadReplace !== undefined)
        updates.downloadReplace = settings.downloadReplace;

      const { success } = updateInstance(instanceId, updates);
      return success;
    },
  );

  ipcMain.handle(
    "update-sync-interval",
    async (event, instanceId, intervalMinutes) => {
      const intervalMs = intervalMinutes * 60 * 1000;
      const { success, instance } = updateInstance(instanceId, {
        syncInterval: intervalMs,
      });

      if (
        success &&
        instance.isAuthenticated &&
        instance.autoSyncEnabled !== false
      ) {
        stopSyncInterval(instanceId);
        startSyncInterval(instanceId);
      }

      return success;
    },
  );

  ipcMain.handle("update-zip-mode", async (event, instanceId, zipMode) => {
    const { success } = updateInstance(instanceId, { zipMode });
    return success;
  });

  ipcMain.handle("update-auto-sync", async (event, instanceId, enabled) => {
    const { success, instance } = updateInstance(instanceId, {
      autoSyncEnabled: enabled,
    });

    if (success && instance.isAuthenticated) {
      if (enabled) {
        startSyncInterval(instanceId);
      } else {
        stopSyncInterval(instanceId);
      }
    }

    return success;
  });
}

// ─── Authentication Handlers ────────────────────────────────────────

function registerAuthHandlers() {
  ipcMain.handle("get-google-auth-url", async () => {
    const credCheck = validateCredentials();
    if (!credCheck.valid) return { success: false, error: credCheck.error };

    try {
      const oauth2Client = createOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: OAUTH_SCOPES,
        prompt: "consent",
      });
      return { success: true, authUrl };
    } catch (error) {
      console.error("Error generating auth URL:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "authenticate-with-code",
    async (event, instanceId, authCode) => {
      const credCheck = validateCredentials();
      if (!credCheck.valid) return { success: false, error: credCheck.error };

      try {
        return await exchangeCodeAndSetup(instanceId, authCode);
      } catch (error) {
        console.error("Authentication error:", error);
        return {
          success: false,
          error: `Authentication failed: ${error.message}`,
        };
      }
    },
  );

  ipcMain.handle("authenticate-google", async (event, instanceId) => {
    const credCheck = validateCredentials();
    if (!credCheck.valid) return { success: false, error: credCheck.error };

    return new Promise((resolve) => {
      const oauth2Client = createOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: OAUTH_SCOPES,
        prompt: "consent",
      });

      let server;
      let serverTimeout;

      server = http.createServer(async (req, res) => {
        const queryObject = url.parse(req.url, true).query;

        if (queryObject.code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(getAuthSuccessHtml());
          clearTimeout(serverTimeout);

          try {
            const result = await exchangeCodeAndSetup(
              instanceId,
              queryObject.code,
            );
            server.close();
            resolve(result);
          } catch (error) {
            console.error("Token exchange error:", error);
            server.close();
            resolve({
              success: false,
              error: `Authentication failed: ${error.message}`,
            });
          }
        } else if (queryObject.error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(getAuthErrorHtml(queryObject.error));
          clearTimeout(serverTimeout);
          server.close();
          resolve({
            success: false,
            error: queryObject.error || "Authentication was denied",
          });
        }
      });

      server.on("error", (err) => {
        console.error("Server error:", err);
        clearTimeout(serverTimeout);
        resolve({
          success: false,
          error: `Failed to start local server: ${err.message}. Try manual authentication instead.`,
        });
      });

      serverTimeout = setTimeout(() => {
        server.close();
        resolve({
          success: false,
          error: "Authentication timeout. Please try manual authentication.",
        });
      }, 120000);

      server.listen(3000, (err) => {
        if (err) {
          clearTimeout(serverTimeout);
          resolve({
            success: false,
            error: `Failed to start authentication server: ${err.message}. Try manual authentication instead.`,
          });
        } else {
          console.log("Auth server started on port 3000");
          shell.openExternal(authUrl);
        }
      });
    });
  });

  ipcMain.handle("logout-google", async (event, instanceId) => {
    const { success } = updateInstance(instanceId, {
      isAuthenticated: false,
      tokens: null,
      userInfo: null,
      driveFolderId: null,
      currentFolderId: null,
      backupFolderId: null,
      backupLocalFolderId: null,
    });

    if (success) stopSyncInterval(instanceId);
    return success;
  });
}

/**
 * Shared logic: exchange auth code for tokens, get user info, create folders, start sync.
 */
async function exchangeCodeAndSetup(instanceId, authCode) {
  const oauth2Client = createOAuth2Client();

  console.log("Exchanging code for tokens...");
  const { tokens } = await oauth2Client.getToken(authCode);
  oauth2Client.setCredentials(tokens);

  console.log("Getting user info...");
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  console.log("User info received:", userInfo.data);

  // Update instance
  const { instance, index, instances } = findInstance(instanceId);
  if (instance) {
    instances[index].isAuthenticated = true;
    instances[index].tokens = tokens;
    instances[index].userInfo = userInfo.data;

    await createInstanceFolders(instances[index], oauth2Client);
    saveInstances(instances);

    console.log("Instance updated, starting sync interval...");
    if (instances[index].autoSyncEnabled !== false) {
      startSyncInterval(instanceId);
    }
  }

  return { success: true, userInfo: userInfo.data, tokens };
}

// ─── Sync Handlers ──────────────────────────────────────────────────

function registerSyncHandlers() {
  ipcMain.handle("sync-now", async (event, instanceId) => {
    return await syncWithDrive(instanceId, true);
  });

  ipcMain.handle("download-from-drive", async (event, instanceId, options) => {
    return await downloadFromDrive(instanceId, options);
  });

  ipcMain.handle("get-config", () => getConfig());
}

// ─── HTML templates for auth callback ────────────────────────────────

function getAuthSuccessHtml() {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Successful</title>
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f9ff;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #10b981; margin-bottom: 20px;">Authentication Successful!</h1>
          <p style="color: #6b7280; margin-bottom: 20px;">You can close this window and return to the application.</p>
          <div style="width: 40px; height: 40px; border: 3px solid #10b981; border-radius: 50%; margin: 20px auto;"></div>
        </div>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
    </html>
  `;
}

function getAuthErrorHtml(errorMessage) {
  return `
    <html>
      <head><title>Authentication Failed</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fef2f2;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #ef4444; margin-bottom: 20px;">✗ Authentication Failed</h1>
          <p style="color: #6b7280; margin-bottom: 10px;">Error: ${errorMessage}</p>
          <p style="color: #6b7280;">You can close this window and try again.</p>
        </div>
      </body>
    </html>
  `;
}

module.exports = setupIpcHandlers;
