// src/files/fileOps.js
const fs = require('fs').promises;
const { resolveSafePath, isDirSafe, isFileSafe, mkdirSafe, removeSafe } = require('./fileSystem');

/**
 * Create a new file at the given path
 * If the file already exists, it will be overwritten (or we can throw? We'll overwrite for simplicity).
 * @param {string} filePath - The path of the file to create (relative to baseDir or absolute).
 * @param {string} [content=''] - The initial content of the file.
 * @returns {Promise<void>}
 */
async function createFile(filePath, content = '') {
  const resolved = resolveSafePath(filePath);
  // Ensure the directory exists
  const dir = require('path').dirname(resolved);
  await mkdirSafe(dir, { recursive: true });
  await fs.writeFile(resolved, content, 'utf8');
}

/**
 * Create a new directory at the given path.
 * @param {string} dirPath - The path of the directory to create.
 * @returns {Promise<void>}
 */
async function createDirectory(dirPath) {
  const resolved = resolveSafePath(dirPath);
  await mkdirSafe(resolved, { recursive: true });
}

/**
 * Rename a file or directory.
 * @param {string} oldPath - The current path of the file or directory.
 * @param {string} newPath - The new path for the file or directory.
 * @returns {Promise<void>}
 */
async function rename(oldPath, newPath) {
  const resolvedOld = resolveSafePath(oldPath);
  const resolvedNew = resolveSafePath(newPath);
  // Ensure the target directory exists
  const newDir = require('path').dirname(resolvedNew);
  await mkdirSafe(newDir, { recursive: true });
  await fs.rename(resolvedOld, resolvedNew);
}

/**
 * Delete a file or directory (recursively).
 * @param {string} targetPath - The path to delete.
 * @returns {Promise<void>}
 */
async function deleteItem(targetPath) {
  const resolved = resolveSafePath(targetPath);
  await removeSafe(resolved, { recursive: true, force: true });
}

/**
 * Check if a path exists (file or directory).
 * @param {string} targetPath - The path to check.
 * @returns {Promise<boolean>}
 */
async function exists(targetPath) {
  try {
    const resolved = resolveSafePath(targetPath);
    await fs.access(resolved);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Copy a file or directory to a new location.
 * @param {string} sourcePath - The path to copy.
 * @param {string} destPath - The destination path.
 * @returns {Promise<void>}
 */
async function copy(sourcePath, destPath) {
  const resolvedSource = resolveSafePath(sourcePath);
  const resolvedDest = resolveSafePath(destPath);
  const stats = await fs.lstat(resolvedSource);
  if (stats.isDirectory()) {
    // Copy directory recursively
    await copyDirectory(resolvedSource, resolvedDest);
  } else {
    // Copy file
    await copyFile(resolvedSource, resolvedDest);
  }
}

// Helper function to copy a file
async function copyFile(source, dest) {
  const destDir = require('path').dirname(dest);
  await mkdirSafe(destDir, { recursive: true });
  await fs.copyFile(source, dest);
}

// Helper function to copy a directory recursively
async function copyDirectory(sourceDir, destDir) {
  await mkdirSafe(destDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = require('path').join(sourceDir, entry.name);
    const destPath = require('path').join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await copyFile(sourcePath, destPath);
    }
  }
}

module.exports = {
  createFile,
  createDirectory,
  rename,
  deleteItem,
  exists,
  copy
};