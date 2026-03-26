// src/layout.js
// Layout calculations for the terminal UI

const { getTerminalSize } = require('./ansi');

/**
 * Default layout configuration
 */
const DEFAULT_CONFIG = {
  explorerWidth: 25,      // Width of explorer pane in columns
  headerHeight: 1,        // Height of header in rows
  statusBarHeight: 1,     // Height of status bar in rows
  minExplorerWidth: 15,   // Minimum explorer width
  minEditorWidth: 30,     // Minimum editor width
  borderColor: 'cyan',    // Border color
  headerBg: 'blue',       // Header background
  statusBg: 'magenta',   // Status bar background
  explorerBg: 'black',    // Explorer background
  editorBg: 'black'      // Editor background
};

/**
 * Calculate layout dimensions based on terminal size
 * @param {Object} config - Optional configuration overrides
 * @returns {Object} Layout object with dimensions for all panes
 */
function calculateLayout(config = {}) {
  const { cols, rows } = getTerminalSize();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Ensure explorer width is reasonable
  let explorerWidth = cfg.explorerWidth;
  if (explorerWidth > cols - cfg.minEditorWidth) {
    explorerWidth = Math.floor(cols * 0.25);
  }
  if (explorerWidth < cfg.minExplorerWidth) {
    explorerWidth = cfg.minExplorerWidth;
  }
  
  const editorWidth = cols - explorerWidth;
  const headerHeight = cfg.headerHeight;
  const statusBarHeight = cfg.statusBarHeight;
  const editorHeight = rows - headerHeight - statusBarHeight;
  
  return {
    cols,
    rows,
    explorer: {
      x: 0,
      y: headerHeight,
      width: explorerWidth,
      height: editorHeight
    },
    editor: {
      x: explorerWidth,
      y: headerHeight,
      width: editorWidth,
      height: editorHeight
    },
    header: {
      x: 0,
      y: 0,
      width: cols,
      height: headerHeight
    },
    statusBar: {
      x: 0,
      y: rows - statusBarHeight,
      width: cols,
      height: statusBarHeight
    },
    config: cfg
  };
}

/**
 * Get current terminal dimensions
 * @returns {{width: number, height: number}}
 */
function getDimensions() {
  const { cols, rows } = getTerminalSize();
  return { width: cols, height: rows };
}

/**
 * Calculate visible range for scrollable content
 * @param {number} totalLines - Total number of lines
 * @param {number} visibleHeight - Visible height in rows
 * @param {number} scrollOffset - Current scroll offset
 * @returns {{start: number, end: number, scrollOffset: number}}
 */
function calculateVisibleRange(totalLines, visibleHeight, scrollOffset = 0) {
  const maxScroll = Math.max(0, totalLines - visibleHeight);
  const adjustedOffset = Math.min(scrollOffset, maxScroll);
  
  return {
    start: adjustedOffset,
    end: Math.min(adjustedOffset + visibleHeight, totalLines),
    scrollOffset: adjustedOffset
  };
}

/**
 * Calculate cursor screen position
 * @param {number} cursorRow - Cursor row in buffer
 * @param {number} cursorCol - Cursor column in buffer
 * @param {Object} editorLayout - Editor layout object
 * @param {number} scrollOffset - Current scroll offset
 * @returns {{x: number, y: number}} Screen position (0-indexed)
 */
function getCursorScreenPosition(cursorRow, cursorCol, editorLayout, scrollOffset = 0) {
  const screenRow = cursorRow - scrollOffset;
  const x = editorLayout.x + 1 + cursorCol;
  const y = editorLayout.y + 1 + screenRow;
  
  return { x, y };
}

/**
 * Check if cursor is visible in the editor viewport
 * @param {number} cursorRow - Cursor row
 * @param {Object} editorLayout - Editor layout
 * @param {number} scrollOffset - Current scroll offset
 * @returns {boolean}
 */
function isCursorVisible(cursorRow, editorLayout, scrollOffset) {
  const visibleStart = scrollOffset;
  const visibleEnd = scrollOffset + editorLayout.height;
  return cursorRow >= visibleStart && cursorRow < visibleEnd;
}

/**
 * Calculate auto-scroll to keep cursor visible
 * @param {number} cursorRow - Current cursor row
 * @param {Object} editorLayout - Editor layout
 * @param {number} currentScroll - Current scroll offset
 * @returns {number} New scroll offset
 */
function calculateAutoScroll(cursorRow, editorLayout, currentScroll) {
  const visibleHeight = editorLayout.height;
  const visibleStart = currentScroll;
  const visibleEnd = currentScroll + visibleHeight;
  
  if (cursorRow < visibleStart) {
    return cursorRow;
  }
  if (cursorRow >= visibleEnd) {
    return cursorRow - visibleHeight + 1;
  }
  return currentScroll;
}

module.exports = {
  DEFAULT_CONFIG,
  calculateLayout,
  getDimensions,
  calculateVisibleRange,
  getCursorScreenPosition,
  isCursorVisible,
  calculateAutoScroll
};