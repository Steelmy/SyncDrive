const fs = require("fs");
const path = require("path");

/** Files to ignore during directory operations */
const IGNORED_FILES = [".DS_Store", "desktop.ini", "Thumbs.db"];

/**
 * Gets the most recent modification time in a directory (recursive).
 * @param {string} dirPath
 * @returns {Date}
 */
function getDirectoryLastModified(dirPath) {
  let latestTime = new Date(0);

  function checkDirectory(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        if (IGNORED_FILES.includes(item)) continue;
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
      console.error("Error checking directory:", error);
    }
  }

  if (fs.existsSync(dirPath)) {
    checkDirectory(dirPath);
  }

  return latestTime;
}

/**
 * Recursively lists all files in a directory.
 * @param {string} dirPath
 * @returns {string[]} Array of absolute file paths
 */
function getAllFilesRecursively(dirPath) {
  let files = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      if (IGNORED_FILES.includes(item)) continue;
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files = files.concat(getAllFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }

  return files;
}

/**
 * Recursively copies a directory.
 * @param {string} source
 * @param {string} destination
 */
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

/**
 * Generates an ISO-based timestamp string suitable for filenames.
 * @returns {string} e.g. "2024-01-15T14-30-00"
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Safely removes a file if it exists.
 * @param {string} filePath
 */
function safeUnlink(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Safely removes a directory recursively if it exists.
 * @param {string} dirPath
 */
function safeRmDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

module.exports = {
  IGNORED_FILES,
  getDirectoryLastModified,
  getAllFilesRecursively,
  copyDirectoryRecursive,
  generateTimestamp,
  safeUnlink,
  safeRmDir,
};
