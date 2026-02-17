const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const { google } = require('googleapis');
const archiver = require('archiver');
const extract = require('extract-zip');
const store = require('./store.cjs');
const { manageBackupFiles, createZipFromDirectory } = require('./folders.cjs');
const CREDENTIALS = require('./credentials.cjs');

// Download files from Google Drive current folder
async function downloadFromDrive(instanceId, options = {}) {
  const instances = store.get('instances') || [];
  const instanceIndex = instances.findIndex(instance => instance.id === instanceId);
  
  if (instanceIndex === -1) {
    return { success: false, message: 'Instance not found' };
  }
  
  const instance = instances[instanceIndex];
  
  if (!instance.isAuthenticated || !instance.tokens) {
    return { success: false, message: 'Not authenticated with Google Drive' };
  }

  if (!instance.currentFolderId) {
    return { success: false, message: 'Drive folders not configured properly' };
  }

  try {
    console.log(`Starting download for instance ${instanceId}...`);
    
    const oauth2Client = new google.auth.OAuth2(
      CREDENTIALS.client_id,
      CREDENTIALS.client_secret,
      CREDENTIALS.redirect_uris[0]
    );
    
    oauth2Client.setCredentials(instance.tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get files from current folder
    const driveFiles = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime, mimeType)',
      orderBy: 'modifiedTime desc',
    });
    
    const files = driveFiles.data.files || [];
    
    if (files.length === 0) {
      return { success: false, message: 'No files found in current folder' };
    }
    
    // Check if local files are newer (if replace option is enabled and destination exists)
    if (options.replaceFiles && options.downloadPath && instance.rootDirectory) {
      const localModified = getDirectoryLastModified(instance.rootDirectory);
      const driveModified = new Date(Math.max(...files.map(f => new Date(f.modifiedTime).getTime())));
      
      if (localModified > driveModified) {
        return { 
          success: false, 
          message: 'Your local files are newer than the Drive version. Download cancelled to prevent data loss.',
          isNewerLocal: true
        };
      }
    }
    
    let downloadResults = [];
    const folderName = path.basename(instance.rootDirectory || instance.name);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // Case 1: Single ZIP file in current folder
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
      const zipFile = files[0];
      console.log(`Single ZIP file detected: ${zipFile.name}`);
      
      try {
        // Download the ZIP file directly
        const response = await drive.files.get({
          fileId: zipFile.id,
          alt: 'media',
        });
        
        const zipFileName = zipFile.name;
        const zipPath = path.join(options.downloadPath, zipFileName);
        
        // Convert response data to Buffer and write
        const buffer = Buffer.from(await response.data.arrayBuffer());
        fs.writeFileSync(zipPath, buffer);
        
        downloadResults.push({
          action: 'download',
          message: `Downloaded ${zipFileName}`,
          filePath: zipFileName
        });
        
        // Handle unzip option for single ZIP
        if (options.unzipFiles) {
          const extractPath = path.join(options.downloadPath);
          
          // Handle replace files option
          if (options.replaceFiles && fs.existsSync(extractPath)) {
            // Create backup of existing files
            await createLocalBackup(instance, extractPath, oauth2Client);
            downloadResults.push({
              action: 'backup',
              message: `Created local backup before replacement`,
              filePath: extractPath
            });
            
            // Remove existing directory
            fs.rmSync(extractPath, { recursive: true, force: true });
          }
          
          // Extract ZIP directly to destination
          await extract(zipPath, { dir: extractPath });
          
          downloadResults.push({
            action: 'extract',
            message: `Extracted files to ${extractPath}`,
            filePath: extractPath
          });
          
          // Remove ZIP file after extraction
          fs.unlinkSync(zipPath);
        }
        
      } catch (fileError) {
        console.error(`Failed to download ${zipFile.name}:`, fileError);
        downloadResults.push({
          action: 'error',
          message: `Failed to download ${zipFile.name}: ${fileError.message}`,
          filePath: zipFile.name
        });
      }
    } 
    // Case 2: Multiple files - need temporary directory
    else {
      console.log(`Multiple files detected: ${files.length} files`);
      
      // Create temporary directory for download
      const tempDir = path.join(require('os').tmpdir(), `download-${instanceId}-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        // Download all files to temp directory
        for (const file of files) {
          try {
            console.log(`Downloading ${file.name}...`);
            const response = await drive.files.get({
              fileId: file.id,
              alt: 'media',
            });
            
            const filePath = path.join(tempDir, file.name);
            const buffer = Buffer.from(await response.data.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            
            downloadResults.push({
              action: 'download',
              message: `Downloaded ${file.name}`,
              filePath: file.name
            });
            
          } catch (fileError) {
            console.error(`Failed to download ${file.name}:`, fileError);
            downloadResults.push({
              action: 'error',
              message: `Failed to download ${file.name}: ${fileError.message}`,
              filePath: file.name
            });
          }
        }
        
        // Create ZIP file from temp directory
        const zipFileName = `${folderName}_download_${timestamp}.zip`;
        const zipPath = path.join(options.downloadPath, zipFileName);
        
        await createZipFromDirectory(tempDir, zipPath);
        
        downloadResults.push({
          action: 'zip',
          message: `Created ZIP: ${zipFileName}`,
          filePath: zipPath
        });
        
        // Handle unzip option for multiple files
        if (options.unzipFiles) {
          const extractPath = path.join(options.downloadPath);
          
          // Handle replace files option
          if (options.replaceFiles && fs.existsSync(extractPath)) {
            // Create backup of existing files
            await createLocalBackup(instance, extractPath, oauth2Client);
            downloadResults.push({
              action: 'backup',
              message: `Created local backup before replacement`,
              filePath: extractPath
            });
            
            // Remove existing directory
            fs.rmSync(extractPath, { recursive: true, force: true });
          }
          
          // Move files directly from temp to destination (not in a subfolder)
          const tempItems = fs.readdirSync(tempDir);
          for (const item of tempItems) {
            const sourcePath = path.join(tempDir, item);
            const destPath = path.join(extractPath, item);
            
            if (fs.statSync(sourcePath).isDirectory()) {
              // Copy directory recursively
              copyDirectoryRecursive(sourcePath, destPath);
            } else {
              // Copy file
              fs.copyFileSync(sourcePath, destPath);
            }
          }
          
          downloadResults.push({
            action: 'extract',
            message: `Extracted files to ${extractPath}`,
            filePath: extractPath
          });
          
          // Remove ZIP file after extraction
          fs.unlinkSync(zipPath);
        }
        
      } finally {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    }
    
    // Update instance download settings if first time
    if (!instance.downloadPath) {
      instances[instanceIndex].downloadPath = options.downloadPath;
      instances[instanceIndex].downloadUnzip = options.unzipFiles;
      instances[instanceIndex].downloadReplace = options.replaceFiles;
      store.set('instances', instances);
    }
    
    console.log(`Download completed for instance ${instanceId}`);
    
    return {
      success: true,
      message: `Download completed: ${downloadResults.length} operation(s)`,
      results: downloadResults,
      zipPath: options.unzipFiles ? null : (downloadResults.find(r => r.action === 'zip')?.filePath || null)
    };
    
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, message: error.message };
  }
}

// Copy directory recursively
function copyDirectoryRecursive(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectoryRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

// Create local backup before replacing files
async function createLocalBackup(instance, targetPath, oauth2Client) {
  try {
    if (!fs.existsSync(targetPath)) {
      return;
    }
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Create backup-local folder in Drive if it doesn't exist
    let backupLocalFolderId = instance.backupLocalFolderId;
    if (!backupLocalFolderId) {
      console.log('Creating backup-local folder...');
      const backupLocalFolderMetadata = {
        name: 'backup-local',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [instance.driveFolderId],
      };
      
      const backupLocalFolder = await drive.files.create({
        resource: backupLocalFolderMetadata,
        fields: 'id',
      });
      
      backupLocalFolderId = String(backupLocalFolder.data.id);
      
      // Update instance
      const instances = store.get('instances') || [];
      const instanceIndex = instances.findIndex(inst => inst.id === instance.id);
      if (instanceIndex !== -1) {
        instances[instanceIndex].backupLocalFolderId = backupLocalFolderId;
        store.set('instances', instances);
      }
    }
    
    // Create backup ZIP
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const folderName = path.basename(targetPath);
    const backupZipName = `backup-local-${timestamp}-${folderName}.zip`;
    const tempBackupZipPath = path.join(require('os').tmpdir(), backupZipName);
    
    await createZipFromDirectory(targetPath, tempBackupZipPath);
    
    // Upload backup ZIP to backup-local folder
    const backupFileMetadata = { 
      name: backupZipName,
      parents: [backupLocalFolderId]
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
    
    console.log(`Created local backup: ${backupZipName}`);
    
    // Clean up temp file
    if (fs.existsSync(tempBackupZipPath)) {
      fs.unlinkSync(tempBackupZipPath);
    }
    
    // Manage backup files (keep only 20 most recent)
    await manageBackupFiles(drive, backupLocalFolderId);
    
  } catch (error) {
    console.error('Error creating local backup:', error);
    throw error;
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
  
  if (fs.existsSync(dirPath)) {
    checkDirectory(dirPath);
  }
  
  return latestTime;
}

module.exports = {
  downloadFromDrive
};