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
      onScroll: (delta) => this.executeAction('scroll.lines', { delta }),
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
    
    const rawKeyName = key.name;
    const keyName = this._normalizeKeyName(rawKeyName);
    
    // Handle escape
    if (keyName === 'escape') {
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
      if (keyName === 'return') {
        // Would select menu item
        this.state.set('menuOpen', null);
        this.renderer.closeMenu();
        this._render();
      }
      return;
    }
    
    // Handle search mode
    if (this.state.get('searchMode')) {
      if (keyName === 'return') {
        this.executeAction('search.next');
      } else if (keyName === 'escape') {
        this.state.set('searchMode', false);
        this._render();
      }
      return;
    }
    
    // Focus handling
    const focus = this.state.get('focus');
    
    // Navigation shortcuts
    if (key.ctrl && keyName === 'b') {
      this.state.set('sidebarVisible', !this.state.get('sidebarVisible'));
      this._render();
      return;
    }
    
    if (key.ctrl && keyName === 'f') {
      this.state.set('searchMode', true);
      this._render();
      return;
    }
    
    if (key.ctrl && keyName === 'p') {
      this.state.set('menuOpen', 'file');
      this._render();
      return;
    }
    
    if (key.ctrl && keyName === 'q') {
      this.quit();
      return;
    }
    
    // Editor input (only when focus is on editor)
    if (focus === 'editor') {
      if (keyName === 'return') {
        tab.buffer.insert('\n');
        this._render();
      } else if (keyName === 'backspace') {
        tab.buffer.backspace();
        this._render();
      } else if (keyName === 'delete') {
        tab.buffer.delete();
        this._render();
      } else if (keyName === 'tab') {
        tab.buffer.insert('  ');
        this._render();
      } else if (keyName === 'left') {
        tab.buffer.moveCursor(-1, 0);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'right') {
        tab.buffer.moveCursor(1, 0);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'up') {
        tab.buffer.moveCursor(0, -1);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'down') {
        tab.buffer.moveCursor(0, 1);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'home') {
        tab.buffer.moveToLineStart();
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'end') {
        tab.buffer.moveToLineEnd();
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'pageup') {
        tab.buffer.moveCursor(0, -10);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if (keyName === 'pagedown') {
        tab.buffer.moveCursor(0, 10);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      } else if ((ch && ch.length === 1) || (rawKeyName && rawKeyName.length === 1 && !key.ctrl && !key.alt)) {
        const charToInsert = (ch && ch.length === 1) ? ch : rawKeyName;
        tab.buffer.insert(charToInsert);
        this._render();
      }
    }
    
    // Explorer navigation
    if (focus === 'explorer') {
      const selectedIndex = this.state.get('selectedFileIndex');
      const fileTree = this.state.get('fileTree');
      
      if (keyName === 'up') {
        this.state.set('selectedFileIndex', Math.max(0, selectedIndex - 1));
        this._render();
      } else if (keyName === 'down') {
        this.state.set('selectedFileIndex', Math.min(fileTree.length - 1, selectedIndex + 1));
        this._render();
      } else if (keyName === 'return') {
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
        this.state.set('focus', 'editor');
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
        this.state.set('selectedFileIndex', data);
        this.state.set('focus', 'explorer');
        this._openSelectedFile(data);
        break;
      case 'explorer_toggle':
        this.state.set('selectedFileIndex', data);
        this.state.set('focus', 'explorer');
        {
          const fileTree = this.state.get('fileTree');
          const selectedFile = fileTree ? fileTree[data] : null;
          if (selectedFile && selectedFile.isDirectory && this.fileTree) {
            this.fileTree.toggle(selectedFile.path);
            this.state.set('fileTree', this.fileTree.getVisibleNodes());
            this._render();
          }
        }
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
      case 'editor_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            tab.buffer.setCursor(data.line, data.col);
            this.state.set('focus', 'editor');
            this._render();
          }
        }
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
        scrollTop: buffer.scrollTop,
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
  executeAction(action, args) {
    const [category, name] = action.split('.');
    
    switch (category) {
      case 'file':
        this._handleFileAction(name);
        break;
      case 'tab':
        this._handleTabAction(name, args);
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
      case 'scroll':
        this._handleScrollAction(name, args);
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
  
  _handleTabAction(name, args) {
    switch (name) {
      case 'close':
        this._closeTab(this.activeTabIndex);
        break;
      case 'goto':
        if (args && args.index !== undefined) {
          this.activeTabIndex = args.index;
        }
        break;
      case 'next':
        this.activeTabIndex = (this.activeTabIndex + 1) % this.tabs.length;
        break;
      case 'prev':
        this.activeTabIndex = (this.activeTabIndex - 1 + this.tabs.length) % this.tabs.length;
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
    const fileTree = this.state.get('fileTree');
    const selectedIndex = this.state.get('selectedFileIndex');
    const selectedFile = fileTree ? fileTree[selectedIndex] : null;
    
    switch (name) {
      case 'select':
        this._openSelectedFile();
        break;
      case 'open':
        this._openSelectedFile();
        break;
      case 'expand':
        if (selectedFile && selectedFile.isDirectory && this.fileTree) {
          this.fileTree.toggle(selectedFile.path);
          this.state.set('fileTree', this.fileTree.getVisibleNodes());
        }
        break;
      case 'collapse':
        if (selectedFile && selectedFile.isDirectory && this.fileTree) {
          this.fileTree.toggle(selectedFile.path);
          this.state.set('fileTree', this.fileTree.getVisibleNodes());
        }
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
  
  // === SCROLL ACTIONS ===
  
  _handleScrollAction(name, args) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    const buffer = tab.buffer;
    const editorHeight = this.renderer.getDimensions().height - 3;
    const maxScroll = Math.max(0, buffer.lines.length - editorHeight);
    
    switch (name) {
      case 'lines':
        const scrollAmount = 3;
        buffer.scrollTop = Math.max(0, Math.min(maxScroll, 
          buffer.scrollTop + (args.delta * scrollAmount)));
        break;
      
      case 'page':
        const pageAmount = Math.floor(editorHeight * 0.8);
        buffer.scrollTop = Math.max(0, Math.min(maxScroll,
          buffer.scrollTop + (args.delta * pageAmount)));
        break;
      
      case 'toLine':
        buffer.scrollTop = Math.max(0, Math.min(maxScroll, args.line));
        break;
    }
  }
  
  _ensureCursorVisible(buffer, editorHeight) {
    const cursorLine = buffer.cursor.line;
    const viewportStart = buffer.scrollTop;
    const viewportEnd = buffer.scrollTop + editorHeight - 1;
    
    if (cursorLine < viewportStart) {
      buffer.scrollTop = cursorLine;
    } else if (cursorLine > viewportEnd) {
      buffer.scrollTop = cursorLine - editorHeight + 1;
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
    const tab = this.tabs[index];
    if (!tab) return;
    
    // Check if tab has unsaved changes
    if (tab.modified) {
      // Show confirmation dialog
      this.state.set('confirmDialog', {
        title: 'Unsaved Changes',
        message: `Do you want to save changes to ${tab.title || 'Untitled'}?`,
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        callback: (buttonIndex) => {
          this.state.set('confirmDialog', null);
          if (buttonIndex === 0) {
            // Save
            this._saveCurrentTab().then(() => {
              this._performCloseTab(index);
            });
          } else if (buttonIndex === 1) {
            // Don't Save
            this._performCloseTab(index);
          }
          // Cancel - do nothing
          this._render();
        }
      });
      this._render();
      return;
    }
    
    // No unsaved changes, close immediately
    this._performCloseTab(index);
  }
  
  _performCloseTab(index) {
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
    this._render();
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
  
  async _openSelectedFile(index) {
    const fileTree = this.state.get('fileTree');
    const selectedIndex = index !== undefined ? index : this.state.get('selectedFileIndex');
    const file = fileTree[selectedIndex];
    
    if (!file || file.isDirectory) return;
    
    await this.openFile(file.path);
    this.state.set('focus', 'editor');
    this._render();
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

  _normalizeKeyName(key) {
    const keyMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Escape: 'escape',
      Enter: 'return',
      Return: 'return',
      Backspace: 'backspace',
      Delete: 'delete',
      Tab: 'tab',
      Home: 'home',
      End: 'end',
      PageUp: 'pageup',
      PageDown: 'pagedown',
      Insert: 'insert',
      F1: 'f1',
      F2: 'f2',
      F3: 'f3',
      F4: 'f4',
      F5: 'f5',
      F6: 'f6',
      F7: 'f7',
      F8: 'f8',
      F9: 'f9',
      F10: 'f10',
      F11: 'f11',
      F12: 'f12',
    };
    return keyMap[key] || key;
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
