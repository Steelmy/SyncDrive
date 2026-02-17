const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const extract = require("extract-zip");

const { createOAuth2Client } = require("./utils/oauth.cjs");
const { findInstance, updateInstance } = require("./utils/instanceStore.cjs");
const {
  getDirectoryLastModified,
  copyDirectoryRecursive,
  generateTimestamp,
  safeUnlink,
  safeRmDir,
} = require("./utils/fs.cjs");
const {
  findOrCreateFolder,
  manageBackupFiles,
  createZipFromDirectory,
} = require("./folders.cjs");

/**
 * Downloads files from Google Drive current folder.
 * @param {string} instanceId
 * @param {object} options - { downloadPath, unzipFiles, replaceFiles }
 */
async function downloadFromDrive(instanceId, options = {}) {
  const { instance, index, instances } = findInstance(instanceId);

  if (!instance) return { success: false, message: "Instance not found" };
  if (!instance.isAuthenticated || !instance.tokens)
    return { success: false, message: "Not authenticated with Google Drive" };
  if (!instance.currentFolderId)
    return { success: false, message: "Drive folders not configured properly" };

  try {
    console.log(`Starting download for instance ${instanceId}...`);
    const oauth2Client = createOAuth2Client(instance.tokens);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Get files from current folder
    const driveFiles = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: "files(id, name, modifiedTime, mimeType)",
      orderBy: "modifiedTime desc",
    });

    const files = driveFiles.data.files || [];
    if (files.length === 0) {
      return { success: false, message: "No files found in current folder" };
    }

    // Check if local files are newer
    if (
      options.replaceFiles &&
      options.downloadPath &&
      instance.rootDirectory
    ) {
      const localModified = getDirectoryLastModified(instance.rootDirectory);
      const driveModified = new Date(
        Math.max(...files.map((f) => new Date(f.modifiedTime).getTime())),
      );

      if (localModified > driveModified) {
        return {
          success: false,
          message:
            "Your local files are newer than the Drive version. Download cancelled to prevent data loss.",
          isNewerLocal: true,
        };
      }
    }

    let downloadResults = [];
    const folderName = path.basename(instance.rootDirectory || instance.name);

    if (files.length === 1 && files[0].name.endsWith(".zip")) {
      await downloadSingleZip(
        drive,
        files[0],
        instance,
        options,
        oauth2Client,
        downloadResults,
      );
    } else {
      await downloadMultipleFiles(
        drive,
        files,
        folderName,
        instance,
        options,
        oauth2Client,
        downloadResults,
      );
    }

    // Update instance download settings if first time
    if (!instance.downloadPath) {
      updateInstance(instanceId, {
        downloadPath: options.downloadPath,
        downloadUnzip: options.unzipFiles,
        downloadReplace: options.replaceFiles,
      });
    }

    console.log(`Download completed for instance ${instanceId}`);

    return {
      success: true,
      message: `Download completed: ${downloadResults.length} operation(s)`,
      results: downloadResults,
      zipPath: options.unzipFiles
        ? null
        : downloadResults.find((r) => r.action === "zip")?.filePath || null,
    };
  } catch (error) {
    console.error("Download error:", error);
    return { success: false, message: error.message };
  }
}

// ─── Single ZIP download ─────────────────────────────────────────────

async function downloadSingleZip(
  drive,
  zipFile,
  instance,
  options,
  oauth2Client,
  results,
) {
  console.log(`Single ZIP file detected: ${zipFile.name}`);

  try {
    const response = await drive.files.get({
      fileId: zipFile.id,
      alt: "media",
    });
    const zipPath = path.join(options.downloadPath, zipFile.name);

    const buffer = Buffer.from(await response.data.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);
    results.push({
      action: "download",
      message: `Downloaded ${zipFile.name}`,
      filePath: zipFile.name,
    });

    if (options.unzipFiles) {
      const extractPath = options.downloadPath;

      if (options.replaceFiles && fs.existsSync(extractPath)) {
        await createLocalBackup(instance, extractPath, oauth2Client);
        results.push({
          action: "backup",
          message: "Created local backup before replacement",
          filePath: extractPath,
        });
        fs.rmSync(extractPath, { recursive: true, force: true });
      }

      await extract(zipPath, { dir: extractPath });
      results.push({
        action: "extract",
        message: `Extracted files to ${extractPath}`,
        filePath: extractPath,
      });
      fs.unlinkSync(zipPath);
    }
  } catch (fileError) {
    console.error(`Failed to download ${zipFile.name}:`, fileError);
    results.push({
      action: "error",
      message: `Failed to download ${zipFile.name}: ${fileError.message}`,
      filePath: zipFile.name,
    });
  }
}

// ─── Multiple files download ────────────────────────────────────────

async function downloadMultipleFiles(
  drive,
  files,
  folderName,
  instance,
  options,
  oauth2Client,
  results,
) {
  console.log(`Multiple files detected: ${files.length} files`);

  const tempDir = path.join(
    require("os").tmpdir(),
    `download-${instance.id}-${Date.now()}`,
  );
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    for (const file of files) {
      try {
        console.log(`Downloading ${file.name}...`);
        const response = await drive.files.get({
          fileId: file.id,
          alt: "media",
        });

        const filePath = path.join(tempDir, file.name);
        const buffer = Buffer.from(await response.data.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        results.push({
          action: "download",
          message: `Downloaded ${file.name}`,
          filePath: file.name,
        });
      } catch (fileError) {
        console.error(`Failed to download ${file.name}:`, fileError);
        results.push({
          action: "error",
          message: `Failed to download ${file.name}: ${fileError.message}`,
          filePath: file.name,
        });
      }
    }

    // Create ZIP file from temp directory
    const timestamp = generateTimestamp();
    const zipFileName = `${folderName}_download_${timestamp}.zip`;
    const zipPath = path.join(options.downloadPath, zipFileName);

    await createZipFromDirectory(tempDir, zipPath);
    results.push({
      action: "zip",
      message: `Created ZIP: ${zipFileName}`,
      filePath: zipPath,
    });

    if (options.unzipFiles) {
      const extractPath = options.downloadPath;

      if (options.replaceFiles && fs.existsSync(extractPath)) {
        await createLocalBackup(instance, extractPath, oauth2Client);
        results.push({
          action: "backup",
          message: "Created local backup before replacement",
          filePath: extractPath,
        });
        fs.rmSync(extractPath, { recursive: true, force: true });
      }

      // Move files from temp to destination
      const tempItems = fs.readdirSync(tempDir);
      for (const item of tempItems) {
        const sourcePath = path.join(tempDir, item);
        const destPath = path.join(extractPath, item);

        if (fs.statSync(sourcePath).isDirectory()) {
          copyDirectoryRecursive(sourcePath, destPath);
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }
      }

      results.push({
        action: "extract",
        message: `Extracted files to ${extractPath}`,
        filePath: extractPath,
      });
      safeUnlink(zipPath);
    }
  } finally {
    safeRmDir(tempDir);
  }
}

// ─── Local backup ────────────────────────────────────────────────────

async function createLocalBackup(instance, targetPath, oauth2Client) {
  try {
    if (!fs.existsSync(targetPath)) return;

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Find or create backup-local folder
    let backupLocalFolderId = instance.backupLocalFolderId;
    if (!backupLocalFolderId) {
      console.log("Creating backup-local folder...");
      backupLocalFolderId = await findOrCreateFolder(
        drive,
        "backup-local",
        instance.driveFolderId,
      );
      updateInstance(instance.id, { backupLocalFolderId });
    }

    // Create and upload backup ZIP
    const timestamp = generateTimestamp();
    const folderName = path.basename(targetPath);
    const backupZipName = `backup-local-${timestamp}-${folderName}.zip`;
    const tempBackupZipPath = path.join(require("os").tmpdir(), backupZipName);

    try {
      await createZipFromDirectory(targetPath, tempBackupZipPath);

      const backupFileMetadata = {
        name: backupZipName,
        parents: [backupLocalFolderId],
      };
      const backupMedia = {
        mimeType: "application/zip",
        body: fs.createReadStream(tempBackupZipPath),
      };

      await drive.files.create({
        resource: backupFileMetadata,
        media: backupMedia,
        fields: "id",
      });
      console.log(`Created local backup: ${backupZipName}`);

      await manageBackupFiles(drive, backupLocalFolderId);
    } finally {
      safeUnlink(tempBackupZipPath);
    }
  } catch (error) {
    console.error("Error creating local backup:", error);
    throw error;
  }
}

module.exports = { downloadFromDrive };
