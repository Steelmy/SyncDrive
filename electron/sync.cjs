const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const { createOAuth2Client } = require("./utils/oauth.cjs");
const {
  findInstance,
  getInstances,
  updateInstance,
} = require("./utils/instanceStore.cjs");
const {
  getDirectoryLastModified,
  getAllFilesRecursively,
  generateTimestamp,
  safeUnlink,
  safeRmDir,
} = require("./utils/fs.cjs");
const { manageBackupFiles, createZipFromDirectory } = require("./folders.cjs");

let mainWindow;
const syncIntervals = new Map();
const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const isSyncing = new Map();

function startSyncInterval(instanceId) {
  stopSyncInterval(instanceId);

  const { instance } = findInstance(instanceId);
  if (
    !instance ||
    !instance.isAuthenticated ||
    instance.autoSyncEnabled === false
  ) {
    return;
  }

  console.log(
    `Starting sync interval for instance ${instanceId} with interval ${instance.syncInterval}ms`,
  );
  syncWithDrive(instanceId);

  const interval = setInterval(
    () => syncWithDrive(instanceId),
    instance.syncInterval,
  );
  syncIntervals.set(instanceId, interval);
}

function stopSyncInterval(instanceId) {
  if (syncIntervals.has(instanceId)) {
    clearInterval(syncIntervals.get(instanceId));
    syncIntervals.delete(instanceId);
    console.log(`Stopped sync interval for instance ${instanceId}`);
  }
}

// ─── Main sync function ──────────────────────────────────────────────

async function syncWithDrive(instanceId, isManual = false) {
  if (isSyncing.get(instanceId)) {
    if (isManual) {
      console.log(`Sync already in progress for instance ${instanceId}`);
      return { success: false, message: "A sync is already in progress" };
    }
    return;
  }

  isSyncing.set(instanceId, true);

  try {
    const { instance, index, instances } = findInstance(instanceId);

    if (!instance) return { success: false, message: "Instance not found" };
    if (!instance.rootDirectory)
      return { success: false, message: "No root directory configured" };
    if (!instance.isAuthenticated || !instance.tokens)
      return { success: false, message: "Not authenticated with Google Drive" };
    if (!instance.currentFolderId || !instance.backupFolderId)
      return {
        success: false,
        message: "Drive folders not configured properly",
      };

    console.log(
      `Starting sync for instance ${instanceId} (ZIP mode: ${instance.zipMode})...`,
    );
    const drive = google.drive({
      version: "v3",
      auth: createOAuth2Client(instance.tokens),
    });

    let syncResults = [];

    // Backup current files before sync
    await createCurrentBackup(drive, instance, syncResults);
    await deleteFilesInCurrent(drive, instance);
    console.log("Backup created and files deleted.");

    if (instance.zipMode) {
      await syncZipMode(drive, instance, syncResults);
    } else {
      await syncIndividualFiles(drive, instance, syncResults);
    }

    // Record results
    const syncRecord = {
      timestamp: new Date().toISOString(),
      results: syncResults,
      success: true,
      message: instance.zipMode
        ? `ZIP sync completed: ${syncResults.length} operation(s)`
        : `File sync completed: ${syncResults.length} file(s) processed`,
    };

    instances[index].syncHistory = instances[index].syncHistory || [];
    instances[index].syncHistory.unshift(syncRecord);
    instances[index].syncHistory = instances[index].syncHistory.slice(0, 10);
    instances[index].lastSyncTime = new Date().toISOString();

    const store = require("./store.cjs");
    store.set("instances", instances);

    console.log(
      `Sync completed for instance ${instanceId}: ${syncRecord.message}`,
    );

    if (mainWindow) {
      mainWindow.webContents.send("sync-completed", {
        instanceId,
        success: true,
        message: syncRecord.message,
        history: instances[index].syncHistory,
      });
    }

    return {
      success: true,
      message: "Synchronisation terminée",
      results: syncResults,
    };
  } catch (error) {
    console.error("Sync error:", error);

    const errorRecord = {
      timestamp: new Date().toISOString(),
      results: [],
      success: false,
      message: error.message,
    };

    const { instance, index, instances } = findInstance(instanceId);
    if (instance) {
      instances[index].syncHistory = instances[index].syncHistory || [];
      instances[index].syncHistory.unshift(errorRecord);
      instances[index].syncHistory = instances[index].syncHistory.slice(0, 10);
      const store = require("./store.cjs");
      store.set("instances", instances);
    }

    if (mainWindow) {
      mainWindow.webContents.send("sync-completed", {
        instanceId,
        success: false,
        message: error.message,
        history: instance?.syncHistory || [],
      });
    }

    return { success: false, message: error.message };
  } finally {
    isSyncing.set(instanceId, false);
  }
}

// ─── ZIP mode sync ───────────────────────────────────────────────────

async function syncZipMode(drive, instance, syncResults) {
  const folderName = path.basename(instance.rootDirectory);
  const timestamp = generateTimestamp();
  const zipFileName = `${folderName}_${timestamp}.zip`;
  const tempZipPath = path.join(require("os").tmpdir(), zipFileName);

  try {
    console.log("Creating ZIP file...");
    await createZipFromDirectory(instance.rootDirectory, tempZipPath);

    const driveFiles = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and name contains '${folderName}_' and name contains '.zip' and trashed=false`,
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
    });

    if (driveFiles.data.files && driveFiles.data.files.length > 0) {
      const existingFile = driveFiles.data.files[0];
      const driveModified = new Date(existingFile.modifiedTime);
      const directoryModified = getDirectoryLastModified(
        instance.rootDirectory,
      );

      if (directoryModified > driveModified) {
        // Move existing to backup, upload new
        const backupFileName = `backup-${generateTimestamp()}-${existingFile.name}`;
        console.log(
          `Moving ${existingFile.name} to backup as ${backupFileName}`,
        );

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
          action: "backup",
          message: `Moved ${existingFile.name} to backup as ${backupFileName}`,
          filePath: existingFile.name,
        });
        await uploadFile(
          drive,
          zipFileName,
          tempZipPath,
          "application/zip",
          instance.currentFolderId,
          syncResults,
        );
        await manageBackupFiles(drive, instance.backupFolderId);
      } else {
        syncResults.push({
          action: "none",
          message: `ZIP is up to date: ${existingFile.name}`,
          filePath: tempZipPath,
        });
      }
    } else {
      await uploadFile(
        drive,
        zipFileName,
        tempZipPath,
        "application/zip",
        instance.currentFolderId,
        syncResults,
      );
    }
  } catch (zipError) {
    console.error("Error creating/uploading ZIP:", zipError);
    syncResults.push({
      action: "error",
      message: `Error creating ZIP: ${zipError.message}`,
      filePath: instance.rootDirectory,
    });
  } finally {
    safeUnlink(tempZipPath);
  }
}

// ─── Individual files mode sync ──────────────────────────────────────

async function syncIndividualFiles(drive, instance, syncResults) {
  const localFiles = getAllFilesRecursively(instance.rootDirectory);
  console.log(`Found ${localFiles.length} local files to sync`);

  for (const localFile of localFiles) {
    const fileName = path.basename(localFile);

    try {
      const driveFiles = await drive.files.list({
        q: `'${instance.currentFolderId}' in parents and name='${fileName}' and trashed=false`,
        fields: "files(id, name, modifiedTime)",
      });

      const localStats = fs.statSync(localFile);
      const localModified = new Date(localStats.mtime);

      if (!driveFiles.data.files || driveFiles.data.files.length === 0) {
        await uploadFile(
          drive,
          fileName,
          localFile,
          "application/octet-stream",
          instance.currentFolderId,
          syncResults,
        );
      } else {
        const driveFile = driveFiles.data.files[0];
        const driveModified = new Date(driveFile.modifiedTime);

        if (localModified > driveModified) {
          const media = {
            mimeType: "application/octet-stream",
            body: fs.createReadStream(localFile),
          };
          await drive.files.update({ fileId: driveFile.id, media });
          syncResults.push({
            action: "upload",
            message: `Updated ${fileName} on Drive`,
            filePath: localFile,
          });
          console.log(`Updated: ${fileName}`);
        } else if (driveModified > localModified) {
          const response = await drive.files.get({
            fileId: driveFile.id,
            alt: "media",
          });
          let dataToWrite = response.data;
          if (typeof response.data?.arrayBuffer === "function") {
            dataToWrite = Buffer.from(await response.data.arrayBuffer());
          }
          fs.writeFileSync(localFile, dataToWrite);
          syncResults.push({
            action: "download",
            message: `Downloaded ${fileName} from Drive`,
            filePath: localFile,
          });
          console.log(`Downloaded: ${fileName}`);
        } else {
          syncResults.push({
            action: "none",
            message: `${fileName} is in sync`,
            filePath: localFile,
          });
        }
      }
    } catch (fileError) {
      console.error(`Error syncing ${fileName}:`, fileError);
      syncResults.push({
        action: "error",
        message: `Error syncing ${fileName}: ${fileError.message}`,
        filePath: localFile,
      });
    }
  }
}

// ─── Helper functions ────────────────────────────────────────────────

async function uploadFile(
  drive,
  fileName,
  filePath,
  mimeType,
  parentFolderId,
  syncResults,
) {
  const fileMetadata = { name: fileName, parents: [parentFolderId] };
  const media = { mimeType, body: fs.createReadStream(filePath) };

  await drive.files.create({ resource: fileMetadata, media, fields: "id" });
  syncResults.push({
    action: "upload",
    message: `Uploaded ${fileName}`,
    filePath,
  });
  console.log(`Uploaded: ${fileName}`);
}

async function deleteFilesInCurrent(drive, instance) {
  try {
    const response = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
    });
    const files = response.data.files || [];

    if (files.length === 0) {
      console.log("No files in current folder to delete on Drive");
      return;
    }

    for (const file of files) {
      await drive.files.delete({ fileId: file.id });
      console.log(`Deleted file from Drive: ${file.name}`);
    }
    console.log("All files deleted from current Drive folder");
  } catch (error) {
    console.error("Error deleting files in current Drive folder:", error);
  }
}

async function createCurrentBackup(drive, instance, syncResults) {
  try {
    console.log("Creating backup of current files before sync...");

    const currentFiles = await drive.files.list({
      q: `'${instance.currentFolderId}' in parents and trashed=false`,
      fields: "files(id, name, modifiedTime)",
    });

    const files = (currentFiles.data.files || []).filter(
      (file) => !/^backup-.*\.zip$/.test(file.name),
    );
    if (files.length === 0) {
      console.log("No files in current folder to backup");
      return;
    }

    const timestamp = generateTimestamp();
    const backupZipName = `backup-${timestamp}.zip`;
    const tempBackupZipPath = path.join(require("os").tmpdir(), backupZipName);
    const tempDir = path.join(
      require("os").tmpdir(),
      `current-backup-${Date.now()}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      for (const file of files) {
        try {
          const response = await drive.files.get({
            fileId: file.id,
            alt: "media",
          });
          const filePath = path.join(tempDir, file.name);
          const buffer = Buffer.from(await response.data.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
        } catch (downloadError) {
          console.error(
            `Failed to download ${file.name} for backup:`,
            downloadError,
          );
        }
      }

      await createZipFromDirectory(tempDir, tempBackupZipPath);
      await uploadFile(
        drive,
        backupZipName,
        tempBackupZipPath,
        "application/zip",
        instance.backupFolderId,
        syncResults,
      );

      syncResults[syncResults.length - 1].action = "backup";
      syncResults[syncResults.length - 1].message =
        `Created pre-sync backup: ${backupZipName}`;

      await manageBackupFiles(drive, instance.backupFolderId);
    } finally {
      safeRmDir(tempDir);
      safeUnlink(tempBackupZipPath);
    }
  } catch (error) {
    console.error("Error creating current backup:", error);
    syncResults.push({
      action: "error",
      message: `Error creating pre-sync backup: ${error.message}`,
      filePath: "current folder",
    });
  }
}

module.exports = {
  DEFAULT_SYNC_INTERVAL,
  syncIntervals,
  startSyncInterval,
  stopSyncInterval,
  syncWithDrive,
};
