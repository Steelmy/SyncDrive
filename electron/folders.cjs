const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');

const { google } = require('googleapis');
const archiver = require('archiver');

// Create instance, current and backup folders in Google Drive
async function createInstanceFolders(instance, oauth2Client) {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log(`Creating Drive folders for instance: ${instance.name}`);
    
    // 1. Create or find instance folder
    let instanceFolderId = instance.driveFolderId;
    if (!instanceFolderId) {
      console.log('Searching for existing instance folder...');
      const existingFolders = await drive.files.list({
        q: `name='${instance.name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });
      
      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        instanceFolderId = String(existingFolders.data.files[0].id);
        console.log(`Found existing instance folder: ${instanceFolderId}`);
      } else {
        console.log('Creating new instance folder...');
        const folderMetadata = {
          name: instance.name,
          mimeType: 'application/vnd.google-apps.folder',
        };
        
        const folder = await drive.files.create({
          resource: folderMetadata,
          fields: 'id',
        });
        
        instanceFolderId = String(folder.data.id);
        console.log(`Created instance folder: ${instanceFolderId}`);
      }
      
      instance.driveFolderId = String(instanceFolderId);
    }
    
    // 2. Create or find current folder
    let currentFolderId = instance.currentFolderId;
    if (!currentFolderId) {
      console.log('Searching for existing current folder...');
      const existingCurrentFolders = await drive.files.list({
        q: `name='current' and mimeType='application/vnd.google-apps.folder' and '${instanceFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
      });
      
      if (existingCurrentFolders.data.files && existingCurrentFolders.data.files.length > 0) {
        currentFolderId = String(existingCurrentFolders.data.files[0].id);
        console.log(`Found existing current folder: ${currentFolderId}`);
      } else {
        console.log('Creating new current folder...');
        const currentFolderMetadata = {
          name: 'current',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [instanceFolderId],
        };
        
        const currentFolder = await drive.files.create({
          resource: currentFolderMetadata,
          fields: 'id',
        });
        
        currentFolderId = String(currentFolder.data.id);
        console.log(`Created current folder: ${currentFolderId}`);
      }
      
      instance.currentFolderId = String(currentFolderId);
    }
    
    // 3. Create or find backup folder
    let backupFolderId = instance.backupFolderId;
    if (!backupFolderId) {
      console.log('Searching for existing backup folder...');
      const existingBackupFolders = await drive.files.list({
        q: `name='backup' and mimeType='application/vnd.google-apps.folder' and '${instanceFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
      });
      
      if (existingBackupFolders.data.files && existingBackupFolders.data.files.length > 0) {
        backupFolderId = String(existingBackupFolders.data.files[0].id);
        console.log(`Found existing backup folder: ${backupFolderId}`);
      } else {
        console.log('Creating new backup folder...');
        const backupFolderMetadata = {
          name: 'backup',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [instanceFolderId],
        };
        
        const backupFolder = await drive.files.create({
          resource: backupFolderMetadata,
          fields: 'id',
        });
        
        backupFolderId = String(backupFolder.data.id);
        console.log(`Created backup folder: ${backupFolderId}`);
      }
      
      instance.backupFolderId = String(backupFolderId);
    }
    
    // Save the updated instance configuration
    console.log(`Folders setup complete for instance: ${instance.name}`);
    console.log(`- Instance folder ID: ${instanceFolderId}`);
    console.log(`- Current folder ID: ${currentFolderId}`);
    console.log(`- Backup folder ID: ${backupFolderId}`);

  } catch (error) {
    console.error('Error creating instance folders:', error);
    throw error;
  }
}

// Manage backup files (keep only 20 most recent)
async function manageBackupFiles(drive, backupFolderId) {
  try {
    console.log('Managing backup files...');
    const backupFiles = await drive.files.list({
      q: `'${backupFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
    });
    
    const files = backupFiles.data.files || [];
    console.log(`Found ${files.length} backup files`);
    
    if (files.length > 20) {
      // Delete oldest files beyond the 20 most recent
      const filesToDelete = files.slice(20);
      console.log(`Deleting ${filesToDelete.length} old backup files`);
      
      for (const file of filesToDelete) {
        try {
          await drive.files.delete({ fileId: file.id });
          console.log(`Deleted old backup: ${file.name}`);
        } catch (deleteError) {
          console.error(`Failed to delete backup file ${file.name}:`, deleteError);
        }
      }
    }
  } catch (error) {
    console.error('Error managing backup files:', error);
  }
}

// Create ZIP file from directory
async function createZipFromDirectory(directoryPath, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    
    // Add directory contents to ZIP
    archive.directory(directoryPath, false);
    
    archive.finalize();
  });
}

module.exports = {
  createInstanceFolders,
  manageBackupFiles,
  createZipFromDirectory
}