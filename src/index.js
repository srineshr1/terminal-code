// src/index.js
// Main entry point for VSCode CLI editor UI

const ui = require('./ui');
const ansi = require('./ansi');
const layout = require('./layout');
const components = require('./components');

// Re-export everything for convenient access
module.exports = {
  // Main UI module
  ui: ui,
  
  // State management
  createState: ui.createState,
  render: ui.render,
  renderToScreen: ui.renderToScreen,
  renderToString: ui.renderToString,
  
  // State updaters
  updateExplorerSelection: ui.updateExplorerSelection,
  updateCursor: ui.updateCursor,
  setModified: ui.setModified,
  setFilePath: ui.setFilePath,
  setEditorContent: ui.setEditorContent,
  setExplorerFiles: ui.setExplorerFiles,
  setStatusBar: ui.setStatusBar,
  
  // Terminal control
  initTerminal: ui.initTerminal,
  restoreTerminal: ui.restoreTerminal,
  handleResize: ui.handleResize,
  
  // ANSI helpers
  ansi: ansi,
  
  // Layout helpers
  layout: layout,
  
  // Component helpers
  components: components,
  
  // Default state
  DEFAULT_STATE: ui.DEFAULT_STATE
};
