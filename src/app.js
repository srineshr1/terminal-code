/**
 * Main Application - VSCode-style CLI Editor
 * Uses blessed library for terminal UI rendering
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

// Core
const State = require('./core/state');

// Editor
const Buffer = require('./editor/Buffer');
const History = require('./editor/History');
const Clipboard = require('./editor/Clipboard');
const Search = require('./editor/Search');

// Files
const { readFile, writeFile, fileExists } = require('./files/fileSystem');
const FileTree = require('./files/FileTree');

// UI
const BlessedRenderer = require('./ui/BlessedRenderer');

/**
 * Application class
 * Main controller for the editor
 */
class App extends EventEmitter {
  constructor() {
    super();
    
    // Initialize state
    this.state = new State();
    
    // Initialize components
    this.clipboard = new Clipboard();
    this.search = new Search();
    this.fileTree = null;
    this.renderer = null;
    
    // Tab management
    this.tabs = [];
    this.activeTabIndex = 0;
    
    // Bind methods
    this._onResize = this._onResize.bind(this);
  }
  
  /**
   * Initialize default state values
   */
  _initState() {
    this.state.set('focus', 'editor');
    this.state.set('sidebarVisible', true);
    this.state.set('searchMode', false);
    this.state.set('searchQuery', '');
    this.state.set('replaceQuery', '');
    this.state.set('menuOpen', null);
  }
  
  /**
   * Start the application
   */
  async start(initialPath) {
    // Setup blessed renderer
    this.renderer = new BlessedRenderer({
      state: this.state,
      onKeypress: (ch, key) => this._handleKeypress(ch, key),
      onClick: (type, data) => this._handleClick(type, data),
      onMenuClick: (menuId) => this._handleMenuClick(menuId),
    });
    
    // Initialize blessed screen
    this.renderer.init();
    
    // Setup state
    this._initState();
    
    // Initialize file tree
    const startDir = initialPath ? path.dirname(path.resolve(initialPath)) : process.cwd();
    this.fileTree = new FileTree(startDir);
    await this.fileTree.load();
    this.state.set('fileTree', this.fileTree.getVisibleNodes());
    this.state.set('selectedFileIndex', 0);
    this.state.set('workingDirectory', startDir);
    
    // Open initial file or create new buffer
    if (initialPath && await fileExists(initialPath)) {
      await this.openFile(path.resolve(initialPath));
    } else {
      this._createNewTab(null);
    }
    
    // Initial render
    this._render();
    
    // Handle resize
    process.stdout.on('resize', this._onResize);
  }
  
  /**
   * Handle keyboard input
   */
  _handleKeypress(ch, key) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    // Handle escape
    if (key.name === 'escape') {
      if (this.state.get('menuOpen')) {
        this.state.set('menuOpen', null);
        this.renderer.closeMenu();
        this._render();
        return;
      }
      if (this.state.get('searchMode')) {
        this.state.set('searchMode', false);
        this._render();
        return;
      }
      return;
    }
    
    // Handle menu open state
    if (this.state.get('menuOpen')) {
      if (key.name === 'return' || key.name === 'enter') {
        // Would select menu item
        this.state.set('menuOpen', null);
        this.renderer.closeMenu();
        this._render();
      }
      return;
    }
    
    // Handle search mode
    if (this.state.get('searchMode')) {
      if (key.name === 'return') {
        this.executeAction('search.next');
      } else if (key.name === 'escape') {
        this.state.set('searchMode', false);
        this._render();
      }
      return;
    }
    
    // Focus handling
    const focus = this.state.get('focus');
    
    // Navigation shortcuts
    if (key.ctrl && key.name === 'b') {
      this.state.set('sidebarVisible', !this.state.get('sidebarVisible'));
      this._render();
      return;
    }
    
    if (key.ctrl && key.name === 'f') {
      this.state.set('searchMode', true);
      this._render();
      return;
    }
    
    if (key.ctrl && key.name === 'p') {
      this.state.set('menuOpen', 'file');
      this._render();
      return;
    }
    
    if (key.ctrl && key.name === 'q') {
      this.quit();
      return;
    }
    
    // Editor input (only when focus is on editor)
    if (focus === 'editor') {
      if (key.name === 'return') {
        tab.buffer.insert('\n');
        this._render();
      } else if (key.name === 'backspace') {
        tab.buffer.backspace();
        this._render();
      } else if (key.name === 'delete') {
        tab.buffer.delete();
        this._render();
      } else if (key.name === 'tab') {
        tab.buffer.insert('  ');
        this._render();
      } else if (key.name === 'left') {
        tab.buffer.moveCursor(0, -1);
        this._render();
      } else if (key.name === 'right') {
        tab.buffer.moveCursor(0, 1);
        this._render();
      } else if (key.name === 'up') {
        tab.buffer.moveCursor(-1, 0);
        this._render();
      } else if (key.name === 'down') {
        tab.buffer.moveCursor(1, 0);
        this._render();
      } else if (key.name === 'home') {
        tab.buffer.moveToLineStart();
        this._render();
      } else if (key.name === 'end') {
        tab.buffer.moveToLineEnd();
        this._render();
      } else if (ch && ch.length === 1) {
        tab.buffer.insert(ch);
        this._render();
      }
    }
    
    // Explorer navigation
    if (focus === 'explorer') {
      const selectedIndex = this.state.get('selectedFileIndex');
      const fileTree = this.state.get('fileTree');
      
      if (key.name === 'up') {
        this.state.set('selectedFileIndex', Math.max(0, selectedIndex - 1));
        this._render();
      } else if (key.name === 'down') {
        this.state.set('selectedFileIndex', Math.min(fileTree.length - 1, selectedIndex + 1));
        this._render();
      } else if (key.name === 'return') {
        this._openSelectedFile();
      }
    }
  }
  
  /**
   * Handle click events from blessed
   */
  _handleClick(type, data) {
    switch (type) {
      case 'tab':
        this.activeTabIndex = data;
        this._render();
        break;
      case 'tab_close':
        this._closeTab(data);
        break;
      case 'explorer':
        this.state.set('selectedFileIndex', data);
        this.state.set('focus', 'explorer');
        this._render();
        break;
      case 'explorer_open':
        this._openSelectedFile();
        break;
      case 'menu_action':
        this.state.set('menuOpen', null);
        this.renderer.closeMenu();
        this.executeAction(data);
        break;
      case 'search_next':
        this.executeAction('search.next');
        break;
      case 'search_close':
        this.state.set('searchMode', false);
        this._render();
        break;
    }
  }
  
  /**
   * Handle menu click from menu bar
   */
  _handleMenuClick(menuId) {
    if (this.state.get('menuOpen') === menuId) {
      this.state.set('menuOpen', null);
      this.renderer.closeMenu();
    } else {
      this.state.set('menuOpen', menuId);
    }
    this._render();
  }
  
  /**
   * Handle resize
   */
  _onResize() {
    this._render();
  }
  
  /**
   * Render the UI
   */
  _render() {
    const tab = this.tabs[this.activeTabIndex];
    const buffer = tab ? tab.buffer : null;
    
    this.renderer.buildLayout({
      tabs: this.tabs.map((t, i) => ({
        title: t.filePath ? path.basename(t.filePath) : 'Untitled',
        filePath: t.filePath,
        modified: t.modified,
      })),
      activeTabIndex: this.activeTabIndex,
      buffer: buffer ? {
        lines: buffer.lines,
        cursor: buffer.cursor,
      } : null,
      fileTree: this.state.get('fileTree'),
      selectedFileIndex: this.state.get('selectedFileIndex'),
      showExplorer: this.state.get('sidebarVisible'),
      focus: this.state.get('focus'),
      searchMode: this.state.get('searchMode'),
      searchQuery: this.state.get('searchQuery'),
      replaceQuery: this.state.get('replaceQuery'),
      menuOpen: this.state.get('menuOpen'),
      filePath: tab ? tab.filePath : null,
      cursorLine: buffer ? buffer.cursor.line + 1 : 1,
      cursorCol: buffer ? buffer.cursor.col + 1 : 1,
    });
  }
  
  /**
   * Execute an action
   */
  executeAction(action) {
    const [category, name] = action.split('.');
    
    switch (category) {
      case 'file':
        this._handleFileAction(name);
        break;
      case 'tab':
        this._handleTabAction(name);
        break;
      case 'edit':
        this._handleEditAction(name);
        break;
      case 'view':
        this._handleViewAction(name);
        break;
      case 'search':
        this._handleSearchAction(name);
        break;
      case 'explorer':
        this._handleExplorerAction(name);
        break;
      case 'select':
        this._handleSelectAction(name);
        break;
      case 'app':
        this._handleAppAction(name);
        break;
    }
    
    this._render();
  }
  
  // === FILE ACTIONS ===
  
  _handleFileAction(name) {
    switch (name) {
      case 'new':
        this._createNewTab(null);
        break;
      case 'open':
        this.state.set('focus', 'explorer');
        break;
      case 'openFolder':
        // Would prompt for folder
        break;
      case 'save':
        this._saveCurrentTab();
        break;
      case 'saveAs':
        this._saveCurrentTabAs();
        break;
    }
  }
  
  // === TAB ACTIONS ===
  
  _handleTabAction(name) {
    switch (name) {
      case 'close':
        this._closeTab(this.activeTabIndex);
        break;
      case 'goto':
        if (name.args && name.args.index !== undefined) {
          this.activeTabIndex = name.args.index;
        }
        break;
    }
  }
  
  // === EDIT ACTIONS ===
  
  _handleEditAction(name) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    switch (name) {
      case 'undo':
        if (tab.history) tab.history.undo();
        break;
      case 'redo':
        if (tab.history) tab.history.redo();
        break;
      case 'cut':
        this._cut();
        break;
      case 'copy':
        this._copy();
        break;
      case 'paste':
        this._paste();
        break;
    }
  }
  
  // === VIEW ACTIONS ===
  
  _handleViewAction(name) {
    switch (name) {
      case 'toggleSidebar':
        this.state.set('sidebarVisible', !this.state.get('sidebarVisible'));
        break;
      case 'focusEditor':
        this.state.set('focus', 'editor');
        break;
      case 'focusExplorer':
        this.state.set('focus', 'explorer');
        break;
    }
  }
  
  // === SEARCH ACTIONS ===
  
  _handleSearchAction(name) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    switch (name) {
      case 'open':
        this.state.set('searchMode', true);
        break;
      case 'next':
        const query = this.state.get('searchQuery');
        if (query) {
          this.search.find(tab.buffer, query);
          tab.buffer.select(this.search.currentIndex, this.search.results.length);
        }
        break;
      case 'prev':
        // Would go to previous match
        break;
    }
  }
  
  // === EXPLORER ACTIONS ===
  
  _handleExplorerAction(name) {
    switch (name) {
      case 'select':
        this._openSelectedFile();
        break;
      case 'open':
        this._openSelectedFile();
        break;
    }
  }
  
  // === SELECT ACTIONS ===
  
  _handleSelectAction(name) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    switch (name) {
      case 'all':
        tab.buffer.selectAll();
        break;
      case 'line':
        tab.buffer.selectLine();
        break;
      case 'expand':
        tab.buffer.expandSelection();
        break;
      case 'shrink':
        tab.buffer.shrinkSelection();
        break;
    }
  }
  
  // === APP ACTIONS ===
  
  _handleAppAction(name) {
    switch (name) {
      case 'quit':
        this.quit();
        break;
    }
  }
  
  // === FILE OPERATIONS ===
  
  async openFile(filePath) {
    try {
      const content = await readFile(filePath);
      const buffer = new Buffer();
      buffer.setLines(content.split('\n'));
      
      const history = new History(buffer);
      
      this.tabs.push({
        buffer,
        history,
        filePath,
        modified: false,
      });
      
      this.activeTabIndex = this.tabs.length - 1;
    } catch (err) {
      console.error('Failed to open file:', err.message);
    }
  }
  
  _createNewTab(filePath) {
    const buffer = new Buffer();
    const history = new History(buffer);
    
    this.tabs.push({
      buffer,
      history,
      filePath,
      modified: false,
    });
    
    this.activeTabIndex = this.tabs.length - 1;
  }
  
  _closeTab(index) {
    if (this.tabs.length <= 1) {
      // Don't close last tab, just clear it
      const tab = this.tabs[0];
      tab.buffer = new Buffer();
      tab.filePath = null;
      tab.modified = false;
    } else {
      this.tabs.splice(index, 1);
      if (this.activeTabIndex >= this.tabs.length) {
        this.activeTabIndex = this.tabs.length - 1;
      }
    }
  }
  
  async _saveCurrentTab() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    if (!tab.filePath) {
      this._saveCurrentTabAs();
      return;
    }
    
    try {
      const content = tab.buffer.lines.join('\n');
      await writeFile(tab.filePath, content);
      tab.modified = false;
      this._showMessage('Saved: ' + tab.filePath);
    } catch (err) {
      this._showMessage('Failed to save: ' + err.message);
    }
  }
  
  async _saveCurrentTabAs() {
    // Would show save dialog
    this._showMessage('Save As not implemented yet');
  }
  
  async _openSelectedFile() {
    const fileTree = this.state.get('fileTree');
    const selectedIndex = this.state.get('selectedFileIndex');
    const file = fileTree[selectedIndex];
    
    if (!file || file.isDirectory) return;
    
    await this.openFile(file.path);
  }
  
  // === CLIPBOARD ===
  
  _cut() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    const selection = tab.buffer.getSelection();
    if (selection) {
      this.clipboard.copy(selection);
      tab.buffer.deleteSelection();
    }
  }
  
  _copy() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    const selection = tab.buffer.getSelection();
    if (selection) {
      this.clipboard.copy(selection);
    }
  }
  
  _paste() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    const text = this.clipboard.paste();
    if (text) {
      tab.buffer.insert(text);
    }
  }
  
  _showMessage(msg) {
    if (this.renderer && this.renderer.widgets.statusBar) {
      const leftInfo = this.renderer.widgets.statusBar.children[0];
      if (leftInfo && leftInfo.setContent) {
        leftInfo.setContent(msg);
        this.renderer.render();
      }
    }
  }
  
  /**
   * Quit the application
   */
  quit() {
    // Close blessed screen
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    // Exit
    process.exit(0);
  }
}

module.exports = App;
