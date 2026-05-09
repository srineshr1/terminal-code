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
const { readFile, readFileRaw, writeFile, fileExists } = require('./files/fileSystem');
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
      const next = !currentVisible;
      this.state.set('cursorVisible', next);
      this._renderCursorOnly(next);
    }, this.CURSOR_BLINK_INTERVAL);
  }

  _stopCursorBlink() {
    if (this._cursorBlinkTimer) {
      clearInterval(this._cursorBlinkTimer);
      this._cursorBlinkTimer = null;
    }
    this.state.set('cursorVisible', true);
    this._renderCursorOnly(true);
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

  _renderCursorOnly(visible) {
    if (!this.renderer || typeof this.renderer.setCursorVisible !== 'function') {
      this._render();
      return;
    }
    if (this.state.get('focus') !== 'editor') {
      this.renderer.setCursorVisible(false, null);
      return;
    }
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.buffer) {
      this.renderer.setCursorVisible(false, null);
      return;
    }
    this.renderer.setCursorVisible(visible, tab.buffer);
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
    this.state.set('fileTreeScrollOffset', 0);
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
    
    if (key.ctrl && !key.shift && !key.alt && keyName === 'f') {
      this._promptSearch();
      return;
    }
    if (key.ctrl && !key.shift && !key.alt && keyName === 'h') {
      this._promptReplace();
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

    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'a') {
      tab.buffer.selectAll();
      this._render();
      return;
    }

    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'l') {
      tab.buffer.selectLine();
      this._render();
      return;
    }

    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'c') {
      this._doCopy(tab);
      return;
    }
    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'x') {
      if (!tab.readOnly) this._doCut(tab);
      return;
    }
    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'v') {
      if (!tab.readOnly) this._doPaste(tab);
      return;
    }
    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'z') {
      if (tab.history) { tab.history.undo(); tab.modified = true; this._render(); }
      return;
    }
    if (focus === 'editor' && key.ctrl && !key.alt && (keyName === 'y' || (key.shift && keyName === 'z'))) {
      if (tab.history) { tab.history.redo(); tab.modified = true; this._render(); }
      return;
    }
    if (focus === 'editor' && key.ctrl && !key.shift && !key.alt && keyName === 'g') {
      this._promptGotoLine();
      return;
    }
    if (focus === 'editor' && keyName === 'escape' && tab.buffer && tab.buffer.hasMultipleCursors && tab.buffer.hasMultipleCursors()) {
      tab.buffer.clearExtraCursors();
      this._render();
      return;
    }
    
    // Editor input (only when focus is on editor)
    if (focus === 'editor') {
      if (tab.readOnly) {
        if (keyName === 'up' || keyName === 'down' || keyName === 'left' || keyName === 'right' ||
            keyName === 'home' || keyName === 'end' || keyName === 'pageup' || keyName === 'pagedown') {
          // allow navigation
        } else {
          return;
        }
      }
      const editorH = this.renderer.getDimensions().height - 3;
      const buf = tab.buffer;

      if (key.alt && !key.ctrl && (keyName === 'up' || keyName === 'down')) {
        this._saveHistory(tab);
        if (key.shift) {
          if (keyName === 'down') this._duplicateLineDown(buf);
          else this._duplicateLineUp(buf);
        } else {
          if (keyName === 'down') buf.moveLineDown();
          else buf.moveLineUp();
        }
        tab.modified = true;
        this._ensureCursorVisible(buf, editorH);
        this._render();
        return;
      }

      if (key.ctrl && key.shift && !key.alt && keyName === 'k') {
        this._saveHistory(tab);
        buf.deleteLine();
        tab.modified = true;
        this._ensureCursorVisible(buf, editorH);
        this._render();
        return;
      }

      if (key.ctrl && !key.shift && !key.alt && keyName === '/') {
        this._saveHistory(tab);
        this._toggleLineComment(tab);
        tab.modified = true;
        this._render();
        return;
      }

      if (key.ctrl && !key.shift && !key.alt && (keyName === ']' || keyName === '[')) {
        this._saveHistory(tab);
        if (keyName === ']') buf.indent();
        else buf.outdent();
        tab.modified = true;
        this._render();
        return;
      }

      if (keyName === 'return') {
        this._saveHistory(tab);
        if (this._handleEnterAutoIndent(buf)) {
          // handled
        } else {
          buf.insert('\n');
        }
        tab.modified = true;
        this._resetCursorBlink();
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'backspace') {
        this._saveHistory(tab);
        this._multiBackspace(buf);
        tab.modified = true;
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'delete') {
        this._saveHistory(tab);
        this._multiDelete(buf);
        tab.modified = true;
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'tab') {
        this._saveHistory(tab);
        if (buf.selection && buf.selection.anchor.line !== buf.selection.head.line) {
          if (key.shift) buf.outdent();
          else buf.indent();
        } else if (key.shift) {
          buf.outdent();
        } else {
          buf.insert('  ');
        }
        tab.modified = true;
        this._resetCursorBlink();
        this._render();
      } else if (keyName === 'left') {
        if (key.shift && key.ctrl) buf.extendSelectionWordLeft();
        else if (key.shift) buf.extendSelection(-1, 0);
        else if (key.ctrl) buf.moveWordLeft();
        else buf.moveCursor(-1, 0);
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'right') {
        if (key.shift && key.ctrl) buf.extendSelectionWordRight();
        else if (key.shift) buf.extendSelection(1, 0);
        else if (key.ctrl) buf.moveWordRight();
        else buf.moveCursor(1, 0);
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'up') {
        if (key.ctrl && key.alt) {
          this._addCursorAt(buf, Math.max(0, buf.cursor.line - 1), buf.cursor.col);
        } else if (key.shift) {
          buf.extendSelection(0, -1);
        } else {
          buf.moveCursor(0, -1);
        }
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'down') {
        if (key.ctrl && key.alt) {
          this._addCursorAt(buf, Math.min(buf.lines.length - 1, buf.cursor.line + 1), buf.cursor.col);
        } else if (key.shift) {
          buf.extendSelection(0, 1);
        } else {
          buf.moveCursor(0, 1);
        }
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'home') {
        if (key.shift) buf.extendSelectionToLineStart();
        else buf.moveToLineStart();
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'end') {
        if (key.shift) buf.extendSelectionToLineEnd();
        else buf.moveToLineEnd();
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'pageup') {
        if (key.shift) {
          for (let i = 0; i < 10; i++) buf.extendSelection(0, -1);
        } else {
          buf.moveCursor(0, -10);
        }
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'pagedown') {
        if (key.shift) {
          for (let i = 0; i < 10; i++) buf.extendSelection(0, 1);
        } else {
          buf.moveCursor(0, 10);
        }
        this._ensureCursorVisible(buf, editorH);
        this._render();
      } else if (keyName === 'f3') {
        if (key.shift) this.executeAction('search.prev');
        else this.executeAction('search.next');
        return;
      } else if (key.ctrl && !key.shift && !key.alt && keyName === 'd') {
        this._addNextOccurrence(tab);
        return;
      } else if ((ch && ch.length === 1) || (rawKeyName && rawKeyName.length === 1 && !key.ctrl && !key.alt)) {
        const charToInsert = (ch && ch.length === 1) ? ch : rawKeyName;
        this._saveHistory(tab, 'typing');
        if (buf.extraCursors.length === 0 && this._handleAutoPair(buf, charToInsert)) {
          // handled
        } else {
          this._multiInsert(buf, charToInsert);
        }
        tab.modified = true;
        this._resetCursorBlink();
        this._render();
      }
    }
    
    // Explorer navigation
    if (focus === 'explorer') {
      const selectedIndex = this.state.get('selectedFileIndex');
      const fileTree = this.state.get('fileTree');

      if (keyName === 'up') {
        const next = Math.max(0, selectedIndex - 1);
        this.state.set('selectedFileIndex', next);
        this._ensureSidebarSelectionVisible(next);
        this._render();
      } else if (keyName === 'down') {
        const next = Math.min(fileTree.length - 1, selectedIndex + 1);
        this.state.set('selectedFileIndex', next);
        this._ensureSidebarSelectionVisible(next);
        this._render();
      } else if (keyName === 'pageup') {
        const visible = this._sidebarVisibleHeight();
        const next = Math.max(0, selectedIndex - visible);
        this.state.set('selectedFileIndex', next);
        this._ensureSidebarSelectionVisible(next);
        this._render();
      } else if (keyName === 'pagedown') {
        const visible = this._sidebarVisibleHeight();
        const next = Math.min(fileTree.length - 1, selectedIndex + visible);
        this.state.set('selectedFileIndex', next);
        this._ensureSidebarSelectionVisible(next);
        this._render();
      } else if (keyName === 'home') {
        this.state.set('selectedFileIndex', 0);
        this.state.set('fileTreeScrollOffset', 0);
        this._render();
      } else if (keyName === 'end') {
        const last = Math.max(0, fileTree.length - 1);
        this.state.set('selectedFileIndex', last);
        this._ensureSidebarSelectionVisible(last);
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
      case 'sidebar_scroll':
        {
          const fileTree = this.state.get('fileTree') || [];
          const visible = this._sidebarVisibleHeight();
          const maxOffset = Math.max(0, fileTree.length - visible);
          const cur = this.state.get('fileTreeScrollOffset') || 0;
          const next = Math.max(0, Math.min(maxOffset, cur + data));
          this.state.set('fileTreeScrollOffset', next);
          this._render();
        }
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
      case 'editor_drag_start':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            const b = tab.buffer;
            b.cursor.line = data.line;
            b.cursor.col = data.col;
            b.selection = { anchor: { line: data.line, col: data.col }, head: { line: data.line, col: data.col } };
            b.clearExtraCursors && b.clearExtraCursors();
            this._dragAnchorRange = null;
            this.state.set('focus', 'editor');
            this._render();
          }
        }
        break;
      case 'editor_drag_move':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            const b = tab.buffer;
            if (data.mode === 'word' && this._dragAnchorRange) {
              this._extendDragRangeWord(b, data.line, data.col);
            } else if (data.mode === 'line' && this._dragAnchorRange) {
              this._extendDragRangeLine(b, data.line);
            } else {
              b.extendSelectionTo(data.line, data.col);
            }
            this._ensureCursorVisible(b, this.renderer.getDimensions().height - 3);
            this._render();
          }
        }
        break;
      case 'editor_drag_end':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            const b = tab.buffer;
            // Always extend to release position in case terminal didn't emit mousemove events
            if (b.selection) {
              b.extendSelectionTo(data.line, data.col);
            }
            if (b.selection && b.selection.anchor.line === b.selection.head.line && b.selection.anchor.col === b.selection.head.col) {
              b.clearSelection();
            }
            this._dragAnchorRange = null;
            this._render();
          }
        }
        break;
      case 'editor_shift_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            tab.buffer.extendSelectionTo(data.line, data.col);
            this._render();
          }
        }
        break;
      case 'editor_ctrl_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            this._addCursorAt(tab.buffer, data.line, data.col);
            this._render();
          }
        }
        break;
      case 'editor_double_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            tab.buffer.selectWordAt(data.line, data.col);
            const r = tab.buffer.getSelectionRange();
            this._dragAnchorRange = r ? { mode: 'word', start: { ...r.start }, end: { ...r.end } } : null;
            this._render();
          }
        }
        break;
      case 'editor_triple_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            tab.buffer.selectLine(data.line);
            const lineLen = (tab.buffer.lines[data.line] || '').length;
            this._dragAnchorRange = { mode: 'line', start: { line: data.line, col: 0 }, end: { line: data.line, col: lineLen } };
            this._render();
          }
        }
        break;
      case 'gutter_click':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            tab.buffer.selectLine(data.line);
            this._render();
          }
        }
        break;
      case 'gutter_drag':
        {
          const tab = this.tabs[this.activeTabIndex];
          if (tab && tab.buffer) {
            const b = tab.buffer;
            const startLine = data.startLine;
            const endLine = data.line;
            const lo = Math.min(startLine, endLine);
            const hi = Math.max(startLine, endLine);
            const endLen = (b.lines[hi] || '').length;
            b.setSelection(lo, 0, hi, endLen);
            b.cursor.line = endLine;
            b.cursor.col = endLine === hi ? endLen : 0;
            this._render();
          }
        }
        break;
    }
  }

  _saveHistory(tab, reason) {
    if (!tab || !tab.history) return;
    const now = Date.now();
    if (reason === 'typing' && tab._lastHistorySaveAt && (now - tab._lastHistorySaveAt) < 500) {
      return;
    }
    tab.history.save();
    tab._lastHistorySaveAt = now;
  }

  _doCopy(tab) {
    const buf = tab.buffer;
    let text = buf.getSelectedText();
    if (!text) {
      const line = buf.lines[buf.cursor.line] || '';
      text = line + '\n';
    }
    this.clipboard.copy(text);
    this._showNotification('Copied', 'info');
  }

  _doCut(tab) {
    const buf = tab.buffer;
    this._saveHistory(tab);
    if (buf.selection) {
      const text = buf.getSelectedText();
      this.clipboard.cut(text);
      buf.deleteSelection();
    } else {
      const line = buf.lines[buf.cursor.line] || '';
      this.clipboard.cut(line + '\n');
      buf.deleteLine();
    }
    tab.modified = true;
    this._render();
  }

  _doPaste(tab) {
    const text = this.clipboard.paste();
    if (!text) return;
    this._saveHistory(tab);
    tab.buffer.insert(text);
    tab.modified = true;
    this._render();
  }

  _handleAutoPair(buffer, ch) {
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    const closes = new Set([')', ']', '}', '"', "'", '`']);
    if (buffer.selection) return false;
    const line = buffer.lines[buffer.cursor.line] || '';
    const next = line[buffer.cursor.col];
    // Skip-close: typing close char that already exists
    if (closes.has(ch) && next === ch) {
      buffer.cursor.col++;
      return true;
    }
    if (pairs[ch]) {
      const close = pairs[ch];
      // Don't auto-pair quotes when already inside word
      if ((ch === '"' || ch === "'" || ch === '`')) {
        const prev = line[buffer.cursor.col - 1];
        if (prev && /\w/.test(prev)) return false;
      }
      buffer.insert(ch + close);
      buffer.cursor.col--;
      return true;
    }
    return false;
  }

  _handleEnterAutoIndent(buffer) {
    if (buffer.selection) return false;
    if (buffer.extraCursors && buffer.extraCursors.length) return false;
    const line = buffer.lines[buffer.cursor.line] || '';
    const before = line.slice(0, buffer.cursor.col);
    const after = line.slice(buffer.cursor.col);
    const indentMatch = before.match(/^[\t ]*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const trimmed = before.trimEnd();
    const last = trimmed[trimmed.length - 1];
    let extra = '';
    if (last === '{' || last === '[' || last === '(' || last === ':') {
      extra = '  ';
    }
    if (extra && (after.startsWith('}') || after.startsWith(']') || after.startsWith(')'))) {
      // place close on its own indented line
      buffer.lines[buffer.cursor.line] = before;
      buffer.lines.splice(buffer.cursor.line + 1, 0, indent + extra);
      buffer.lines.splice(buffer.cursor.line + 2, 0, indent + after);
      buffer.cursor.line++;
      buffer.cursor.col = (indent + extra).length;
      return true;
    }
    if (extra) {
      buffer.lines[buffer.cursor.line] = before;
      buffer.lines.splice(buffer.cursor.line + 1, 0, indent + extra + after);
      buffer.cursor.line++;
      buffer.cursor.col = (indent + extra).length;
      return true;
    }
    return false;
  }

  _toggleLineComment(tab) {
    const Syntax = require('./editor/Syntax');
    const lang = Syntax.getLanguage(tab.filePath) || 'javascript';
    const langDef = (Syntax.languages && Syntax.languages[lang]) || null;
    const token = (langDef && langDef.lineComment) ? langDef.lineComment : '//';
    const buf = tab.buffer;
    let startLine, endLine;
    if (buf.selection) {
      const r = buf.getSelectionRange();
      startLine = r.start.line;
      endLine = r.end.line;
    } else {
      startLine = endLine = buf.cursor.line;
    }
    let allCommented = true;
    for (let i = startLine; i <= endLine; i++) {
      const t = (buf.lines[i] || '').trimStart();
      if (t.length === 0) continue;
      if (!t.startsWith(token)) { allCommented = false; break; }
    }
    for (let i = startLine; i <= endLine; i++) {
      const ln = buf.lines[i] || '';
      const idx = ln.search(/\S/);
      if (idx === -1) continue;
      if (allCommented) {
        const after = ln.slice(idx);
        if (after.startsWith(token + ' ')) {
          buf.lines[i] = ln.slice(0, idx) + after.slice(token.length + 1);
        } else if (after.startsWith(token)) {
          buf.lines[i] = ln.slice(0, idx) + after.slice(token.length);
        }
      } else {
        buf.lines[i] = ln.slice(0, idx) + token + ' ' + ln.slice(idx);
      }
    }
  }

  _duplicateLineDown(buffer) {
    if (buffer.selection) {
      const r = buffer.getSelectionRange();
      const block = [];
      for (let i = r.start.line; i <= r.end.line; i++) block.push(buffer.lines[i]);
      buffer.lines.splice(r.end.line + 1, 0, ...block);
      buffer.cursor.line += block.length;
    } else {
      const ln = buffer.lines[buffer.cursor.line];
      buffer.lines.splice(buffer.cursor.line + 1, 0, ln);
      buffer.cursor.line++;
    }
  }

  _duplicateLineUp(buffer) {
    if (buffer.selection) {
      const r = buffer.getSelectionRange();
      const block = [];
      for (let i = r.start.line; i <= r.end.line; i++) block.push(buffer.lines[i]);
      buffer.lines.splice(r.start.line, 0, ...block);
    } else {
      const ln = buffer.lines[buffer.cursor.line];
      buffer.lines.splice(buffer.cursor.line, 0, ln);
    }
  }

  _addNextOccurrence(tab) {
    const buf = tab.buffer;
    let needle = buf.getSelectedText();
    if (!needle) {
      buf.selectWordAt(buf.cursor.line, buf.cursor.col);
      needle = buf.getSelectedText();
      if (!needle) return;
      this._render();
      return;
    }
    const startLine = buf.cursor.line;
    const startCol = buf.cursor.col;
    for (let l = startLine; l < buf.lines.length; l++) {
      const text = buf.lines[l];
      const from = (l === startLine) ? startCol : 0;
      const idx = text.indexOf(needle, from);
      if (idx >= 0) {
        this._addCursorAt(buf, l, idx + needle.length);
        const ec = buf.extraCursors[buf.extraCursors.length - 1];
        ec.selection = { anchor: { line: l, col: idx }, head: { line: l, col: idx + needle.length } };
        ec.cursor = { line: l, col: idx + needle.length };
        this._render();
        return;
      }
    }
  }

  _promptGotoLine() {
    this._showInputDialog({
      title: 'Go to Line',
      prompt: 'line:col',
      value: '',
      hint: 'Enter line number, or line:col',
      callback: (v) => {
        if (!v) return;
        const m = v.trim().match(/^(\d+)(?::(\d+))?$/);
        if (!m) return;
        const tab = this.tabs[this.activeTabIndex];
        if (!tab || !tab.buffer) return;
        const line = Math.max(0, Math.min(tab.buffer.lines.length - 1, parseInt(m[1], 10) - 1));
        const col = m[2] ? Math.max(0, parseInt(m[2], 10) - 1) : 0;
        tab.buffer.setCursor(line, col);
        this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
        this._render();
      }
    });
  }

  _allCursorsForEdit(buffer) {
    const list = [{ kind: 'primary' }];
    for (let i = 0; i < buffer.extraCursors.length; i++) list.push({ kind: 'extra', index: i });
    list.sort((a, b) => {
      const ca = a.kind === 'primary' ? buffer.cursor : buffer.extraCursors[a.index].cursor;
      const cb = b.kind === 'primary' ? buffer.cursor : buffer.extraCursors[b.index].cursor;
      if (ca.line !== cb.line) return cb.line - ca.line;
      return cb.col - ca.col;
    });
    return list;
  }

  _swapCursorWithExtra(buffer, idx) {
    const ec = buffer.extraCursors[idx];
    const pc = buffer.cursor;
    const ps = buffer.selection;
    buffer.cursor = ec.cursor;
    buffer.selection = ec.selection;
    buffer.extraCursors[idx] = { cursor: pc, selection: ps };
  }

  _multiInsert(buffer, text) {
    if (!buffer.extraCursors.length) {
      buffer.insert(text);
      return;
    }
    const order = this._allCursorsForEdit(buffer);
    for (const slot of order) {
      if (slot.kind === 'primary') {
        buffer.insert(text);
      } else {
        this._swapCursorWithExtra(buffer, slot.index);
        buffer.insert(text);
        this._swapCursorWithExtra(buffer, slot.index);
      }
    }
  }

  _multiBackspace(buffer) {
    if (!buffer.extraCursors.length) {
      buffer.backspace();
      return;
    }
    const order = this._allCursorsForEdit(buffer);
    for (const slot of order) {
      if (slot.kind === 'primary') {
        buffer.backspace();
      } else {
        this._swapCursorWithExtra(buffer, slot.index);
        buffer.backspace();
        this._swapCursorWithExtra(buffer, slot.index);
      }
    }
  }

  _multiDelete(buffer) {
    if (!buffer.extraCursors.length) {
      buffer.delete();
      return;
    }
    const order = this._allCursorsForEdit(buffer);
    for (const slot of order) {
      if (slot.kind === 'primary') {
        buffer.delete();
      } else {
        this._swapCursorWithExtra(buffer, slot.index);
        buffer.delete();
        this._swapCursorWithExtra(buffer, slot.index);
      }
    }
  }

  _wordRangeAt(buffer, line, col) {
    const text = buffer.lines[line] || '';
    const isWord = (c) => /[A-Za-z0-9_]/.test(c || '');
    if (text.length === 0) return { line, startCol: 0, endCol: 0 };
    let s = Math.min(col, text.length - 1);
    let e = s;
    if (!isWord(text[s])) return { line, startCol: s, endCol: Math.min(text.length, s + 1) };
    while (s > 0 && isWord(text[s - 1])) s--;
    while (e < text.length && isWord(text[e])) e++;
    return { line, startCol: s, endCol: e };
  }

  _cmpPos(a, b) {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  _extendDragRangeWord(buffer, line, col) {
    const anchor = this._dragAnchorRange;
    if (!anchor) return;
    const cur = this._wordRangeAt(buffer, line, col);
    const aStart = anchor.start, aEnd = anchor.end;
    const cStart = { line, col: cur.startCol };
    const cEnd = { line, col: cur.endCol };
    let head, tail;
    if (this._cmpPos(cStart, aStart) < 0) {
      head = cStart;
      tail = aEnd;
      buffer.setSelection(tail.line, tail.col, head.line, head.col);
    } else {
      head = aStart;
      tail = cEnd;
      buffer.setSelection(head.line, head.col, tail.line, tail.col);
    }
    buffer.cursor.line = buffer.selection.head.line;
    buffer.cursor.col = buffer.selection.head.col;
  }

  _extendDragRangeLine(buffer, line) {
    const anchor = this._dragAnchorRange;
    if (!anchor) return;
    const aLine = anchor.start.line;
    const lo = Math.min(aLine, line);
    const hi = Math.max(aLine, line);
    const endLen = (buffer.lines[hi] || '').length;
    if (line < aLine) {
      buffer.setSelection(hi, endLen, lo, 0);
    } else {
      buffer.setSelection(lo, 0, hi, endLen);
    }
    buffer.cursor.line = buffer.selection.head.line;
    buffer.cursor.col = buffer.selection.head.col;
  }

  _findBracketMatch(buffer) {
    if (!buffer || !buffer.lines) return null;
    const opens = '([{';
    const closes = ')]}';
    const pairOf = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
    const ln = buffer.cursor.line;
    const col = buffer.cursor.col;
    const text = buffer.lines[ln] || '';
    let here = text[col];
    let usedCol = col;
    let dir = 0;
    if (here && opens.includes(here)) dir = 1;
    else if (here && closes.includes(here)) dir = -1;
    else {
      const prev = col > 0 ? text[col - 1] : null;
      if (prev && opens.includes(prev)) { here = prev; usedCol = col - 1; dir = 1; }
      else if (prev && closes.includes(prev)) { here = prev; usedCol = col - 1; dir = -1; }
    }
    if (!dir) return null;
    const want = pairOf[here];
    let depth = 1;
    if (dir === 1) {
      let l = ln, c = usedCol + 1;
      while (l < buffer.lines.length) {
        const t = buffer.lines[l];
        for (; c < t.length; c++) {
          const ch = t[c];
          if (ch === here) depth++;
          else if (ch === want) { depth--; if (depth === 0) return [{ line: ln, col: usedCol }, { line: l, col: c }]; }
        }
        l++; c = 0;
      }
    } else {
      let l = ln, c = usedCol - 1;
      while (l >= 0) {
        const t = buffer.lines[l] || '';
        if (c >= t.length) c = t.length - 1;
        for (; c >= 0; c--) {
          const ch = t[c];
          if (ch === here) depth++;
          else if (ch === want) { depth--; if (depth === 0) return [{ line: ln, col: usedCol }, { line: l, col: c }]; }
        }
        l--; c = (l >= 0 ? (buffer.lines[l] || '').length - 1 : -1);
      }
    }
    return null;
  }

  _addCursorAt(buffer, line, col) {
    const text = buffer.lines[line] || '';
    const c = Math.max(0, Math.min(col, text.length));
    if (buffer.cursor.line === line && buffer.cursor.col === c) return;
    for (const ec of buffer.extraCursors) {
      if (ec.cursor.line === line && ec.cursor.col === c) return;
    }
    buffer.extraCursors.push({ cursor: { line, col: c }, selection: null });
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
      buffer: buffer || null,
      fileTree: this.state.get('fileTree'),
      selectedFileIndex: this.state.get('selectedFileIndex'),
      fileTreeScrollOffset: this.state.get('fileTreeScrollOffset') || 0,
      showExplorer: this.state.get('sidebarVisible'),
      focus: this.state.get('focus'),
      searchMode: this.state.get('searchMode'),
      searchQuery: this.state.get('searchQuery'),
      replaceQuery: this.state.get('replaceQuery'),
      menuOpen: this.state.get('menuOpen'),
      searchMatches: this.state.get('searchMatches') || [],
      searchCurrentIndex: this.state.get('searchCurrentIndex') == null ? -1 : this.state.get('searchCurrentIndex'),
      bracketMatch: buffer ? this._findBracketMatch(buffer) : null,
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
        this._promptSearch();
        break;
      case 'next':
        this._stepSearch(1);
        break;
      case 'prev':
        this._stepSearch(-1);
        break;
    }
  }

  _promptSearch() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.buffer) return;
    const initial = this.state.get('searchQuery') || tab.buffer.getSelectedText() || '';
    this._showInputDialog({
      title: 'Find',
      prompt: 'Search query:',
      value: initial,
      hint: 'Enter to search · F3 next · Shift+F3 prev · Esc cancel',
      callback: (q) => {
        if (q == null) return;
        this.state.set('searchQuery', q);
        const matches = this.search.findAll(tab.buffer.lines, q);
        this.state.set('searchMatches', matches);
        this.state.set('searchCurrentIndex', matches.length ? 0 : -1);
        if (matches.length) {
          const m = matches[0];
          tab.buffer.setCursor(m.line, m.startCol);
          tab.buffer.setSelection(m.line, m.startCol, m.line, m.endCol);
          this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
          this._showNotification(`${matches.length} match${matches.length === 1 ? '' : 'es'}`, 'info');
        } else {
          this._showNotification('No matches', 'info');
        }
        this._render();
      }
    });
  }

  _promptReplace() {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.buffer) return;
    if (tab.readOnly) { this._showNotification('Read-only file', 'error'); return; }
    const initial = this.state.get('searchQuery') || tab.buffer.getSelectedText() || '';
    this._showInputDialog({
      title: 'Replace — query',
      prompt: 'Search:',
      value: initial,
      callback: (q) => {
        if (!q) return;
        this._showInputDialog({
          title: 'Replace — replacement',
          prompt: 'Replace with:',
          value: '',
          callback: (r) => {
            if (r == null) return;
            this._saveHistory(tab);
            const n = this.search.replaceAll(tab.buffer, q, r);
            tab.modified = true;
            this.state.set('searchMatches', []);
            this.state.set('searchCurrentIndex', -1);
            this._showNotification(`Replaced ${n}`, 'info');
            this._render();
          }
        });
      }
    });
  }

  _stepSearch(dir) {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab || !tab.buffer) return;
    const matches = this.state.get('searchMatches') || [];
    if (matches.length === 0) {
      const q = this.state.get('searchQuery');
      if (!q) return;
      const fresh = this.search.findAll(tab.buffer.lines, q);
      if (!fresh.length) { this._showNotification('No matches', 'info'); return; }
      this.state.set('searchMatches', fresh);
      this.state.set('searchCurrentIndex', 0);
      const m = fresh[0];
      tab.buffer.setCursor(m.line, m.startCol);
      tab.buffer.setSelection(m.line, m.startCol, m.line, m.endCol);
      this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
      this._render();
      return;
    }
    const cur = this.state.get('searchCurrentIndex') || 0;
    const next = (cur + dir + matches.length) % matches.length;
    this.state.set('searchCurrentIndex', next);
    const m = matches[next];
    tab.buffer.setCursor(m.line, m.startCol);
    tab.buffer.setSelection(m.line, m.startCol, m.line, m.endCol);
    this._ensureCursorVisible(tab.buffer, this.renderer.getDimensions().height - 3);
    this._render();
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
  
  _sidebarVisibleHeight() {
    const dims = this.renderer ? this.renderer.getDimensions() : { height: 24 };
    const logoHeight = 4;
    return Math.max(1, dims.height - 2 - logoHeight);
  }

  _ensureSidebarSelectionVisible(index) {
    const visible = this._sidebarVisibleHeight();
    let offset = this.state.get('fileTreeScrollOffset') || 0;
    if (index < offset) offset = index;
    else if (index >= offset + visible) offset = index - visible + 1;
    const fileTree = this.state.get('fileTree') || [];
    const maxOffset = Math.max(0, fileTree.length - visible);
    offset = Math.max(0, Math.min(maxOffset, offset));
    this.state.set('fileTreeScrollOffset', offset);
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
      const raw = await readFileRaw(filePath);
      const info = this._classifyFile(filePath, raw);

      const buffer = new Buffer();
      let readOnly = false;

      if (info.kind === 'binary') {
        buffer.setLines(this._buildBinaryPreview(filePath, raw, info));
        readOnly = true;
      } else {
        const text = raw.toString('utf8');
        buffer.setLines(text.split('\n'));
      }

      const history = new History(buffer);
      history.save();

      this.tabs.push({
        buffer,
        history,
        filePath,
        modified: false,
        readOnly,
        kind: info.kind,
      });

      this.activeTabIndex = this.tabs.length - 1;
    } catch (err) {
      this._showNotification('Failed to open: ' + err.message, 'error');
    }
  }

  _classifyFile(filePath, raw) {
    const ext = (path.extname(filePath) || '').toLowerCase();
    const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.ico', '.heic', '.heif', '.avif', '.svg']);
    const audioExt = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus', '.wma']);
    const videoExt = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv', '.m4v', '.mpg', '.mpeg']);
    const archiveExt = new Set(['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar', '.xz', '.zst']);
    const binaryExt = new Set(['.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.pdf', '.psd', '.ai', '.sketch', '.class', '.o', '.obj', '.pyc', '.wasm', '.iso', '.img']);

    if (ext === '.svg') return { kind: 'text', subKind: 'svg' };

    let subKind = null;
    if (imageExt.has(ext)) subKind = 'image';
    else if (audioExt.has(ext)) subKind = 'audio';
    else if (videoExt.has(ext)) subKind = 'video';
    else if (archiveExt.has(ext)) subKind = 'archive';
    else if (binaryExt.has(ext)) subKind = 'binary';

    if (subKind) return { kind: 'binary', subKind, ext };

    const sample = raw.slice(0, Math.min(raw.length, 8192));
    let nullBytes = 0;
    let highBytes = 0;
    for (let i = 0; i < sample.length; i++) {
      const b = sample[i];
      if (b === 0) nullBytes++;
      else if (b > 127) highBytes++;
    }
    if (nullBytes > 0 && sample.length > 0) return { kind: 'binary', subKind: 'binary', ext };
    if (sample.length > 64 && highBytes / sample.length > 0.4) return { kind: 'binary', subKind: 'binary', ext };

    return { kind: 'text', ext };
  }

  _buildBinaryPreview(filePath, raw, info) {
    const labels = {
      image: 'Image file',
      audio: 'Audio file',
      video: 'Video file',
      archive: 'Archive',
      binary: 'Binary file',
    };
    const label = labels[info.subKind] || 'Binary file';
    const size = raw.length;
    const sizeStr = this._formatBytes(size);
    const ext = info.ext || path.extname(filePath) || '(none)';
    const name = path.basename(filePath);

    const inner = [
      '',
      '   ' + label,
      '',
      '   Name : ' + name,
      '   Type : ' + ext,
      '   Size : ' + sizeStr + '  (' + size + ' bytes)',
      '   Path : ' + filePath,
      '',
      '   This file is not previewable in the editor.',
      '   Open it with an external app to view contents.',
      '',
    ];
    const width = Math.max(...inner.map(l => l.length)) + 2;
    const top = '╭' + '─'.repeat(width) + '╮';
    const bot = '╰' + '─'.repeat(width) + '╯';
    const body = inner.map(l => '│ ' + l + ' '.repeat(Math.max(0, width - l.length - 1)) + '│');
    return ['', top, ...body, bot, ''];
  }

  _formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  
  _createNewTab(filePath) {
    const buffer = new Buffer();
    const history = new History(buffer);
    history.save();

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

    if (tab.readOnly) {
      this._showNotification('Cannot save: file is read-only', 'error');
      return;
    }

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
