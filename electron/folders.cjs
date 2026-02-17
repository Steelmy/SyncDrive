const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { google } = require("googleapis");

/**
 * Finds an existing folder or creates a new one in Google Drive.
 * @param {import('googleapis').drive_v3.Drive} drive
 * @param {string} name - Folder name
 * @param {string} [parentId] - Parent folder ID (optional, root if omitted)
 * @returns {Promise<string>} Folder ID
 */
async function findOrCreateFolder(drive, name, parentId) {
  const query = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
  });

  if (existing.data.files && existing.data.files.length > 0) {
    console.log(
      `Found existing folder '${name}': ${existing.data.files[0].id}`,
    );
    return String(existing.data.files[0].id);
  }

  console.log(`Creating new folder '${name}'...`);
  const metadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentId && { parents: [parentId] }),
  };

  const folder = await drive.files.create({
    resource: metadata,
    fields: "id",
  });

  const folderId = String(folder.data.id);
  console.log(`Created folder '${name}': ${folderId}`);
  return folderId;
}

/**
 * Creates instance, current, and backup folders in Google Drive.
 * @param {object} instance - Instance object (mutated with folder IDs)
 * @param {import('googleapis').Auth.OAuth2Client} oauth2Client
 */
async function createInstanceFolders(instance, oauth2Client) {
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    console.log(`Creating Drive folders for instance: ${instance.name}`);

    // 1. Instance folder (root level)
    if (!instance.driveFolderId) {
      instance.driveFolderId = await findOrCreateFolder(drive, instance.name);
    }

    // 2. Current folder (inside instance)
    if (!instance.currentFolderId) {
      instance.currentFolderId = await findOrCreateFolder(
        drive,
        "current",
        instance.driveFolderId,
      );
    }

    // 3. Backup folder (inside instance)
    if (!instance.backupFolderId) {
      instance.backupFolderId = await findOrCreateFolder(
        drive,
        "backup",
        instance.driveFolderId,
      );
    }

    console.log(`Folders setup complete for instance: ${instance.name}`);
    console.log(`- Instance: ${instance.driveFolderId}`);
    console.log(`- Current: ${instance.currentFolderId}`);
    console.log(`- Backup: ${instance.backupFolderId}`);
  } catch (error) {
    console.error("Error creating instance folders:", error);
    throw error;
  }
}

/**
 * Manages backup files, keeping only the 20 most recent.
 * @param {import('googleapis').drive_v3.Drive} drive
 * @param {string} backupFolderId
 */
async function manageBackupFiles(drive, backupFolderId) {
  try {
    const MAX_BACKUPS = 20;
    console.log("Managing backup files...");

    const backupFiles = await drive.files.list({
      q: `'${backupFolderId}' in parents and trashed=false`,
      fields: "files(id, name, createdTime)",
      orderBy: "createdTime desc",
    });

    const files = backupFiles.data.files || [];
    console.log(`Found ${files.length} backup files`);

    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      console.log(`Deleting ${filesToDelete.length} old backup files`);

      for (const file of filesToDelete) {
        try {
          await drive.files.delete({ fileId: file.id });
          console.log(`Deleted old backup: ${file.name}`);
        } catch (deleteError) {
          console.error(
            `Failed to delete backup file ${file.name}:`,
            deleteError,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error managing backup files:", error);
  }
}

/**
 * Creates a ZIP file from a directory.
 * @param {string} directoryPath
 * @param {string} outputPath
 * @returns {Promise<string>} The output path
 */
async function createZipFromDirectory(directoryPath, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);
      resolve(outputPath);
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.directory(directoryPath, false);
    archive.finalize();
  });
}

module.exports = {
  findOrCreateFolder,
  createInstanceFolders,
  manageBackupFiles,
  createZipFromDirectory,
};
