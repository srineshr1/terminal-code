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

// Utils
const logger = require('./utils/logger');

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
    this._notificationTimer = null;
    
    this._cursorBlinkTimer = null;
    this._cursorPauseTimer = null;
    this.CURSOR_BLINK_INTERVAL = 500;
    this.CURSOR_PAUSE_DURATION = 1000;
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
    this.state.set('confirmDialog', null);
    this.state.set('inputDialog', null);
    this.state.set('notification', null);
    this.state.set('cursorVisible', true);
  }
  
  _startCursorBlink() {
    if (this._cursorBlinkTimer) return;
    
    this._cursorBlinkTimer = setInterval(() => {
      const currentVisible = this.state.get('cursorVisible');
      this.state.set('cursorVisible', !currentVisible);
      this._render();
    }, this.CURSOR_BLINK_INTERVAL);
  }
  
  _stopCursorBlink() {
    if (this._cursorBlinkTimer) {
      clearInterval(this._cursorBlinkTimer);
      this._cursorBlinkTimer = null;
    }
    this.state.set('cursorVisible', true);
    this._render();
  }
  
  _resetCursorBlink() {
    this.state.set('cursorVisible', true);
    
    if (this._cursorBlinkTimer) {
      clearInterval(this._cursorBlinkTimer);
      this._cursorBlinkTimer = null;
    }
    
    if (this._cursorPauseTimer) {
      clearTimeout(this._cursorPauseTimer);
    }
    
    this._cursorPauseTimer = setTimeout(() => {
      this._startCursorBlink();
      this._cursorPauseTimer = null;
    }, this.CURSOR_PAUSE_DURATION);
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
    
    // Open initial file if provided
    if (initialPath && await fileExists(initialPath)) {
      await this.openFile(path.resolve(initialPath));
    }
    
    // Initial render
    this._render();
    
    this._startCursorBlink();
    
    // Handle resize
    process.stdout.on('resize', this._onResize);
  }
  
  /**
   * Handle keyboard input
   */
  _handleKeypress(ch, key) {
    const rawKeyName = key.name;
    const keyName = this._normalizeKeyName(rawKeyName);
    const inputDialog = this.state.get('inputDialog');

    if (inputDialog) {
      this._handleInputDialogKey(ch, keyName, key);
      return;
    }

    if (this.state.get('confirmDialog')) {
      if (keyName === 'escape') {
        const dialog = this.state.get('confirmDialog');
        if (dialog && dialog.callback) {
          dialog.callback((dialog.buttons || []).length - 1);
        }
        return;
      }
      if (keyName === 'return') {
        const dialog = this.state.get('confirmDialog');
        if (dialog && dialog.callback) {
          dialog.callback(0);
        }
        return;
      }
    }
    
    // Handle escape
    if (keyName === 'escape') {
      if (this.state.get('menuOpen')) {
        this.state.set('menuOpen', null);
        this.renderer.closeMenu();
        this._startCursorBlink();
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
        this._startCursorBlink();
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

    if (key.ctrl && keyName === 'n' && !key.shift && !key.alt) {
      this.executeAction('file.new');
      return;
    }

    if (key.ctrl && keyName === 's' && !key.shift) {
      this.executeAction('file.save');
      return;
    }

    if (key.ctrl && keyName === 's' && key.shift) {
      this.executeAction('file.saveAs');
      return;
    }

    if (key.ctrl && key.shift && keyName === 'r') {
      this.executeAction('file.rename');
      return;
    }

    if ((key.ctrl && key.shift && keyName === 'd') || (key.ctrl && key.shift && keyName === 'delete')) {
      this.executeAction('file.delete');
      return;
    }

    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;
    
    // Editor input (only when focus is on editor)
    if (focus === 'editor') {
      if (keyName === 'return') {
        tab.buffer.insert('\n');
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'backspace') {
        tab.buffer.backspace();
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'delete') {
        tab.buffer.delete();
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'tab') {
        tab.buffer.insert('  ');
        this._resetCursorBlink();
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
        this._resetCursorBlink();
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
      } else if (keyName === 'f2') {
        this.executeAction('explorer.rename');
      } else if (keyName === 'delete') {
        this.executeAction('explorer.delete');
      } else if (key.ctrl && key.shift && keyName === 'n') {
        this.executeAction('explorer.newFile');
      } else if (key.ctrl && key.alt && keyName === 'n') {
        this.executeAction('explorer.newFolder');
      }
    }
  }

  _handleInputDialogKey(ch, keyName, key) {
    const dialog = this.state.get('inputDialog');
    if (!dialog) return;

    const value = dialog.value || '';
    let cursorPos = dialog.cursorPos !== undefined ? dialog.cursorPos : value.length;
    
    logger.debug('dialog', 'Key pressed in dialog', {
      keyName: keyName,
      ch: ch,
      chCode: ch ? ch.charCodeAt(0) : null,
      currentValue: value,
      cursorPos: cursorPos,
      keyCtrl: key.ctrl,
      keyAlt: key.alt
    });

    if (keyName === 'escape') {
      logger.debug('dialog', 'Escape pressed - closing dialog');
      this._resolveInputDialog(null);
      return;
    }

    if (keyName === 'return' || keyName === 'enter') {
      logger.debug('dialog', 'Enter/Return pressed', {
        value: value,
        dialogValueFromState: dialog.value
      });
      this._resolveInputDialog(value);
      return;
    }

    if (keyName === 'left') {
      if (cursorPos > 0) {
        cursorPos--;
        logger.debug('dialog', 'Left arrow - moving cursor', {
          newCursorPos: cursorPos
        });
        this.state.set('inputDialog', Object.assign({}, dialog, {
          cursorPos: cursorPos
        }));
        this._render();
      }
      return;
    }

    if (keyName === 'right') {
      if (cursorPos < value.length) {
        cursorPos++;
        logger.debug('dialog', 'Right arrow - moving cursor', {
          newCursorPos: cursorPos
        });
        this.state.set('inputDialog', Object.assign({}, dialog, {
          cursorPos: cursorPos
        }));
        this._render();
      }
      return;
    }

    if (keyName === 'home') {
      if (cursorPos !== 0) {
        logger.debug('dialog', 'Home key - moving to start');
        this.state.set('inputDialog', Object.assign({}, dialog, {
          cursorPos: 0
        }));
        this._render();
      }
      return;
    }

    if (keyName === 'end') {
      if (cursorPos !== value.length) {
        logger.debug('dialog', 'End key - moving to end');
        this.state.set('inputDialog', Object.assign({}, dialog, {
          cursorPos: value.length
        }));
        this._render();
      }
      return;
    }

    if (keyName === 'delete') {
      if (cursorPos < value.length) {
        const newValue = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
        logger.debug('dialog', 'Delete key pressed', {
          oldValue: value,
          newValue: newValue,
          cursorPos: cursorPos
        });
        this.state.set('inputDialog', Object.assign({}, dialog, {
          value: newValue
        }));
        this._resetCursorBlink();
        this._render();
      }
      return;
    }

    if (keyName === 'backspace') {
      if (cursorPos > 0) {
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        const newCursorPos = cursorPos - 1;
        logger.debug('dialog', 'Backspace pressed', {
          oldValue: value,
          newValue: newValue,
          oldCursorPos: cursorPos,
          newCursorPos: newCursorPos
        });
        this.state.set('inputDialog', Object.assign({}, dialog, {
          value: newValue,
          cursorPos: newCursorPos
        }));
        this._resetCursorBlink();
        this._render();
      }
      return;
    }

    if (!key.ctrl && !key.alt && ch && ch.length === 1) {
      const charCode = ch.charCodeAt(0);
      
      if (charCode >= 32 && charCode !== 127) {
        const newValue = value.slice(0, cursorPos) + ch + value.slice(cursorPos);
        const newCursorPos = cursorPos + 1;
        logger.debug('dialog', 'Inserting character', {
          char: ch,
          charCode: charCode,
          oldValue: value,
          newValue: newValue,
          oldCursorPos: cursorPos,
          newCursorPos: newCursorPos
        });
        this.state.set('inputDialog', Object.assign({}, dialog, {
          value: newValue,
          cursorPos: newCursorPos
        }));
        this._resetCursorBlink();
        this._render();
      }
      return;
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
        this._startCursorBlink();
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
      this._startCursorBlink();
    } else {
      this.state.set('menuOpen', menuId);
      this._stopCursorBlink();
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
      confirmDialog: this.state.get('confirmDialog'),
      inputDialog: this.state.get('inputDialog'),
      notification: this.state.get('notification'),
      filePath: tab ? tab.filePath : null,
      cursorLine: buffer ? buffer.cursor.line + 1 : 1,
      cursorCol: buffer ? buffer.cursor.col + 1 : 1,
      cursorVisible: this.state.get('cursorVisible'),
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
        this._promptNewFile();
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
      case 'rename':
        this._renameActiveTabFile();
        break;
      case 'delete':
        this._deleteActiveTabFile();
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
      case 'newFile':
        this._promptNewFile(selectedFile && selectedFile.isDirectory ? selectedFile.path : this.state.get('workingDirectory'));
        break;
      case 'newFolder':
        this._promptNewFolder(selectedFile && selectedFile.isDirectory ? selectedFile.path : this.state.get('workingDirectory'));
        break;
      case 'rename':
        this._renameExplorerItem(selectedFile);
        break;
      case 'delete':
        this._deleteExplorerItem(selectedFile);
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
      this._showNotification('Saved to ' + tab.filePath, 'success');
    } catch (err) {
      this._showNotification('Failed to save: ' + err.message, 'error');
    }
  }
  
  async _saveCurrentTabAs() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) return;

    const defaultPath = tab.filePath || path.join(this.state.get('workingDirectory') || process.cwd(), 'new-file.txt');
    this._showInputDialog({
      title: 'Save As',
      prompt: 'Enter full file path:',
      value: defaultPath,
      callback: async (newPath) => {
        if (!newPath) return;
        try {
          const content = tab.buffer.lines.join('\n');
          await writeFile(newPath, content);
          tab.filePath = newPath;
          tab.modified = false;
          this._showNotification('Saved to ' + newPath, 'success');
          this._refreshFileTree();
        } catch (err) {
          this._showNotification('Failed to save: ' + err.message, 'error');
        }
      }
    });
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
    this._showNotification(msg, 'info');
  }

  _showNotification(message, type = 'info') {
    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
      this._notificationTimer = null;
    }

    this.state.set('notification', { message, type });
    this._render();

    this._notificationTimer = setTimeout(() => {
      this.state.set('notification', null);
      this._notificationTimer = null;
      this._render();
    }, 2500);
  }

  _truncatePath(fullPath, maxLength = 60) {
    if (fullPath.length <= maxLength) return fullPath;
    const parts = fullPath.split(path.sep);
    if (parts.length <= 3) return fullPath;
    return `${parts[0]}${path.sep}...${path.sep}${parts[parts.length - 1]}`;
  }

  _showInputDialog(dialog) {
    const initialValue = dialog.value || '';
    
    logger.debug('dialog', 'Opening input dialog', {
      title: dialog.title,
      prompt: dialog.prompt,
      value: initialValue,
      hint: dialog.hint,
      baseDir: dialog.baseDir
    });
    
    this.state.set('inputDialog', {
      title: dialog.title || 'Input',
      prompt: dialog.prompt || '',
      value: initialValue,
      cursorPos: initialValue.length,
      hint: dialog.hint || '',
      baseDir: dialog.baseDir || null,
      callback: dialog.callback,
    });
    this._render();
  }

  _resolveInputDialog(value) {
    const dialog = this.state.get('inputDialog');
    
    logger.debug('dialog', 'Resolving dialog', {
      value: value,
      hasCallback: !!(dialog && dialog.callback),
      dialogState: dialog
    });
    
    this.state.set('inputDialog', null);
    this._render();
    if (dialog && dialog.callback) {
      logger.debug('dialog', 'Calling callback with value', { value: value });
      dialog.callback(value);
    }
  }

  _promptNewFile(baseDir) {
    const folder = baseDir || this.state.get('workingDirectory') || process.cwd();
    const defaultFilename = 'new-file.txt';
    
    logger.debug('file', 'Prompting for new file', {
      folder: folder,
      defaultFilename: defaultFilename
    });
    
    this._showInputDialog({
      title: 'New File',
      prompt: 'Enter filename:',
      value: defaultFilename,
      hint: `Creating in: ${this._truncatePath(folder)}`,
      baseDir: folder,
      callback: async (filename) => {
        logger.debug('file', 'New file callback received', {
          filename: filename,
          filenameType: typeof filename,
          filenameLength: filename ? filename.length : 0
        });
        
        if (!filename) {
          logger.debug('file', 'No filename provided, aborting');
          return;
        }
        
        const filePath = path.join(folder, filename);
        
        logger.debug('file', 'Creating new file', {
          filename: filename,
          folder: folder,
          filePath: filePath
        });
        
        try {
          await writeFile(filePath, '');
          logger.debug('file', 'File created successfully', { filePath: filePath });
          await this.openFile(filePath);
          this.state.set('focus', 'editor');
          this._showNotification('Created ' + filePath, 'success');
          this._refreshFileTree();
          this._render();
        } catch (err) {
          logger.error('file', 'Failed to create file', {
            filePath: filePath,
            error: err.message,
            errorCode: err.code
          });
          this._showNotification('Failed to create file: ' + err.message, 'error');
        }
      }
    });
  }

  _promptNewFolder(baseDir) {
    const folder = baseDir || this.state.get('workingDirectory') || process.cwd();
    const defaultFoldername = 'new-folder';
    this._showInputDialog({
      title: 'New Folder',
      prompt: 'Enter folder name:',
      value: defaultFoldername,
      hint: `Creating in: ${this._truncatePath(folder)}`,
      baseDir: folder,
      callback: async (foldername) => {
        if (!foldername) return;
        const folderPath = path.join(folder, foldername);
        try {
          await fs.mkdir(folderPath, { recursive: true });
          this._showNotification('Created folder ' + folderPath, 'success');
          this._refreshFileTree();
        } catch (err) {
          this._showNotification('Failed to create folder: ' + err.message, 'error');
        }
      }
    });
  }

  _renameActiveTabFile() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.filePath) {
      this._showNotification('No saved file to rename', 'error');
      return;
    }

    const oldPath = tab.filePath;
    const folder = path.dirname(oldPath);
    const currentFilename = path.basename(oldPath);

    this._showInputDialog({
      title: 'Rename File',
      prompt: 'Enter new filename:',
      value: currentFilename,
      hint: `Renaming in: ${this._truncatePath(folder)}`,
      baseDir: folder,
      callback: async (newFilename) => {
        if (!newFilename || newFilename === currentFilename) return;
        const newPath = path.join(folder, newFilename);
        try {
          await fs.rename(oldPath, newPath);
          tab.filePath = newPath;
          this._showNotification('Renamed to ' + newPath, 'success');
          this._refreshFileTree();
          this._render();
        } catch (err) {
          this._showNotification('Rename failed: ' + err.message, 'error');
        }
      }
    });
  }

  _deleteActiveTabFile() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.filePath) {
      this._showNotification('No saved file to delete', 'error');
      return;
    }

    const targetPath = tab.filePath;
    this.state.set('confirmDialog', {
      title: 'Delete File',
      message: `Delete ${targetPath}?`,
      buttons: ['Delete', 'Cancel'],
      callback: async (buttonIndex) => {
        this.state.set('confirmDialog', null);
        if (buttonIndex !== 0) {
          this._render();
          return;
        }
        try {
          await fs.rm(targetPath, { force: true });
          this._performCloseTab(this.activeTabIndex);
          this._showNotification('Deleted ' + targetPath, 'success');
          this._refreshFileTree();
        } catch (err) {
          this._showNotification('Delete failed: ' + err.message, 'error');
          this._render();
        }
      }
    });
    this._render();
  }

  _renameExplorerItem(selectedFile) {
    if (!selectedFile) return;
    const currentPath = selectedFile.path;
    this._showInputDialog({
      title: 'Rename',
      prompt: 'Enter new full path:',
      value: currentPath,
      callback: async (newPath) => {
        if (!newPath || newPath === currentPath) return;
        try {
          await fs.rename(currentPath, newPath);
          for (const tab of this.tabs) {
            if (tab.filePath === currentPath) {
              tab.filePath = newPath;
            }
          }
          this._showNotification('Renamed to ' + newPath, 'success');
          this._refreshFileTree();
          this._render();
        } catch (err) {
          this._showNotification('Rename failed: ' + err.message, 'error');
        }
      }
    });
  }

  _deleteExplorerItem(selectedFile) {
    if (!selectedFile) return;
    const targetPath = selectedFile.path;
    this.state.set('confirmDialog', {
      title: selectedFile.isDirectory ? 'Delete Folder' : 'Delete File',
      message: `Delete ${targetPath}?`,
      buttons: ['Delete', 'Cancel'],
      callback: async (buttonIndex) => {
        this.state.set('confirmDialog', null);
        if (buttonIndex !== 0) {
          this._render();
          return;
        }
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
          this.tabs = this.tabs.filter(t => t.filePath !== targetPath);
          if (this.activeTabIndex >= this.tabs.length) {
            this.activeTabIndex = Math.max(0, this.tabs.length - 1);
          }
          this._showNotification('Deleted ' + targetPath, 'success');
          this._refreshFileTree();
          this._render();
        } catch (err) {
          this._showNotification('Delete failed: ' + err.message, 'error');
          this._render();
        }
      }
    });
    this._render();
  }

  _refreshFileTree() {
    if (!this.fileTree) return;
    this.fileTree.load().then(() => {
      this.state.set('fileTree', this.fileTree.getVisibleNodes());
      this._render();
    }).catch(() => {
    });
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
    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
      this._notificationTimer = null;
    }
    
    if (this._cursorBlinkTimer) {
      clearInterval(this._cursorBlinkTimer);
      this._cursorBlinkTimer = null;
    }
    
    if (this._cursorPauseTimer) {
      clearTimeout(this._cursorPauseTimer);
      this._cursorPauseTimer = null;
    }
    
    process.exit(0);
  }
}

module.exports = App;
