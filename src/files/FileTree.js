/**
 * FileTree - Directory tree model for the explorer
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');

class FileTree {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
    this.nodes = []; // Flat array of all nodes
    this.expandedPaths = new Set(); // Set of expanded directory paths
  }
  
  /**
   * Load the file tree from the root directory
   */
  async load() {
    this.nodes = [];
    await this._loadDirectory(this.rootPath, 0);
    this._markLastItems();
  }
  
  /**
   * Load a directory and its contents
   */
  async _loadDirectory(dirPath, depth) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Filter and sort: directories first, then files, alphabetically
      const filtered = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      
      for (const entry of filtered) {
        const fullPath = path.join(dirPath, entry.name);
        const isDirectory = entry.isDirectory();
        const expanded = this.expandedPaths.has(fullPath);
        
        this.nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory,
          depth,
          expanded,
        });
        
        // Recursively load expanded directories
        if (isDirectory && expanded) {
          await this._loadDirectory(fullPath, depth + 1);
        }
      }
    } catch (err) {
      // Silently ignore read errors (permission denied, etc.)
    }
  }
  
  /**
   * Toggle the expanded state of a directory
   */
  toggle(dirPath) {
    if (this.expandedPaths.has(dirPath)) {
      this.expandedPaths.delete(dirPath);
    } else {
      this.expandedPaths.add(dirPath);
    }
    
    // Reload the tree to update the flat list
    this.nodes = [];
    this._loadDirectorySync(this.rootPath, 0);
    this._markLastItems();
  }
  
  /**
   * Synchronous version for toggle (simpler, uses cached data)
   */
  _loadDirectorySync(dirPath, depth) {
    try {
      const entries = require('fs').readdirSync(dirPath, { withFileTypes: true });
      
      const filtered = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      
      for (const entry of filtered) {
        const fullPath = path.join(dirPath, entry.name);
        const isDirectory = entry.isDirectory();
        const expanded = this.expandedPaths.has(fullPath);
        
        this.nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory,
          depth,
          expanded,
        });
        
        if (isDirectory && expanded) {
          this._loadDirectorySync(fullPath, depth + 1);
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }
  
  /**
   * Mark items that are "last" in their depth level (before parent closes)
   */
  _markLastItems() {
    for (let i = 0; i < this.nodes.length; i++) {
      const current = this.nodes[i];
      if (current.depth === 0) {
        current.isLast = true;
        continue;
      }
      
      let isLast = true;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const next = this.nodes[j];
        if (next.depth === current.depth) {
          isLast = false;
          break;
        }
        if (next.depth < current.depth) {
          break;
        }
      }
      current.isLast = isLast;
    }
  }

  /**
   * Get all visible nodes (for rendering)
   */
  getVisibleNodes() {
    return this.nodes;
  }
  
  /**
   * Find a node by path
   */
  findNode(nodePath) {
    return this.nodes.find(n => n.path === nodePath);
  }
  
  /**
   * Refresh the tree
   */
  async refresh() {
    await this.load();
  }
}

module.exports = FileTree;
