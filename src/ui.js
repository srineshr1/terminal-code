// src/ui.js
// Main UI module for VSCode-like CLI editor
// Renders the full terminal interface with state-driven approach

const ansi = require('./ansi');
const layout = require('./layout');
const components = require('./components');

const {
  RESET,
  cursorTo,
  clearScreen,
  showCursor,
  getTerminalSize,
  pad,
  truncate
} = ansi;

const {
  calculateLayout,
  calculateAutoScroll
} = layout;

const {
  renderHeader,
  renderExplorer,
  renderEditor,
  renderStatusBar
} = components;

/**
 * Default UI state
 */
const DEFAULT_STATE = {
  // Window title
  title: 'VSCode CLI',
  
  // Explorer pane
  explorer: {
    files: [],
    selectedIndex: 0,
    scrollOffset: 0,
    title: 'EXPLORER'
  },
  
  // Editor pane
  editor: {
    lines: [''],
    cursorRow: 0,
    cursorCol: 0,
    scrollOffset: 0,
    filePath: '',
    modified: false,
    language: 'plaintext'
  },
  
  // Status bar
  statusBar: {
    leftInfo: 'Ready',
    rightInfo: 'utf-8'
  },
  
  // UI options
  options: {
    showExplorer: true,
    showLineNumbers: true,
    theme: 'default'
  }
};

/**
 * Create a new UI state
 * @param {Object} initialState - Optional initial state overrides
 * @returns {Object} Initialized state
 */
function createState(initialState = {}) {
  return {
    ...DEFAULT_STATE,
    ...initialState,
    explorer: { ...DEFAULT_STATE.explorer, ...initialState.explorer },
    editor: { ...DEFAULT_STATE.editor, ...initialState.editor },
    statusBar: { ...DEFAULT_STATE.statusBar, ...initialState.statusBar },
    options: { ...DEFAULT_STATE.options, ...initialState.options }
  };
}

/**
 * Render the complete UI to a string
 * @param {Object} state - Application state
 * @returns {Object} Render result with string and cursor position
 */
function render(state) {
  // Calculate layout based on terminal size
  const layoutResult = calculateLayout();
  const { explorer: explorerLayout, editor: editorLayout, header: headerLayout, statusBar: statusBarLayout } = layoutResult;
  
  // Auto-scroll editor to keep cursor visible
  let scrollOffset = state.editor.scrollOffset;
  if (state.options.showEditor !== false) {
    scrollOffset = calculateAutoScroll(state.editor.cursorRow, editorLayout, scrollOffset);
  }
  
  // Build output string
  let output = '';
  
  // Clear screen and hide cursor during render
  output += clearScreen('all');
  output += showCursor(false);
  
  // Render header
  output += cursorTo(headerLayout.y + 1, headerLayout.x + 1);
  output += renderHeader(headerLayout, {
    title: state.title,
    leftInfo: state.options.showExplorer ? '' : '',
    rightInfo: state.editor.modified ? '[Modified]' : ''
  });
  
  // Render explorer pane
  if (state.options.showExplorer) {
    output += cursorTo(explorerLayout.y + 1, explorerLayout.x + 1);
    const explorerResult = renderExplorer(explorerLayout, {
      files: state.explorer.files,
      selectedIndex: state.explorer.selectedIndex,
      scrollOffset: state.explorer.scrollOffset,
      title: state.explorer.title
    });
    output += explorerResult.content.join('\n' + cursorTo(explorerLayout.y + 2, explorerLayout.x + 1));
  }
  
  // Render editor pane
  if (state.options.showEditor !== false) {
    output += cursorTo(editorLayout.y + 1, editorLayout.x + 1);
    const editorResult = renderEditor(editorLayout, {
      lines: state.editor.lines,
      cursorRow: state.editor.cursorRow,
      cursorCol: state.editor.cursorCol,
      scrollOffset: scrollOffset
    });
    output += editorResult.content.join('\n' + cursorTo(editorLayout.y + 2, editorLayout.x + 1));
  }
  
  // Render status bar
  output += cursorTo(statusBarLayout.y + 1, statusBarLayout.x + 1);
  
  // Build status bar info
  const fileName = state.editor.filePath ? truncate(state.editor.filePath, 30) : 'Untitled';
  const cursorInfo = `Ln ${state.editor.cursorRow + 1}, Col ${state.editor.cursorCol + 1}`;
  const leftInfo = `${state.statusBar.leftInfo} | ${fileName}${state.editor.modified ? ' *' : ''}`;
  const rightInfo = `${state.statusBar.rightInfo} | ${cursorInfo} | ${state.editor.language}`;
  
  output += renderStatusBar(statusBarLayout, {
    leftInfo,
    rightInfo
  });
  
  // Position cursor at end
  let cursorX, cursorY;
  if (state.options.showEditor !== false) {
    const lineNumberWidth = String(state.editor.lines.length).length + 2;
    const cursorScreenRow = state.editor.cursorRow - scrollOffset;
    cursorX = editorLayout.x + lineNumberWidth + state.editor.cursorCol + 1;
    cursorY = editorLayout.y + 1 + cursorScreenRow;
  } else {
    cursorX = 1;
    cursorY = statusBarLayout.y;
  }
  
  output += cursorTo(cursorY, cursorX);
  output += showCursor(true);
  
  return {
    output,
    layout: layoutResult,
    cursor: { x: cursorX, y: cursorY },
    scrollOffset
  };
}

/**
 * Render and write to stdout
 * @param {Object} state - Application state
 * @returns {Object} Render result
 */
function renderToScreen(state) {
  const result = render(state);
  process.stdout.write(result.output);
  return result;
}

/**
 * Get the raw render output (for testing or capture)
 * @param {Object} state - Application state
 * @returns {string} Rendered output string
 */
function renderToString(state) {
  const result = render(state);
  return result.output;
}

/**
 * Update explorer selection
 * @param {Object} state - Current state
 * @param {number} newIndex - New selected index
 * @returns {Object} Updated state
 */
function updateExplorerSelection(state, newIndex) {
  const files = state.explorer.files;
  const clampedIndex = Math.max(0, Math.min(newIndex, files.length - 1));
  
  return {
    ...state,
    explorer: {
      ...state.explorer,
      selectedIndex: clampedIndex
    }
  };
}

/**
 * Update editor cursor position
 * @param {Object} state - Current state
 * @param {number} row - New row
 * @param {number} col - New column
 * @returns {Object} Updated state
 */
function updateCursor(state, row, col) {
  const lines = state.editor.lines;
  const clampedRow = Math.max(0, Math.min(row, lines.length - 1));
  const clampedCol = Math.max(0, Math.min(col, lines[clampedRow].length));
  
  return {
    ...state,
    editor: {
      ...state.editor,
      cursorRow: clampedRow,
      cursorCol: clampedCol
    }
  };
}

/**
 * Mark file as modified
 * @param {Object} state - Current state
 * @param {boolean} modified - Modified flag
 * @returns {Object} Updated state
 */
function setModified(state, modified) {
  return {
    ...state,
    editor: {
      ...state.editor,
      modified
    }
  };
}

/**
 * Set current file path
 * @param {Object} state - Current state
 * @param {string} filePath - File path
 * @returns {Object} Updated state
 */
function setFilePath(state, filePath) {
  return {
    ...state,
    editor: {
      ...state.editor,
      filePath
    }
  };
}

/**
 * Set editor content
 * @param {Object} state - Current state
 * @param {string[]} lines - New lines
 * @returns {Object} Updated state
 */
function setEditorContent(state, lines) {
  return {
    ...state,
    editor: {
      ...state.editor,
      lines,
      cursorRow: 0,
      cursorCol: 0,
      scrollOffset: 0
    }
  };
}

/**
 * Set explorer files
 * @param {Object} state - Current state
 * @param {Array} files - Files array
 * @returns {Object} Updated state
 */
function setExplorerFiles(state, files) {
  return {
    ...state,
    explorer: {
      ...state.explorer,
      files,
      selectedIndex: 0,
      scrollOffset: 0
    }
  };
}

/**
 * Set status bar info
 * @param {Object} state - Current state
 * @param {string} left - Left status info
 * @param {string} right - Right status info
 * @returns {Object} Updated state
 */
function setStatusBar(state, left, right) {
  return {
    ...state,
    statusBar: {
      leftInfo: left,
      rightInfo: right || state.statusBar.rightInfo
    }
  };
}

/**
 * Initialize the terminal for the UI
 * Enables alternate screen buffer and sets up the environment
 */
function initTerminal() {
  process.stdout.write(ansi.alternateScreen(true));
  process.stdout.write(clearScreen('all'));
  process.stdout.write(showCursor(true));
}

/**
 * Restore the terminal to normal mode
 */
function restoreTerminal() {
  process.stdout.write(ansi.alternateScreen(false));
  process.stdout.write(clearScreen('all'));
  process.stdout.write(showCursor(true));
}

/**
 * Handle terminal resize
 * @param {Object} state - Current state
 * @returns {Object} Updated state with new layout
 */
function handleResize(state) {
  const { cols, rows } = getTerminalSize();
  // State doesn't need changes, render will pick up new dimensions
  return {
    ...state,
    _lastDimensions: { cols, rows }
  };
}

module.exports = {
  DEFAULT_STATE,
  createState,
  render,
  renderToScreen,
  renderToString,
  updateExplorerSelection,
  updateCursor,
  setModified,
  setFilePath,
  setEditorContent,
  setExplorerFiles,
  setStatusBar,
  initTerminal,
  restoreTerminal,
  handleResize
};
