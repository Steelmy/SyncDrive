const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const archiver = require('archiver');
const store = require('./store.cjs');
const { DEFAULT_SYNC_INTERVAL, syncIntervals, startSyncInterval, syncWithDrive, stopSyncInterval } = require('./sync.cjs');
const { createInstanceFolders } = require('./folders.cjs');
const { downloadFromDrive } = require('./download.cjs');
const CREDENTIALS = require('./credentials.cjs');

function setupIpcHandlers() {
  // Handle creating new instance
  ipcMain.handle('create-instance', async (event, name) => {
    const instances = store.get('instances') || [];
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
      zipMode: false, // Default to individual files mode
      autoSyncEnabled: true, // Default to enabled
      driveFolderId: null, // Will be created when authenticated
      currentFolderId: null, // Will be created when authenticated
      backupFolderId: null, // Will be created when authenticated
      backupLocalFolderId: null, // Will be created when needed
      downloadPath: null, // Download destination path
      downloadUnzip: true, // Default to unzip files
      downloadReplace: false // Default to not replace files
    };
    
    instances.push(newInstance);
    store.set('instances', instances);
    store.set('currentInstanceId', newInstance.id);
    
    return newInstance;
  });

  // Handle switching instance
  ipcMain.handle('switch-instance', async (event, instanceId) => {
    store.set('currentInstanceId', instanceId);
    return true;
  });

  // Handle deleting instance
  ipcMain.handle('delete-instance', async (event, instanceId) => {
    const instances = store.get('instances') || [];
    const filteredInstances = instances.filter(instance => instance.id !== instanceId);
    store.set('instances', filteredInstances);
    
    // Clear sync interval for deleted instance
    stopSyncInterval(instanceId);
    
    // If current instance was deleted, switch to first available
    const currentInstanceId = store.get('currentInstanceId');
    if (currentInstanceId === instanceId && filteredInstances.length > 0) {
      store.set('currentInstanceId', filteredInstances[0].id);
    }
    
    return filteredInstances;
  });

  // Handle renaming instance
  ipcMain.handle('rename-instance', async (event, instanceId, newName) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1 && newName.trim()) {
      instances[instanceIndex].name = newName.trim();
      store.set('instances', instances);
      return true;
    }
    return false;
  });

  // Handle directory selection
  ipcMain.handle('select-directory', async (event, instanceId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    
    if (!result.canceled) {
      const selectedDirectory = result.filePaths[0];
      const instances = store.get('instances') || [];
      const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
      
      if (instanceIndex !== -1) {
        instances[instanceIndex].rootDirectory = selectedDirectory;
        store.set('instances', instances);
        return selectedDirectory;
      }
    }
    return null;
  });

  // Handle manual directory path update
  ipcMain.handle('update-directory-path', async (event, instanceId, newPath) => {
    try {
      // Verify the path exists
      if (!fs.existsSync(newPath)) {
        return { success: false, error: 'Path does not exist' };
      }
      
      // Verify it's a directory
      const stats = fs.statSync(newPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Path is not a directory' };
      }
      
      const instances = store.get('instances') || [];
      const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
      
      if (instanceIndex !== -1) {
        instances[instanceIndex].rootDirectory = newPath;
        store.set('instances', instances);
        return { success: true, path: newPath };
      }
      
      return { success: false, error: 'Instance not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle download directory selection
  ipcMain.handle('select-download-directory', async (event, instanceId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    
    if (!result.canceled) {
      const selectedDirectory = result.filePaths[0];
      const instances = store.get('instances') || [];
      const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
      
      if (instanceIndex !== -1) {
        instances[instanceIndex].downloadPath = selectedDirectory;
        store.set('instances', instances);
        return selectedDirectory;
      }
    }
    return null;
  });

  // Handle download settings update
  ipcMain.handle('update-download-settings', async (event, instanceId, settings) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      if (settings.downloadPath !== undefined) {
        instances[instanceIndex].downloadPath = settings.downloadPath;
      }
      if (settings.downloadUnzip !== undefined) {
        instances[instanceIndex].downloadUnzip = settings.downloadUnzip;
      }
      if (settings.downloadReplace !== undefined) {
        instances[instanceIndex].downloadReplace = settings.downloadReplace;
      }
      
      store.set('instances', instances);
      return true;
    }
    return false;
  });

  // Handle download from Drive
  ipcMain.handle('download-from-drive', async (event, instanceId, options) => {
    return await downloadFromDrive(instanceId, options);
  });

  // Handle sync interval update
  ipcMain.handle('update-sync-interval', async (event, instanceId, intervalMinutes) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      const intervalMs = intervalMinutes * 60 * 1000;
      instances[instanceIndex].syncInterval = intervalMs;
      store.set('instances', instances);
      
      // Restart sync interval with new timing if auto-sync is enabled
      if (instances[instanceIndex].isAuthenticated && instances[instanceIndex].autoSyncEnabled !== false) {
        // Clear existing interval
        stopSyncInterval(instanceId);
        // Start new interval with updated timing
        startSyncInterval(instanceId);
      }
      
      return true;
    }
    return false;
  });

  // Handle ZIP mode update
  ipcMain.handle('update-zip-mode', async (event, instanceId, zipMode) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      instances[instanceIndex].zipMode = zipMode;
      store.set('instances', instances);
      return true;
    }
    return false;
  });

  // Handle auto-sync toggle
  ipcMain.handle('update-auto-sync', async (event, instanceId, enabled) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      instances[instanceIndex].autoSyncEnabled = enabled;
      store.set('instances', instances);
      
      // Start or stop sync interval based on the setting
      if (instances[instanceIndex].isAuthenticated) {
        if (enabled) {
          startSyncInterval(instanceId);
        } else {
          stopSyncInterval(instanceId);
        }
      }
      
      return true;
    }
    return false;
  });

  // Handle getting Google auth URL
  ipcMain.handle('get-google-auth-url', async (event, instanceId) => {
    try {
      // Check if credentials are configured
      if (CREDENTIALS.client_id === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        return { 
          success: false, 
          error: 'Google Drive API credentials not configured. Please set up your client_id and client_secret in electron/main.cjs' 
        };
      }

      const oauth2Client = new google.auth.OAuth2(
        CREDENTIALS.client_id,
        CREDENTIALS.client_secret,
        CREDENTIALS.redirect_uris[0]
      );

      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });

      return { success: true, authUrl };
    } catch (error) {
      console.error('Error generating auth URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle manual code authentication
  ipcMain.handle('authenticate-with-code', async (event, instanceId, authCode) => {
    try {
      // Check if credentials are configured
      if (CREDENTIALS.client_id === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        return { 
          success: false, 
          error: 'Google Drive API credentials not configured. Please set up your client_id and client_secret in electron/main.cjs' 
        };
      }

      const oauth2Client = new google.auth.OAuth2(
        CREDENTIALS.client_id,
        CREDENTIALS.client_secret,
        CREDENTIALS.redirect_uris[0]
      );

      console.log('Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(authCode);
      oauth2Client.setCredentials(tokens);
      
      console.log('Getting user info...');
      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      console.log('User info received:', userInfo.data);
      
      // Update instance with authentication data
      const instances = store.get('instances') || [];
      const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
      
      if (instanceIndex !== -1) {
        instances[instanceIndex].isAuthenticated = true;
        instances[instanceIndex].tokens = tokens;
        instances[instanceIndex].userInfo = userInfo.data;
        
        // Create Drive folders for this instance
        await createInstanceFolders(instances[instanceIndex], oauth2Client);
        store.set('instances', instances);
        
        console.log('Instance updated, starting sync interval...');
        // Start sync interval if auto-sync is enabled
        if (instances[instanceIndex].autoSyncEnabled !== false) {
          startSyncInterval(instanceId);
        }
      }
      
      return {
        success: true,
        userInfo: userInfo.data,
        tokens: tokens
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: `Authentication failed: ${error.message}`
      };
    }
  });

  // Handle Google authentication with automatic callback
  ipcMain.handle('authenticate-google', async (event, instanceId) => {
    return new Promise((resolve) => {
      // Check if credentials are configured
      if (CREDENTIALS.client_id === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        resolve({ 
          success: false, 
          error: 'Google Drive API credentials not configured. Please set up your client_id and client_secret in electron/main.cjs' 
        });
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        CREDENTIALS.client_id,
        CREDENTIALS.client_secret,
        CREDENTIALS.redirect_uris[0]
      );

      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });

      let server;
      let serverTimeout;

      // Create a local server to handle the callback
      server = http.createServer(async (req, res) => {
        const queryObject = url.parse(req.url, true).query;
        
        if (queryObject.code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
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
          `);
          
          clearTimeout(serverTimeout);
          
          try {
            console.log('Received auth code, exchanging for tokens...');
            const { tokens } = await oauth2Client.getToken(queryObject.code);
            oauth2Client.setCredentials(tokens);
            
            console.log('Getting user info...');
            // Get user info
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            
            console.log('User info received:', userInfo.data);
            
            // Update instance with authentication data
            const instances = store.get('instances') || [];
            const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
            
            if (instanceIndex !== -1) {
              instances[instanceIndex].isAuthenticated = true;
              instances[instanceIndex].tokens = tokens;
              instances[instanceIndex].userInfo = userInfo.data;
              
              // Create Drive folders for this instance
              await createInstanceFolders(instances[instanceIndex], oauth2Client);
              store.set('instances', instances);

              console.log('Instance updated, starting sync interval...');
              // Start sync interval if auto-sync is enabled
              if (instances[instanceIndex].autoSyncEnabled !== false) {
                startSyncInterval(instanceId);
              }
            }
            
            server.close();
            resolve({
              success: true,
              userInfo: userInfo.data,
              tokens: tokens
            });
          } catch (error) {
            console.error('Token exchange error:', error);
            server.close();
            resolve({
              success: false,
              error: `Authentication failed: ${error.message}`
            });
          }
        } else if (queryObject.error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fef2f2;">
                <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <h1 style="color: #ef4444; margin-bottom: 20px;">✗ Authentication Failed</h1>
                  <p style="color: #6b7280; margin-bottom: 10px;">Error: ${queryObject.error}</p>
                  <p style="color: #6b7280;">You can close this window and try again.</p>
                </div>
              </body>
            </html>
          `);
          clearTimeout(serverTimeout);
          server.close();
          resolve({
            success: false,
            error: queryObject.error || 'Authentication was denied'
          });
        }
      });

      server.on('error', (err) => {
        console.error('Server error:', err);
        clearTimeout(serverTimeout);
        resolve({
          success: false,
          error: `Failed to start local server: ${err.message}. Try manual authentication instead.`
        });
      });

      // Set a timeout for the server
      serverTimeout = setTimeout(() => {
        server.close();
        resolve({
          success: false,
          error: 'Authentication timeout. Please try manual authentication.'
        });
      }, 120000); // 2 minutes timeout

      server.listen(3000, (err) => {
        if (err) {
          clearTimeout(serverTimeout);
          resolve({
            success: false,
            error: `Failed to start authentication server: ${err.message}. Try manual authentication instead.`
          });
        } else {
          console.log('Auth server started on port 3000');
          shell.openExternal(authUrl);
        }
      });
    });
  });

  // Handle Google logout
  ipcMain.handle('logout-google', async (event, instanceId) => {
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      instances[instanceIndex].isAuthenticated = false;
      instances[instanceIndex].tokens = null;
      instances[instanceIndex].userInfo = null;
      instances[instanceIndex].driveFolderId = null;
      instances[instanceIndex].currentFolderId = null;
      instances[instanceIndex].backupFolderId = null;
      instances[instanceIndex].backupLocalFolderId = null;
      store.set('instances', instances);
      
      // Clear sync interval
      stopSyncInterval(instanceId);
      
      return true;
    }
    return false;
  });

  // Handle manual sync request
  ipcMain.handle('sync-now', async (event, instanceId) => {
    return await syncWithDrive(instanceId);
  });

  // Handle request for current config
  ipcMain.handle('get-config', () => {
    const instances = store.get('instances') || [];
    const currentInstanceId = store.get('currentInstanceId');
    
    return {
      instances,
      currentInstanceId,
      hasCompletedSetup: instances.length > 0,
    };
  });
}

module.exports = setupIpcHandlers;