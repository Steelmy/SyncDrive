const fs = require('fs');
const util = require('util');
const path = require('path');
const readdir = util.promisify(fs.readdir);
const lstat = util.promisify(fs.lstat);
const rm = util.promisify(fs.rm ? fs.rm : fs.rmdir);
const unlink = util.promisify(fs.unlink);
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { google } = require('googleapis');
const store = require('./store.cjs');
const { manageBackupFiles, createZipFromDirectory } = require('./folders.cjs');
const CREDENTIALS = require('./credentials.cjs');

let mainWindow;
let syncIntervals = new Map(); // Map to store intervals for each instance
const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let isSyncing = new Map(); // Map to track sync status for each instance

function startSyncInterval(instanceId) {
  // Clear existing interval if any
  stopSyncInterval(instanceId);
  
  const instances = store.get('instances') || [];
  const instance = instances.find(inst => inst.id === instanceId);
  
  if (!instance || !instance.isAuthenticated || instance.autoSyncEnabled === false) {
    return;
  }
  
  console.log(`Starting sync interval for instance ${instanceId} with interval ${instance.syncInterval}ms`);
  
  // Run an immediate sync
  syncWithDrive(instanceId);
  
  // Set up the interval
  const interval = setInterval(() => syncWithDrive(instanceId), instance.syncInterval);
  syncIntervals.set(instanceId, interval);
}

function stopSyncInterval(instanceId) {
  if (syncIntervals.has(instanceId)) {
    clearInterval(syncIntervals.get(instanceId));
    syncIntervals.delete(instanceId);
    console.log(`Stopped sync interval for instance ${instanceId}`);
  }
}

async function syncWithDrive(instanceId, isManual = false) {
  // Vérifier si une synchronisation est déjà en cours pour cette instance
  if (isSyncing.get(instanceId)) {
    if (isManual) {
      console.log(`Une synchronisation est déjà en cours pour l'instance ${instanceId}`);
      return { success: false, message: 'Une synchronisation est déjà en cours' };
    }
    return; // Ne rien faire si c'est une synchronisation automatique
  }

  // Marquer la synchronisation comme en cours
  isSyncing.set(instanceId, true);
  
  const instances = store.get('instances') || [];
  const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
  
  try {
    if (instanceIndex === -1) {
      return { success: false, message: 'Instance not found' };
    }
    
    const instance = instances[instanceIndex];
    
    if (!instance.rootDirectory) {
      return { success: false, message: 'No root directory configured' };
    }
    
    if (!instance.isAuthenticated || !instance.tokens) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    if (!instance.currentFolderId || !instance.backupFolderId) {
      return { success: false, message: 'Drive folders not configured properly' };
    }

    console.log(`Starting sync for instance ${instanceId} (ZIP mode: ${instance.zipMode})...`);
    
    const oauth2Client = new google.auth.OAuth2(
      CREDENTIALS.client_id,
      CREDENTIALS.client_secret,
      CREDENTIALS.redirect_uris[0]
    );
    
    oauth2Client.setCredentials(instance.tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    let syncResults = [];
    
    // Créer un backup des fichiers actuels dans "current" avant la sync
    await createCurrentBackup(drive, instance, syncResults);
    await deleteFilesInCurrent(drive, instance);
    console.log('Backup créé et fichiers supprimés.');

    if (instance.zipMode) {
      // ZIP MODE: Create and upload ZIP file with timestamp to current folder
      const folderName = path.basename(instance.rootDirectory);
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
      const zipFileName = `${folderName}_${timestamp}.zip`;
      const tempZipPath = path.join(require('os').tmpdir(), zipFileName);
      
      try {
        // Create ZIP file
        console.log('Creating ZIP file...');
        await createZipFromDirectory(instance.rootDirectory, tempZipPath);
        
        // Check for existing ZIP files in the current folder
        const driveFiles = await drive.files.list({
          q: `'${instance.currentFolderId}' in parents and name contains '${folderName}_' and name contains '.zip' and trashed=false`,
          fields: 'files(id, name, modifiedTime)',
          orderBy: 'modifiedTime desc',
        });
        
        const zipStats = fs.statSync(tempZipPath);
        const localModified = new Date(zipStats.mtime);
        
        // Check if we need to backup existing file
        if (driveFiles.data.files && driveFiles.data.files.length > 0) {
          const existingFile = driveFiles.data.files[0];
          const driveModified = new Date(existingFile.modifiedTime);
          
          // Check if local directory has been modified since last ZIP upload
          const directoryStats = getDirectoryLastModified(instance.rootDirectory);
          
          if (directoryStats > driveModified) {
            // Create backup ZIP with timestamp
            const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFileName = `backup-${backupTimestamp}-${existingFile.name}`;
            
            console.log(`Moving ${existingFile.name} to backup folder as ${backupFileName}`);
            await drive.files.update({
              fileId: existingFile.id,
              resource: {
                name: backupFileName,
                parents: [instance.backupFolderId],
              },
              removeParents: instance.currentFolderId,
              addParents: instance.backupFolderId,
            });
            
            syncResults.push({
              action: 'backup',
              message: `Moved ${existingFile.name} to backup as ${backupFileName}`,
              filePath: existingFile.name
            });
            
            console.log(`Moved ${existingFile.name} to backup folder`);
            
            // Upload new ZIP file to current folder
            const fileMetadata = { 
              name: zipFileName,
              parents: [instance.currentFolderId]
            };
            const media = {
              mimeType: 'application/zip',
              body: fs.createReadStream(tempZipPath),
            };
            
            await drive.files.create({
              resource: fileMetadata,
              media: media,
              fields: 'id',
            });
            
            syncResults.push({
              action: 'upload',
              message: `Uploaded new ZIP: ${zipFileName}`,
              filePath: tempZipPath
            });
            
            console.log(`Uploaded new ZIP: ${zipFileName}`);
            
            // Manage backup files (keep only 20 most recent)
            await manageBackupFiles(drive, instance.backupFolderId);
            
          } else {
            syncResults.push({
              action: 'none',
              message: `ZIP is up to date: ${existingFile.name}`,
              filePath: tempZipPath
            });
          }
        } else {
          // No existing ZIP, upload new one to current folder
          const fileMetadata = { 
            name: zipFileName,
            parents: [instance.currentFolderId]
          };
          const media = {
            mimeType: 'application/zip',
            body: fs.createReadStream(tempZipPath),
          };
          
          await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
          });
          
          syncResults.push({
            action: 'upload',
            message: `Uploaded ZIP: ${zipFileName}`,
            filePath: tempZipPath
          });
          
          console.log(`Uploaded ZIP: ${zipFileName}`);
        }
        
        // Clean up temporary ZIP file
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
        
      } catch (zipError) {
        console.error('Error creating/uploading ZIP:', zipError);
        syncResults.push({
          action: 'error',
          message: `Error creating ZIP: ${zipError.message}`,
          filePath: instance.rootDirectory
        });
        
        // Clean up temporary file if it exists
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
      }
      
    } else {
      // INDIVIDUAL FILES MODE: Enhanced with backup system using current folder
      const localFiles = getAllFilesRecursively(instance.rootDirectory);
      console.log(`Found ${localFiles.length} local files to sync`);
      
      // (Backup ZIP creation supprimée ici, car gérée par createCurrentBackup)
      // On suppose que createCurrentBackup a déjà été appelée avant toute modification destructive du dossier current.
      
      // Continue with individual file sync
      for (const localFile of localFiles) {
        const relativePath = path.relative(instance.rootDirectory, localFile);
        const fileName = path.basename(localFile);
        
        try {
          // Check if file exists in current folder
          const driveFiles = await drive.files.list({
            q: `'${instance.currentFolderId}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
          });
          
          const localStats = fs.statSync(localFile);
          const localModified = new Date(localStats.mtime);
          
          if (!driveFiles.data.files || driveFiles.data.files.length === 0) {
            // File doesn't exist on Drive, upload it to current folder
            const fileMetadata = { 
              name: fileName,
              parents: [instance.currentFolderId]
            };
            const media = {
              mimeType: 'application/octet-stream',
              body: fs.createReadStream(localFile),
            };
            
            await drive.files.create({
              resource: fileMetadata,
              media: media,
              fields: 'id',
            });
            
            syncResults.push({
              action: 'upload',
              message: `Uploaded ${fileName}`,
              filePath: localFile
            });
            
            console.log(`Uploaded: ${fileName}`);
          } else {
            // File exists, check modification times
            const driveFile = driveFiles.data.files[0];
            const driveModified = new Date(driveFile.modifiedTime);
            
            if (localModified > driveModified) {
              // Update the original file in current folder
              const media = {
                mimeType: 'application/octet-stream',
                body: fs.createReadStream(localFile),
              };
              await drive.files.update({
                fileId: driveFile.id,
                media: media,
              });
              syncResults.push({
                action: 'upload',
                message: `Updated ${fileName} on Drive`,
                filePath: localFile
              });
              console.log(`Updated: ${fileName} (backup created)`);
              
            } else if (driveModified > localModified) {
              // Drive file is newer, download it
              const response = await drive.files.get({
                fileId: driveFile.id,
                alt: 'media',
              });
              
              let dataToWrite = response.data;
              if (typeof response.data?.arrayBuffer === 'function') {
                dataToWrite = Buffer.from(await response.data.arrayBuffer());
              }
              fs.writeFileSync(localFile, dataToWrite);
              
              syncResults.push({
                action: 'download',
                message: `Downloaded ${fileName} from Drive`,
                filePath: localFile
              });
              
              console.log(`Downloaded: ${fileName}`);
            } else {
              syncResults.push({
                action: 'none',
                message: `${fileName} is in sync`,
                filePath: localFile
              });
            }
          }
        } catch (fileError) {
          console.error(`Error syncing ${fileName}:`, fileError);
          syncResults.push({
            action: 'error',
            message: `Error syncing ${fileName}: ${fileError.message}`,
            filePath: localFile
          });
        }
      }
    }
    
    // Update instance with sync results
    const syncRecord = {
      timestamp: new Date().toISOString(),
      results: syncResults,
      success: true,
      message: instance.zipMode 
        ? `ZIP sync completed: ${syncResults.length} operation(s)`
        : `File sync completed: ${syncResults.length} file(s) processed`
    };
    
    instances[instanceIndex].syncHistory = instances[instanceIndex].syncHistory || [];
    instances[instanceIndex].syncHistory.unshift(syncRecord);
    instances[instanceIndex].syncHistory = instances[instanceIndex].syncHistory.slice(0, 10);
    instances[instanceIndex].lastSyncTime = new Date().toISOString();
    
    store.set('instances', instances);
    
    console.log(`Sync completed for instance ${instanceId}: ${syncRecord.message}`);
    
    // Notify the renderer
    if (mainWindow) {
      mainWindow.webContents.send('sync-completed', {
        instanceId,
        success: true,
        message: syncRecord.message,
        history: instances[instanceIndex].syncHistory
      });
    }
    
    return {
      success: true,
      message: 'Synchronisation terminée',
      results: syncResults
    };
  } catch (error) {
    console.error('Sync error:', error);
    
    // Record the error in history
    const errorRecord = {
      timestamp: new Date().toISOString(),
      results: [],
      success: false,
      message: error.message
    };
    
    const instances = store.get('instances') || [];
    const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
    
    if (instanceIndex !== -1) {
      instances[instanceIndex].syncHistory = instances[instanceIndex].syncHistory || [];
      instances[instanceIndex].syncHistory.unshift(errorRecord);
      instances[instanceIndex].syncHistory = instances[instanceIndex].syncHistory.slice(0, 10);
      store.set('instances', instances);
    }
    
    // Notify the renderer
    if (mainWindow) {
      mainWindow.webContents.send('sync-completed', {
        instanceId,
        success: false,
        message: error.message,
        history: instances[instanceIndex]?.syncHistory || []
      });
    }
    
    return { success: false, message: error.message };
  } finally {
    // Libérer le verrou de synchronisation
    isSyncing.set(instanceId, false);
  }
}

async function deleteFilesInCurrent(drive, instance) {
  try {
    const response = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
    });
    const files = response.data.files || [];

    if (files.length === 0) {
      console.log('No files in current folder to delete on Drive');
      return;
    }

    for (const file of files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`Deleted file from Drive: ${file.name}`);
    }
    console.log('All files deleted from current Drive folder:', instance.currentFolderId);
  } catch (error) {
    console.error('Error deleting files in current Drive folder:', error);
  }
}

async function createCurrentBackup(drive, instance, syncResults) {
  try {
    console.log('Creating backup of current files before sync...');
    
    // Get all files from current folder
    const currentFiles = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
    });
    
    // Exclure les fichiers de backup (backup-*.zip) pour éviter la récursivité
    const files = (currentFiles.data.files || []).filter(file => !/^backup-.*\.zip$/.test(file.name));
    
    if (files.length === 0) {
      console.log('No files in current folder to backup');
      return;
    }
    
    // Create backup with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupZipName = `backup-${timestamp}.zip`;
    const tempBackupZipPath = path.join(require('os').tmpdir(), backupZipName);
    
    // Create temporary directory to download current files
    const tempDir = path.join(require('os').tmpdir(), `current-backup-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    try {
      // Download all current files
      for (const file of files) {
        try {
          const response = await drive.files.get({
            fileId: file.id,
            alt: 'media',
          });
          
          const filePath = path.join(tempDir, file.name);
          const buffer = Buffer.from(await response.data.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          
        } catch (downloadError) {
          console.error(`Failed to download ${file.name} for backup:`, downloadError);
        }
      }
      
      // Create ZIP from downloaded files
      await createZipFromDirectory(tempDir, tempBackupZipPath);
      
      // Upload backup ZIP to backup folder
      const backupFileMetadata = { 
        name: backupZipName,
        parents: [instance.backupFolderId]
      };
      const backupMedia = {
        mimeType: 'application/zip',
        body: fs.createReadStream(tempBackupZipPath),
      };
      
      await drive.files.create({
        resource: backupFileMetadata,
        media: backupMedia,
        fields: 'id',
      });
      
      syncResults.push({
        action: 'backup',
        message: `Created pre-sync backup: ${backupZipName}`,
        filePath: tempBackupZipPath
      });
      
      console.log(`Created pre-sync backup: ${backupZipName}`);
      
      // Manage backup files (keep only 20 most recent)
      await manageBackupFiles(drive, instance.backupFolderId);
      
    } finally {
      // Clean up temporary files
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      if (fs.existsSync(tempBackupZipPath)) {
        fs.unlinkSync(tempBackupZipPath);
      }
    }
    
  } catch (error) {
    console.error('Error creating current backup:', error);
    syncResults.push({
      action: 'error',
      message: `Error creating pre-sync backup: ${error.message}`,
      filePath: 'current folder'
    });
  }
}

// Get the most recent modification time in a directory
function getDirectoryLastModified(dirPath) {
  let latestTime = new Date(0);
  
  function checkDirectory(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.mtime > latestTime) {
          latestTime = stats.mtime;
        }
        
        if (stats.isDirectory()) {
          checkDirectory(fullPath);
        }
      }
    } catch (error) {
      console.error('Error checking directory:', error);
    }
  }
  
  checkDirectory(dirPath);
  return latestTime;
}

function getAllFilesRecursively(dirPath) {
  let files = [];

  // Fichiers à ignorer
  const ignoredFiles = ['.DS_Store', 'desktop.ini'];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      if (ignoredFiles.includes(item)) continue;
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files = files.concat(getAllFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }

  return files;
}

module.exports = { DEFAULT_SYNC_INTERVAL, syncIntervals, startSyncInterval, stopSyncInterval, syncWithDrive };