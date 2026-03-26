// src/files.js
// File system operations for the terminal text editor

const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Safely resolve a file path within the current working directory.
 * Prevents directory traversal attacks by ensuring the resolved path is within cwd.
 * @param {string} filePath - The file path to resolve (can be relative or absolute)
 * @returns {string} The resolved absolute path within cwd
 * @throws {Error} If the resolved path is outside the cwd
 */
function safeResolve(filePath) {
  const cwd = process.cwd();
  let resolvedPath;

  // If the filePath is already absolute, use it; otherwise resolve relative to cwd
  if (path.isAbsolute(filePath)) {
    resolvedPath = path.resolve(filePath);
  } else {
    resolvedPath = path.resolve(cwd, filePath);
  }

  // Ensure the resolved path is within the cwd
  const relativePath = path.relative(cwd, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Access denied: path is outside the current working directory');
  }

  return resolvedPath;
}

/**
 * Load file content into a buffer (array of lines) for the editor.
 * @param {string} filePath - The file path to load (relative to cwd or absolute)
 * @returns {Promise<string[]>} A promise that resolves to an array of lines
 * @throws {Error} If the file cannot be read or is outside cwd
 */
async function loadFile(filePath) {
  let resolvedPath;
  try {
    resolvedPath = safeResolve(filePath);
  } catch (err) {
    throw new Error(`Invalid file path: ${err.message}`);
  }

  try {
    const linkStats = await fs.promises.lstat(resolvedPath).catch((err) => {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    });
    if (!linkStats) {
      return [''];
    }
    if (linkStats.isSymbolicLink()) {
      throw new Error('Refusing to read through symbolic link');
    }

    const stats = await fs.promises.stat(resolvedPath).catch((err) => {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    });
    if (!stats.isFile()) {
      throw new Error('Target path is not a file');
    }
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large (${stats.size} bytes, max ${MAX_FILE_SIZE_BYTES})`);
    }
    const data = await fs.promises.readFile(resolvedPath, 'utf8');
    return data.split('\n');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [''];
    }
    throw new Error(`Failed to read file: ${err.message}`);
  }
}

/**
 * Save the editor's buffer to a file.
 * @param {string} filePath - The file path to save to (relative to cwd or absolute)
 * @param {string[]} lines - The array of lines to write
 * @throws {Error} If the file cannot be written or is outside cwd
 */
async function saveFile(filePath, lines) {
  let resolvedPath;
  try {
    resolvedPath = safeResolve(filePath);
  } catch (err) {
    throw new Error(`Invalid file path: ${err.message}`);
  }

  try {
    const existing = await fs.promises.lstat(resolvedPath).catch((err) => {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    });
    if (existing && existing.isSymbolicLink()) {
      throw new Error('Refusing to write through symbolic link');
    }
    const data = lines.join('\n');
    await fs.promises.writeFile(resolvedPath, data, 'utf8');
  } catch (err) {
    throw new Error(`Failed to write file: ${err.message}`);
  }
}

/**
 * List directory entries for the explorer.
 * @param {string} dirPath - The directory path to list (relative to cwd or absolute, defaults to cwd)
 * @returns {Promise<Array<{name: string, type: string, path: string}>>} 
 *          Array of entries with name, type ('file' or 'directory'), and relative path
 * @throws {Error} If the directory cannot be read or is outside cwd
 */
async function listDirectory(dirPath = '.') {
  let resolvedPath;
  try {
    resolvedPath = safeResolve(dirPath);
  } catch (err) {
    throw new Error(`Invalid directory path: ${err.message}`);
  }

  try {
    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
    const cwd = process.cwd();
    return entries.map(entry => {
      const fullPath = path.join(resolvedPath, entry.name);
      const relativePath = path.relative(cwd, fullPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: relativePath
      };
    });
  } catch (err) {
    throw new Error(`Failed to list directory: ${err.message}`);
  }
}

module.exports = {
  safeResolve,
  loadFile,
  saveFile,
  listDirectory
};
