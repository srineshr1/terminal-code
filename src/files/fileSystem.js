// src/files/fileSystem.js
const { resolve, sep, relative } = require('path');
const { readdir, readFile, writeFile, mkdir, rm, stat, lstat } = require('fs').promises;

// Get the current working directory (cwd) - in a real app, this might be set by the user or process.cwd()
// For safety, we'll constrain all operations to a base directory (the workspace root)
// We'll assume the workspace root is the current working directory when the editor starts.
// We'll allow setting the base directory via a setter.

let baseDir = process.cwd(); // default to current working directory

/**
 * Set the base directory for file operations.
 * @param {string} dir - The absolute path to the base directory.
 */
function setBaseDir(dir) {
  // Ensure it's an absolute path
  baseDir = resolve(dir);
}

/**
 * Get the current base directory.
 * @returns {string}
 */
function getBaseDir() {
  return baseDir;
}

/**
 * Resolve a user-provided path relative to the base directory, ensuring it stays within baseDir.
 * @param {string} userPath - The path provided by the user (can be relative or absolute).
 * @returns {string} The resolved absolute path that is guaranteed to be inside baseDir.
 * @throws {Error} If the resolved path is outside the baseDir.
 */
function resolveSafePath(userPath) {
  let targetPath;
  // If the userPath is absolute, resolve it; otherwise, resolve relative to baseDir.
  if (sep === '\\' ? /^[a-zA-Z]:\\/.test(userPath) : userPath.startsWith(sep)) {
    // On Windows, absolute path starts with a drive letter and colon, e.g., "C:\"
    // On Unix, absolute path starts with '/'
    targetPath = resolve(userPath);
  } else {
    targetPath = resolve(baseDir, userPath);
  }

  // Ensure the targetPath is within baseDir
  const relativePath = relative(baseDir, targetPath);
  if (relativePath.startsWith('..') || relativePath === '') {
    // If the relative path starts with "..", it's outside baseDir.
    // Also, if relativePath is empty, then targetPath equals baseDir, which is allowed.
    // But note: relative returns empty string when the two paths are the same.
    // We want to allow the baseDir itself.
    if (relativePath.startsWith('..')) {
      throw new Error('Access denied: path is outside the base directory');
    }
  }
  return targetPath;
}

/**
 * Read the contents of a file.
 * @param {string} filePath - The path to the file (relative to baseDir or absolute).
 * @returns {Promise<string>} The file contents as a string (UTF-8).
 */
async function readFileSafe(filePath) {
  const resolved = resolveSafePath(filePath);
  const data = await readFile(resolved, 'utf8');
  return data;
}

/**
 * Write contents to a file.
 * @param {string} filePath - The path to the file (relative to baseDir or absolute).
 * @param {string} data - The string data to write.
 * @param {Object} [options] - Optional options (e.g., encoding, mode). Defaults to UTF-8.
 * @returns {Promise<void>}
 */
async function writeFileSafe(filePath, data, options = { encoding: 'utf8', mode: 0o666 }) {
  const resolved = resolveSafePath(filePath);
  // Ensure the directory exists
  const dir = resolve(resolved, '..');
  await mkdir(dir, { recursive: true });
  await writeFile(resolved, data, options);
}

/**
 * List the contents of a directory.
 * @param {string} dirPath - The path to the directory (relative to baseDir or absolute).
 * @returns {Promise<Array<string>>} An array of file/directory names in the directory.
 */
async function listDirSafe(dirPath) {
  const resolved = resolveSafePath(dirPath);
  const entries = await readdir(resolved, { withFileTypes: true });
  return entries.map(entry => entry.name);
}

/**
 * Get the file/directory stats.
 * @param {string} filePath - The path to the file or directory.
 * @returns {Promise<Object>} The stats object.
 */
async function statSafe(filePath) {
  const resolved = resolveSafePath(filePath);
  return await stat(resolved);
}

/**
 * Check if a path exists and is a directory.
 * @param {string} dirPath - The path to check.
 * @returns {Promise<boolean>}
 */
async function isDirSafe(dirPath) {
  try {
    const stats = await statSafe(dirPath);
    return stats.isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Check if a path exists and is a file.
 * @param {string} filePath - The path to check.
 * @returns {Promise<boolean>}
 */
async function isFileSafe(filePath) {
  try {
    const stats = await statSafe(filePath);
    return stats.isFile();
  } catch (e) {
    return false;
  }
}

/**
 * Remove a file or directory (recursively).
 * @param {string} targetPath - The path to remove.
 * @param {Object} [options] - Options for rm (e.g., { recursive: true, force: true }).
 * @returns {Promise<void>}
 */
async function removeSafe(targetPath, options = { recursive: true, force: true }) {
  const resolved = resolveSafePath(targetPath);
  await rm(resolved, options);
}

/**
 * Create a directory.
 * @param {string} dirPath - The path of the directory to create.
 * @param {Object} [options] - Options for mkdir (e.g., { recursive: true, mode: 0o777 }).
 * @returns {Promise<void>}
 */
async function mkdirSafe(dirPath, options = { recursive: true, mode: 0o777 }) {
  const resolved = resolveSafePath(dirPath);
  await mkdir(resolved, options);
}

/**
 * Check if a file exists
 * @param {string} filePath - The path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    const resolved = resolveSafePath(filePath);
    const stats = await stat(resolved);
    return stats.isFile();
  } catch (e) {
    return false;
  }
}

module.exports = {
  setBaseDir,
  getBaseDir,
  resolveSafePath,
  readFile: readFileSafe,
  writeFile: writeFileSafe,
  readFileSafe,
  writeFileSafe,
  listDirSafe,
  statSafe,
  isDirSafe,
  isFileSafe,
  fileExists,
  removeSafe,
  mkdirSafe
};