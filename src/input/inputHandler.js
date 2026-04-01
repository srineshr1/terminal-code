/**
 * Input Handler - Main input router
 * Routes keyboard and mouse events to appropriate handlers
 */

'use strict';

const { parseKeyEvent, isPartialEscape, isMouseEvent } = require('./keyboard');
const { parseMouseEvent, isPartialMouseEvent, MouseEventType, MouseButton } = require('./mouse');
const { findKeybinding } = require('./keybindings');
const logger = require('../utils/logger');

/**
 * InputHandler class
 * Manages raw input parsing and event dispa
 */
class InputHandler {
  constructor(app) {
    this.app = app;
    this.inputBuffer = '';
    this.escapeTimeout = null;
    this.escapeDelay = 50; // ms to wait for escape sequences
    this.escapeCount = 0; // Track consecutive escapes for force exit
    
    // Mouse state for tracking drags
    this.mouseState = {
      isDragging: false,
      dragStartCol: 0,
      dragStartRow: 0,
      lastButton: null,
    };
  }
  
  /**
   * Process raw input data from stdin
   * @param {Buffer|string} data - Raw input
   */
  processInput(data) {
    const str = typeof data === 'string' ? data : data.toString('utf8');
    this.inputBuffer += str;
    
    // Clear any pending escape timeout
    if (this.escapeTimeout) {
      clearTimeout(this.escapeTimeout);
      this.escapeTimeout = null;
    }
    
    this._processBuffer();
  }
  
  /**
   * Process accumulated input buffer
   */
  _processBuffer() {
    while (this.inputBuffer.length > 0) {
      // Check for mouse events first (they can be long)
      if (isMouseEvent(this.inputBuffer)) {
        const consumed = this._tryParseMouseEvent();
        if (consumed > 0) {
          this.inputBuffer = this.inputBuffer.slice(consumed);
          continue;
        }
        // Might be partial mouse event
        if (isPartialMouseEvent(this.inputBuffer)) {
          this._waitForMore();
          return;
        }
      }
      
      // Check for escape sequences
      if (this.inputBuffer.startsWith('\x1b')) {
        // Try to parse as complete escape sequence
        const consumed = this._tryParseEscapeSequence();
        if (consumed > 0) {
          this.inputBuffer = this.inputBuffer.slice(consumed);
          continue;
        }
        
        // Might be partial escape sequence - wait for more
        if (isPartialEscape(this.inputBuffer)) {
          this._waitForMore();
          return;
        }
        
        // Single escape - process it
        if (this.inputBuffer === '\x1b') {
          this._waitForMore();
          return;
        }
      }
      
      // Process single character/key
      const event = parseKeyEvent(this.inputBuffer[0]);
      if (event) {
        this._dispatchKeyEvent(event);
      }
      this.inputBuffer = this.inputBuffer.slice(1);
    }
  }
  
  /**
   * Wait for more input (for partial escape sequences)
   */
  _waitForMore() {
    this.escapeTimeout = setTimeout(() => {
      // Timeout - process what we have
      if (this.inputBuffer.length > 0) {
        if (this.inputBuffer === '\x1b') {
          // Just escape key
          this._dispatchKeyEvent({
            key: 'Escape',
            ctrl: false,
            shift: false,
            alt: false,
            raw: '\x1b',
          });
          this.inputBuffer = '';
        } else {
          // Unknown sequence - try to process character by character
          const event = parseKeyEvent(this.inputBuffer);
          if (event) {
            this._dispatchKeyEvent(event);
            this.inputBuffer = '';
          } else {
            // Skip first character and continue
            this.inputBuffer = this.inputBuffer.slice(1);
            this._processBuffer();
          }
        }
      }
    }, this.escapeDelay);
  }
  
  /**
   * Try to parse a mouse event from the buffer
   * @returns {number} - Number of characters consumed, or 0
   */
  _tryParseMouseEvent() {
    // SGR mouse: ESC [ < ... M/m
    const sgrMatch = this.inputBuffer.match(/^(\x1b\[<\d+;\d+;\d+[Mm])/);
    if (sgrMatch) {
      const event = parseMouseEvent(sgrMatch[1]);
      if (event) {
        this._dispatchMouseEvent(event);
        return sgrMatch[1].length;
      }
    }
    
    // X10 mouse: ESC [ M <3 bytes>
    if (this.inputBuffer.startsWith('\x1b[M') && this.inputBuffer.length >= 6) {
      const seq = this.inputBuffer.slice(0, 6);
      const event = parseMouseEvent(seq);
      if (event) {
        this._dispatchMouseEvent(event);
        return 6;
      }
    }
    
    return 0;
  }
  
  /**
   * Try to parse an escape sequence from the buffer
   * @returns {number} - Number of characters consumed, or 0
   */
  _tryParseEscapeSequence() {
    // Try various escape sequence patterns
    const patterns = [
      // CSI with final byte
      /^(\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e])/,
      // CSI with tilde terminator
      /^(\x1b\[\d+(?:;\d+)*~)/,
      // SS3
      /^(\x1bO.)/,
      // Alt+key
      /^(\x1b.)/,
    ];
    
    for (const pattern of patterns) {
      const match = this.inputBuffer.match(pattern);
      if (match) {
        const event = parseKeyEvent(match[1]);
        if (event) {
          this._dispatchKeyEvent(event);
          return match[1].length;
        }
        // Even if we couldn't parse it, consume it
        return match[1].length;
      }
    }
    
    return 0;
  }
  
  /**
   * Dispatch a key event to the appropriate handler
   * @param {Object} event - Key event
   */
  _dispatchKeyEvent(event) {
    const state = this.app.state;
    const context = this._getContext();
    
    // Handle Escape key - close menus/search or force exit
    if (event.key === 'Escape') {
      logger.debug('input', 'Escape pressed', { menuOpen: state.get('menuOpen'), searchMode: state.get('searchMode') });
      
      if (state.get('menuOpen')) {
        this.app.closeMenu();
        logger.debug('input', 'Closed menu');
        return;
      }
      
      if (state.get('searchMode')) {
        state.set('searchMode', false);
        this.app.render();
        logger.debug('input', 'Closed search');
        return;
      }
      
      if (state.get('inputPrompt')) {
        state.set('inputPrompt', null);
        this.app.render();
        logger.debug('input', 'Closed prompt');
        return;
      }
      
      // Triple escape for force exit (3 escapes within 1 second)
      const now = Date.now();
      if (now - this.lastEscapeTime < 1000) {
        this.escapeCount++;
        if (this.escapeCount >= 2) {
          logger.info('input', 'Force exit triggered');
          this.app.forceExit();
          return;
        }
      } else {
        this.escapeCount = 0;
      }
      this.lastEscapeTime = now;
      
      logger.debug('input', 'Escape - no action to close');
      return;
    }
    
    // Special handling for menu
    if (state.get('menuOpen')) {
      if (this.app.handleMenuKey(event.key)) {
        return;
      }
    }
    
    // Special handling for search mode
    if (state.get('searchMode')) {
      if (this._handleSearchInput(event)) {
        return;
      }
    }
    
    // Special handling for input prompts (like go to line)
    if (state.get('inputPrompt')) {
      if (this._handlePromptInput(event)) {
        return;
      }
    }
    
    // Check for keybinding
    const binding = findKeybinding(event, context);
    if (binding) {
      this.app.executeAction(binding.action, binding.args);
      return;
    }
    
    // If no binding and it's a printable character, insert it
    if (context === 'editor' && this._isPrintable(event)) {
      this.app.executeAction('edit.insert', { char: event.key });
    }
  }
  
  /**
   * Dispatch a mouse event to the appropriate handler
   * @param {Object} event - Mouse event
   */
  _dispatchMouseEvent(event) {
    const { type, button, col, row, shift, ctrl } = event;
    
    // Update mouse state
    if (type === MouseEventType.DOWN) {
      this.mouseState.isDragging = true;
      this.mouseState.dragStartCol = col;
      this.mouseState.dragStartRow = row;
      this.mouseState.lastButton = button;
    } else if (type === MouseEventType.UP) {
      this.mouseState.isDragging = false;
    }
    
    // Handle scroll events
    if (type === MouseEventType.SCROLL) {
      const delta = button === MouseButton.SCROLL_UP ? -1 : 1;
      this.app.executeAction('scroll.lines', { delta, col, row });
      return;
    }
    
    // Handle mouse move for menu hover tracking (throttled)
    if (type === MouseEventType.MOVE && this.app.state.get('menuOpen')) {
      const now = Date.now();
      if (now - (this.lastMouseMoveTime || 0) < 100) {
        return; // Skip if less than 100ms since last update
      }
      this.lastMouseMoveTime = now;
      
      const hit = this.app.hitTestMenuOnly(col, row);
      
      // Only update hover if we're over a valid menu item (not separator, not undefined)
      if (hit && hit.area === 'menu-dropdown' && hit.itemIndex !== undefined && hit.itemIndex >= 0) {
        const menuDropdown = this.app.state.get('menuDropdown');
        if (menuDropdown && menuDropdown.items && menuDropdown.items[hit.itemIndex]) {
          const item = menuDropdown.items[hit.itemIndex];
          
          // Skip separators
          if (item.type === 'separator') {
            return;
          }
          
          const currentHover = this.app.state.get('menuHoverIndex');
          if (currentHover !== hit.itemIndex) {
            const oldHover = currentHover;
            this.app.state.set('menuHoverIndex', hit.itemIndex);
            this.app.updateMenuHover(oldHover, hit.itemIndex);
          }
        }
      }
      return;
    }
    
    // Handle menu clicks first
    if (type === MouseEventType.UP && this.app.state.get('menuOpen')) {
      if (this.app.handleMenuClick(col, row)) {
        return;
      }
    }
    
    // Check for menu bar click when not in menu mode
    if (type === MouseEventType.UP && !this.app.state.get('menuOpen')) {
      const hit = this.app.hitTest(col, row);
      if (hit && hit.area === 'menubar') {
        this.app.handleMenuClick(col, row);
        return;
      }
    }
    
    // Perform hit testing
    const hit = this.app.hitTest(col, row);
    if (!hit) return;
    
    switch (hit.area) {
      case 'menubar':
      case 'menu-dropdown':
        // Already handled above
        break;
      case 'tabbar':
        this._handleTabBarMouse(event, hit);
        break;
      case 'explorer':
        this._handleExplorerMouse(event, hit);
        break;
      case 'editor':
        this._handleEditorMouse(event, hit, shift);
        break;
      case 'editor-gutter':
        this._handleGutterMouse(event, hit);
        break;
      case 'statusbar':
        this._handleStatusBarMouse(event, hit);
        break;
      case 'search':
        this._handleSearchMouse(event, hit);
        break;
    }
  }
  
  /**
   * Handle mouse events on the tab bar
   */
  _handleTabBarMouse(event, hit) {
    if (event.type !== MouseEventType.DOWN) return;
    
    if (hit.tabIndex !== undefined) {
      if (event.button === MouseButton.LEFT) {
        // Select tab
        this.app.executeAction('tab.goto', { index: hit.tabIndex });
      } else if (event.button === MouseButton.MIDDLE) {
        // Close tab with middle click
        this.app.executeAction('tab.close', { index: hit.tabIndex });
      }
    } else if (hit.closeButton && hit.tabIndex !== undefined) {
      // Click on close button
      this.app.executeAction('tab.close', { index: hit.tabIndex });
    }
  }
  
  /**
   * Handle mouse events on the explorer
   */
  _handleExplorerMouse(event, hit) {
    const { type, button } = event;
    
    // Focus explorer on any click
    this.app.state.set('focus', 'explorer');
    
    if (hit.fileIndex === undefined) return;
    
    // Handle DOWN event - just record selection
    if (type === MouseEventType.DOWN && button === MouseButton.LEFT) {
      // Select the file/folder
      this.app.executeAction('explorer.select', { index: hit.fileIndex });
    }
    
    // Handle UP event - open/toggle if clicking on already-selected item
    if (type === MouseEventType.UP && button === MouseButton.LEFT) {
      const selectedIndex = this.app.state.get('selectedFileIndex');
      if (selectedIndex === hit.fileIndex) {
        // Clicking on the already-selected item - open/toggle it
        this.app.executeAction('explorer.open');
      }
    }
    
    // Right click - context menu (future feature)
    if (type === MouseEventType.DOWN && button === MouseButton.RIGHT) {
      this.app.executeAction('explorer.contextMenu', {
        index: hit.fileIndex,
        col: event.col,
        row: event.row,
      });
    }
  }
  
  /**
   * Handle mouse events on the editor area
   */
  _handleEditorMouse(event, hit, shift) {
    const { type, button } = event;
    
    // Focus editor
    this.app.state.set('focus', 'editor');
    
    if (type === MouseEventType.DOWN && button === MouseButton.LEFT) {
      if (shift) {
        // Shift+click extends selection
        this.app.executeAction('select.toPosition', { 
          line: hit.line, 
          col: hit.col,
        });
      } else {
        // Regular click positions cursor
        this.app.executeAction('cursor.setPosition', { 
          line: hit.line, 
          col: hit.col,
        });
      }
    } else if (type === MouseEventType.DRAG && button === MouseButton.LEFT) {
      // Drag extends selection
      this.app.executeAction('select.toPosition', { 
        line: hit.line, 
        col: hit.col,
      });
    } else if (type === MouseEventType.DOWN && button === MouseButton.RIGHT) {
      // Right click - context menu (future feature)
      this.app.executeAction('editor.contextMenu', {
        line: hit.line,
        col: hit.col,
        screenCol: event.col,
        screenRow: event.row,
      });
    }
  }
  
  /**
   * Handle mouse events on the gutter (line numbers)
   */
  _handleGutterMouse(event, hit) {
    if (event.type !== MouseEventType.DOWN) return;
    
    if (event.button === MouseButton.LEFT) {
      // Click on gutter selects entire line
      this.app.executeAction('select.line', { line: hit.line });
    }
  }
  
  /**
   * Handle mouse events on the status bar
   */
  _handleStatusBarMouse(event, hit) {
    if (event.type !== MouseEventType.DOWN) return;
    
    // Could handle clicks on status bar items
    // For now, just clicking anywhere on status bar does nothing special
  }
  
  /**
   * Handle mouse events on the search overlay
   */
  _handleSearchMouse(event, hit) {
    if (event.type !== MouseEventType.DOWN) return;
    
    if (hit.field === 'searchInput') {
      this.app.state.set('searchFocus', 'search');
    } else if (hit.field === 'replaceInput') {
      this.app.state.set('searchFocus', 'replace');
    } else if (hit.button) {
      // Handle search button clicks
      switch (hit.button) {
        case 'next':
          this.app.executeAction('search.next');
          break;
        case 'prev':
          this.app.executeAction('search.prev');
          break;
        case 'replace':
          this.app.executeAction('search.replace');
          break;
        case 'replaceAll':
          this.app.executeAction('search.replaceAll');
          break;
        case 'close':
          this.app.executeAction('search.close');
          break;
      }
    }
  }
  
  /**
   * Handle input in search mode
   * @returns {boolean} - True if handled
   */
  _handleSearchInput(event) {
    const { key, ctrl, shift, alt } = event;
    
    // Escape closes search
    if (key === 'Escape') {
      this.app.executeAction('search.close');
      return true;
    }
    
    // Enter finds next
    if (key === 'Enter' && !shift) {
      this.app.executeAction('search.next');
      return true;
    }
    
    // Shift+Enter finds previous
    if (key === 'Enter' && shift) {
      this.app.executeAction('search.prev');
      return true;
    }
    
    // Tab switches between search/replace fields
    if (key === 'Tab' && !ctrl && !alt) {
      this.app.executeAction('search.toggleFocus');
      return true;
    }
    
    // Let other keys through for text input
    if (this._isPrintable(event) || key === 'Backspace' || key === 'Delete') {
      const focus = this.app.state.get('searchFocus') || 'search';
      if (key === 'Backspace') {
        this.app.executeAction('search.backspace', { field: focus });
      } else if (key === 'Delete') {
        this.app.executeAction('search.delete', { field: focus });
      } else {
        this.app.executeAction('search.type', { char: key, field: focus });
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle input in prompt mode (e.g., "Go to line")
   * @returns {boolean} - True if handled
   */
  _handlePromptInput(event) {
    const { key, ctrl } = event;
    
    // Escape cancels
    if (key === 'Escape') {
      this.app.executeAction('prompt.cancel');
      return true;
    }
    
    // Enter confirms
    if (key === 'Enter') {
      this.app.executeAction('prompt.confirm');
      return true;
    }
    
    // Backspace
    if (key === 'Backspace') {
      this.app.executeAction('prompt.backspace');
      return true;
    }
    
    // Type character
    if (this._isPrintable(event)) {
      this.app.executeAction('prompt.type', { char: key });
      return true;
    }
    
    return false;
  }
  
  /**
   * Get the current input context
   * @returns {string} - 'editor', 'explorer', or 'search'
   */
  _getContext() {
    const state = this.app.state;
    if (state.get('searchMode')) return 'search';
    return state.get('focus') || 'editor';
  }
  
  /**
   * Check if an event represents a printable character
   * @param {Object} event - Key event
   * @returns {boolean}
   */
  _isPrintable(event) {
    if (event.ctrl || event.alt) return false;
    if (event.key.length !== 1) return false;
    const code = event.key.charCodeAt(0);
    return code >= 32 && code < 127;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.escapeTimeout) {
      clearTimeout(this.escapeTimeout);
      this.escapeTimeout = null;
    }
  }
}

module.exports = InputHandler;
