/**
 * Main UI Renderer
 * Orchestrates all UI components and renders to the terminal
 */

'use strict';

const Screen = require('./Screen');
const theme = require('./themes/default');
const Syntax = require('../editor/Syntax');

// Menu definitions
const MENUS = {
  file: {
    label: 'File',
    items: [
      { label: 'New File', action: 'file.new', shortcut: 'Ctrl+N' },
      { label: 'Open...', action: 'file.open', shortcut: 'Ctrl+O' },
      { label: 'Open Folder...', action: 'file.openFolder', shortcut: '' },
      { type: 'separator' },
      { label: 'Save', action: 'file.save', shortcut: 'Ctrl+S' },
      { label: 'Save As...', action: 'file.saveAs', shortcut: 'Ctrl+Shift+S' },
      { type: 'separator' },
      { label: 'Close Tab', action: 'tab.close', shortcut: 'Ctrl+W' },
      { label: 'Exit', action: 'app.quit', shortcut: 'Ctrl+Q' },
    ]
  },
  edit: {
    label: 'Edit',
    items: [
      { label: 'Undo', action: 'edit.undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: 'edit.redo', shortcut: 'Ctrl+Y' },
      { type: 'separator' },
      { label: 'Cut', action: 'edit.cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', action: 'edit.copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', action: 'edit.paste', shortcut: 'Ctrl+V' },
      { type: 'separator' },
      { label: 'Find', action: 'search.open', shortcut: 'Ctrl+F' },
      { label: 'Replace', action: 'search.openReplace', shortcut: 'Ctrl+H' },
    ]
  },
  view: {
    label: 'View',
    items: [
      { label: 'Toggle Sidebar', action: 'view.toggleSidebar', shortcut: 'Ctrl+B' },
      { type: 'separator' },
      { label: 'Focus Editor', action: 'view.focusEditor', shortcut: '' },
      { label: 'Focus Explorer', action: 'view.focusExplorer', shortcut: '' },
    ]
  },
  selection: {
    label: 'Selection',
    items: [
      { label: 'Select All', action: 'select.all', shortcut: 'Ctrl+A' },
      { label: 'Select Line', action: 'select.line', shortcut: 'Ctrl+L' },
      { type: 'separator' },
      { label: 'Expand Selection', action: 'select.expand', shortcut: 'Ctrl+Shift+Right' },
      { label: 'Shrink Selection', action: 'select.shrink', shortcut: 'Ctrl+Shift+Left' },
    ]
  },
};

class Renderer {
  constructor(state) {
    this.state = state;
    this.screen = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.tokenCache = new Map();
  }
  
  /**
   * Get menu definitions
   */
  static getMenus() {
    return MENUS;
  }
  
  /**
   * Main render function
   * @param {Object} data - Render data from app
   */
  render(data) {
    const {
      layout,
      tabs,
      activeTabIndex,
      buffer,
      fileTree,
      selectedFileIndex,
      focus,
      searchMode,
      searchQuery,
      replaceQuery,
      searchFocus,
      searchResults,
      currentMatch,
      inputPrompt,
      inputValue,
      message,
      menuOpen,
      menuHoverIndex,
      menuDropdown,
      explorerScrollTop,
      filePath,
    } = data;
    
    if (!layout) return;
    
    const width = layout.width;
    const height = layout.height;
    
    // Initialize or resize screen buffer
    if (!this.screen || width !== this.lastWidth || height !== this.lastHeight) {
      this.screen = new Screen(width, height);
      this.lastWidth = width;
      this.lastHeight = height;
    } else {
      this.screen.clear();
    }
    
    // === Render Menu Bar ===
    if (layout.menuBar) {
      this._renderMenuBar(layout.menuBar, menuOpen);
    }
    
    // === Render Tab Bar ===
    if (layout.tabBar && tabs.length > 0) {
      this._renderTabBar(layout.tabBar, tabs, activeTabIndex);
    }
    
    // === Render Explorer ===
    if (layout.explorer && layout.sidebarVisible) {
      this._renderExplorer(layout.explorer, fileTree, selectedFileIndex, focus === 'explorer', explorerScrollTop || 0);
    }
    
    // === Render Editor ===
    if (layout.editor && buffer) {
      this._renderEditor(layout.editor, buffer, focus === 'editor', searchResults, currentMatch, filePath);
    }
    
    // === Render Status Bar ===
    if (layout.statusBar) {
      const tab = tabs[activeTabIndex];
      this._renderStatusBar(layout.statusBar, buffer, tab, message);
    }
    
    // === Render Menu Dropdown (AFTER other elements so it appears on top) ===
    if (menuOpen && menuDropdown) {
      this._renderMenuDropdown(menuOpen, menuDropdown, menuHoverIndex);
    }
    
    // === Render Search Overlay ===
    if (searchMode && layout.search) {
      this._renderSearchOverlay(layout.search, searchQuery, replaceQuery, searchFocus, searchResults, currentMatch);
    }
    
    // === Render Input Prompt ===
    if (inputPrompt) {
      this._renderInputPrompt(layout, inputPrompt, inputValue);
    }
    
    // === Output to terminal ===
    this._flush(layout, buffer, focus, searchMode, searchFocus, inputPrompt, menuOpen);
  }
  
  /**
   * Render the menu bar
   */
  _renderMenuBar(layout, menuOpen) {
    const { x, y, width } = layout;
    
    // Background
    this.screen.fillRect(x, y, width, 1, ' ', theme.menuBarBg, theme.menuBarFg);
    
    // Draw menu items
    let col = x + 1;
    for (const item of layout.items) {
      const isOpen = menuOpen === item.id;
      const bg = isOpen ? theme.menuDropdownBg : theme.menuBarBg;
      const fg = isOpen ? theme.menuItemHoverFg : theme.menuBarFg;
      
      this.screen.fillRect(col, y, item.width, 1, ' ', bg, fg);
      this.screen.writeText(col, y, ` ${item.label} `, fg, bg);
      
      col += item.width + 1;
    }
  }
  
  /**
   * Render the menu dropdown
   */
  _renderMenuDropdown(menuId, dropdown, hoverIndex) {
    const menu = MENUS[menuId];
    if (!menu) return;
    
    const { x, y, width, items } = dropdown;
    
    // Draw border/background
    const height = items.length;
    this.screen.fillRect(x, y, width, height, ' ', theme.menuDropdownBg, theme.menuDropdownFg);
    
    // Draw items
    let row = y;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isHover = i === hoverIndex;
      const isSeparator = item.type === 'separator';
      
      if (isSeparator) {
        // Draw separator line
        this.screen.fillRect(x, row, width, 1, '─', theme.menuSeparatorFg, theme.menuDropdownBg);
      } else {
        const bg = isHover ? theme.menuDropdownHoverBg : theme.menuDropdownBg;
        const fg = isHover ? theme.menuDropdownHoverFg : theme.menuDropdownFg;
        
        // Clear line
        this.screen.fillRect(x, row, width, 1, ' ', bg, fg);
        
        // Draw label
        this.screen.writeText(x + 1, row, item.label, fg, bg);
        
        // Draw shortcut (right-aligned)
        if (item.shortcut) {
          const shortcutX = x + width - item.shortcut.length - 1;
          if (shortcutX > x + item.label.length + 2) {
            this.screen.writeText(shortcutX, row, item.shortcut, theme.menuShortcutFg, bg);
          }
        }
      }
      
      row++;
    }
  }
  
  /**
   * Render the tab bar
   */
  _renderTabBar(layout, tabs, activeIndex) {
    const { x, y, width } = layout;
    
    // Background
    this.screen.fillRect(x, y, width, 1, ' ', theme.tabBarBg, theme.tabBarFg);
    
    let col = x;
    for (let i = 0; i < tabs.length && col < x + width - 2; i++) {
      const tab = tabs[i];
      const isActive = i === activeIndex;
      const bg = isActive ? theme.tabActiveBg : theme.tabBg;
      const fg = isActive ? theme.tabActiveFg : theme.tabFg;
      
      // Tab title with modified indicator
      let title = tab.title;
      if (tab.modified) title += ' *';
      
      // Truncate if needed
      const maxLen = 20;
      if (title.length > maxLen) {
        title = title.slice(0, maxLen - 1) + '…';
      }
      
      // Draw tab
      const tabWidth = title.length + 3; // padding + close button
      
      if (col + tabWidth <= x + width) {
        this.screen.fillRect(col, y, tabWidth, 1, ' ', bg, fg);
        this.screen.writeText(col + 1, y, title, fg, bg);
        this.screen.writeText(col + title.length + 2, y, '×', theme.tabCloseFg, bg);
        col += tabWidth + 1;
      }
    }
  }
  
  /**
   * Render the file explorer
   */
  _renderExplorer(layout, nodes, selectedIndex, focused, scrollTop = 0) {
    const { x, y, width, height } = layout;
    
    // Background
    this.screen.fillRect(x, y, width, height, ' ', theme.explorerBg, theme.explorerFg);
    
    // No header - just show files directly
    
    if (!nodes || nodes.length === 0) {
      this.screen.writeText(x + 1, y + 1, 'No files', theme.explorerFg, theme.explorerBg);
      return;
    }
    
    // Adjust scroll to keep selected item visible
    const listHeight = height; // Now full height since no header
    if (selectedIndex < scrollTop) {
      scrollTop = selectedIndex;
    } else if (selectedIndex >= scrollTop + listHeight) {
      scrollTop = selectedIndex - listHeight + 1;
    }
    
    // Draw file list starting from y (no header offset)
    for (let i = 0; i < listHeight && scrollTop + i < nodes.length; i++) {
      const node = nodes[scrollTop + i];
      const isSelected = scrollTop + i === selectedIndex;
      
      const bg = isSelected ? (focused ? theme.explorerSelectedBg : theme.explorerSelectedUnfocusedBg) : theme.explorerBg;
      const fg = isSelected ? theme.explorerSelectedFg : theme.explorerFg;
      
      // Indent based on depth
      const indent = '  '.repeat(node.depth || 0);
      const icon = node.isDirectory ? (node.expanded ? '▼ ' : '▶ ') : '  ';
      const name = node.name;
      
      const text = indent + icon + name;
      const displayText = text.length > width - 1 ? text.slice(0, width - 2) + '…' : text;
      
      this.screen.fillRect(x, y + i, width, 1, ' ', bg, fg);
      this.screen.writeText(x + 1, y + i, displayText, fg, bg);
    }
  }
  
  /**
   * Get syntax color for a token type
   */
  _getSyntaxColor(tokenType) {
    const syn = theme.syntax || {};
    switch (tokenType) {
      case 'keyword': return syn.keyword || theme.editorFg;
      case 'string': return syn.string || theme.editorFg;
      case 'number': return syn.number || theme.editorFg;
      case 'comment': return syn.comment || theme.editorFg;
      case 'function': return syn.function || theme.editorFg;
      case 'type': return syn.type || theme.editorFg;
      case 'constant': return syn.constant || theme.editorFg;
      case 'operator': return syn.operator || theme.editorFg;
      case 'punctuation': return syn.punctuation || theme.editorFg;
      case 'variable': return syn.variable || theme.editorFg;
      case 'tag': return syn.tag || theme.editorFg;
      case 'attribute': return syn.attribute || theme.editorFg;
      case 'property': return syn.property || theme.editorFg;
      default: return theme.editorFg;
    }
  }

  /**
   * Render the editor area
   */
  _renderEditor(layout, buffer, focused, searchResults, currentMatch, filePath) {
    const { x, y, width, height, gutterWidth } = layout;
    
    // Background
    this.screen.fillRect(x, y, width, height, ' ', theme.editorBg, theme.editorFg);
    
    const lines = buffer.lines;
    const cursor = buffer.cursor;
    const scrollTop = buffer.scrollTop || 0;
    const scrollLeft = buffer.scrollLeft || 0;
    const selection = buffer.getSelectionRange ? buffer.getSelectionRange() : null;
    
    // Get language and tokenize for syntax highlighting
    const language = Syntax.getLanguage(filePath);
    const cacheKey = filePath + ':' + lines.length;
    let tokenLines = this.tokenCache.get(cacheKey);
    const cachedLang = this.tokenCache.get(cacheKey + '_lang');
    
    if (!tokenLines || cachedLang !== language) {
      tokenLines = language ? Syntax.tokenizeDocument(lines, language) : null;
      this.tokenCache.set(cacheKey, tokenLines);
      this.tokenCache.set(cacheKey + '_lang', language);
    }
    
    // Build a set of search match positions for highlighting
    const matchPositions = new Set();
    if (searchResults) {
      searchResults.forEach((match, idx) => {
        for (let c = 0; c < match.length; c++) {
          matchPositions.add(`${match.line}:${match.col + c}:${idx === currentMatch}`);
        }
      });
    }
    
    // Draw each visible line
    for (let i = 0; i < height; i++) {
      const lineNum = scrollTop + i;
      const lineY = y + i;
      
      // Line number gutter
      if (gutterWidth > 0) {
        const gutterText = lineNum < lines.length 
          ? String(lineNum + 1).padStart(gutterWidth - 1, ' ') + ' '
          : ' '.repeat(gutterWidth);
        this.screen.writeText(x, lineY, gutterText, theme.gutterFg, theme.gutterBg);
      }
      
      // Line content
      if (lineNum < lines.length) {
        const line = lines[lineNum];
        const editorX = x + gutterWidth;
        const editorWidth = width - gutterWidth;
        
        // Get tokens for this line if available
        const lineTokens = tokenLines ? tokenLines[lineNum] : null;
        
        // Render character by character for selection/search highlighting
        for (let c = 0; c < editorWidth; c++) {
          const charCol = scrollLeft + c;
          const char = charCol < line.length ? line[charCol] : ' ';
          
          let fg = theme.editorFg;
          let bg = theme.editorBg;
          
          // Apply syntax highlighting if available
          if (lineTokens && charCol < line.length) {
            const tokenInfo = this._getTokenAt(lineTokens, charCol);
            if (tokenInfo) {
              fg = this._getSyntaxColor(tokenInfo.type);
            }
          }
          
          // Check if in selection
          if (selection) {
            const { start, end } = selection;
            const inSelection = (
              (lineNum > start.line || (lineNum === start.line && charCol >= start.col)) &&
              (lineNum < end.line || (lineNum === end.line && charCol < end.col))
            );
            if (inSelection) {
              bg = theme.selectionBg;
              fg = theme.selectionFg;
            }
          }
          
          // Check if in search match
          const isCurrent = matchPositions.has(`${lineNum}:${charCol}:true`);
          const isMatch = matchPositions.has(`${lineNum}:${charCol}:false`) || isCurrent;
          if (isMatch) {
            bg = isCurrent ? theme.searchCurrentBg : theme.searchMatchBg;
            fg = theme.searchMatchFg;
          }
          
          this.screen.writeChar(editorX + c, lineY, char, fg, bg);
        }
      }
    }
  }
  
  /**
   * Get token type at a specific column in a line
   */
  _getTokenAt(tokens, col) {
    if (!tokens) return null;
    let pos = 0;
    for (const token of tokens) {
      if (col >= pos && col < pos + token.text.length) {
        return { type: token.type, text: token.text };
      }
      pos += token.text.length;
    }
    return null;
  }
  
  /**
   * Render the status bar
   */
  _renderStatusBar(layout, buffer, tab, message) {
    const { x, y, width } = layout;
    
    this.screen.fillRect(x, y, width, 1, ' ', theme.statusBarBg, theme.statusBarFg);
    
    // Left side: message or file info
    let leftText = message || '';
    if (!leftText && tab) {
      const fileName = tab.filePath ? this._truncatePath(tab.filePath, 30) : 'Untitled';
      leftText = fileName + (tab.modified ? ' *' : '');
    }
    
    this.screen.writeText(x + 1, y, leftText.slice(0, width / 2), theme.statusBarFg, theme.statusBarBg);
    
    // Right side: cursor position
    if (buffer) {
      const rightText = `Ln ${buffer.cursor.line + 1}, Col ${buffer.cursor.col + 1}`;
      const rightX = x + width - rightText.length - 1;
      if (rightX > x + leftText.length + 2) {
        this.screen.writeText(rightX, y, rightText, theme.statusBarFg, theme.statusBarBg);
      }
    }
  }
  
  /**
   * Render the search overlay
   */
  _renderSearchOverlay(layout, query, replace, focus, results, currentMatch) {
    const { x, y, width } = layout;
    
    // Background
    this.screen.fillRect(x, y, width, 2, ' ', theme.searchBg, theme.searchFg);
    
    // Search field
    const searchLabel = 'Find: ';
    this.screen.writeText(x + 1, y, searchLabel, theme.searchLabelFg, theme.searchBg);
    
    const searchFieldX = x + 1 + searchLabel.length;
    const searchFieldWidth = Math.min(30, width - searchLabel.length - 15);
    const searchBg = focus === 'search' ? theme.searchFieldActiveBg : theme.searchFieldBg;
    this.screen.fillRect(searchFieldX, y, searchFieldWidth, 1, ' ', searchBg, theme.searchFg);
    this.screen.writeText(searchFieldX, y, query.slice(0, searchFieldWidth), theme.searchFg, searchBg);
    
    // Result count
    const resultText = results ? `${currentMatch + 1}/${results.length}` : '0/0';
    this.screen.writeText(searchFieldX + searchFieldWidth + 2, y, resultText, theme.searchFg, theme.searchBg);
    
    // Replace field
    const replaceLabel = 'Replace: ';
    this.screen.writeText(x + 1, y + 1, replaceLabel, theme.searchLabelFg, theme.searchBg);
    
    const replaceFieldX = x + 1 + replaceLabel.length;
    const replaceBg = focus === 'replace' ? theme.searchFieldActiveBg : theme.searchFieldBg;
    this.screen.fillRect(replaceFieldX, y + 1, searchFieldWidth, 1, ' ', replaceBg, theme.searchFg);
    this.screen.writeText(replaceFieldX, y + 1, replace.slice(0, searchFieldWidth), theme.searchFg, replaceBg);
  }
  
  /**
   * Render input prompt (e.g., "Go to line")
   */
  _renderInputPrompt(layout, prompt, value) {
    const width = layout.width;
    const height = layout.height;
    
    // Center the prompt
    const promptWidth = Math.min(50, width - 10);
    const promptX = Math.floor((width - promptWidth) / 2);
    const promptY = Math.floor(height / 3);
    
    // Draw box
    this.screen.fillRect(promptX, promptY, promptWidth, 3, ' ', theme.promptBg, theme.promptFg);
    
    // Border
    this.screen.writeText(promptX, promptY, '┌' + '─'.repeat(promptWidth - 2) + '┐', theme.promptBorderFg, theme.promptBg);
    this.screen.writeText(promptX, promptY + 2, '└' + '─'.repeat(promptWidth - 2) + '┘', theme.promptBorderFg, theme.promptBg);
    this.screen.writeChar(promptX, promptY + 1, '│', theme.promptBorderFg, theme.promptBg);
    this.screen.writeChar(promptX + promptWidth - 1, promptY + 1, '│', theme.promptBorderFg, theme.promptBg);
    
    // Prompt text and input
    const text = prompt + ' ' + value;
    this.screen.writeText(promptX + 2, promptY + 1, text.slice(0, promptWidth - 4), theme.promptFg, theme.promptBg);
  }
    
  /**
   * Update menu hover directly without full re-render
   * This writes only the affected line to the terminal for performance
   * Uses synchronized output to prevent flicker
   */
  updateMenuHover(menuId, dropdown, oldHoverIndex, newHoverIndex) {
    if (!dropdown || oldHoverIndex === newHoverIndex) return;
    
    const ESC = '\x1b';
    const menu = MENUS[menuId];
    if (!menu) return;
    
    const { x, y, width, items } = dropdown;
    
    // Skip if new hover is invalid (separator or out of bounds)
    if (newHoverIndex < 0 || newHoverIndex >= items.length) {
      newHoverIndex = -1;
    } else if (items[newHoverIndex] && items[newHoverIndex].type === 'separator') {
      newHoverIndex = -1;
    }
    
    // Skip if old hover is invalid
    if (oldHoverIndex < 0 || oldHoverIndex >= items.length) {
      oldHoverIndex = -1;
    } else if (items[oldHoverIndex] && items[oldHoverIndex].type === 'separator') {
      oldHoverIndex = -1;
    }
    
    // Nothing to update
    if (oldHoverIndex === -1 && newHoverIndex === -1) return;
    
    const colorCode = function(fg, bg) {
      return Screen.color24(fg, bg);
    };
    
    let output = ESC + '[?2026h';
    
    // Update old hover line (un-highlight)
    if (oldHoverIndex >= 0 && oldHoverIndex < items.length) {
      const oldItem = items[oldHoverIndex];
      if (oldItem && oldItem.type !== 'separator') {
        const row = y + oldHoverIndex;
        const bg = theme.menuDropdownBg;
        const fg = theme.menuDropdownFg;
        const shortcut = oldItem.shortcut || '';
        
        output += ESC + '[' + (row + 1) + ';' + (x + 1) + 'H';
        output += colorCode(fg, bg);
        output += oldItem.label;
        output += ESC + '[0m';
        
        if (shortcut) {
          const shortcutX = width - shortcut.length - 1;
          if (shortcutX > oldItem.label.length + 2) {
            output += ESC + '[' + (row + 1) + ';' + (x + shortcutX) + 'H';
            output += colorCode(theme.menuShortcutFg, bg);
            output += shortcut;
          }
        }
        
        // Clear rest of line
        const textLen = oldItem.label.length + (shortcut ? shortcut.length + 1 : 0);
        if (textLen < width - 2) {
          output += ESC + '[' + (row + 1) + ';' + (x + textLen + 1) + 'H';
          output += colorCode(fg, bg);
          output += ' '.repeat(width - textLen - 2);
        }
      }
    }
    
    // Update new hover line (highlight)
    if (newHoverIndex >= 0 && newHoverIndex < items.length) {
      const newItem = items[newHoverIndex];
      if (newItem && newItem.type !== 'separator') {
        const row = y + newHoverIndex;
        const bg = theme.menuDropdownHoverBg;
        const fg = theme.menuDropdownHoverFg;
        const shortcut = newItem.shortcut || '';
        
        output += ESC + '[' + (row + 1) + ';' + (x + 1) + 'H';
        output += colorCode(fg, bg);
        output += newItem.label;
        output += ESC + '[0m';
        
        if (shortcut) {
          const shortcutX = width - shortcut.length - 1;
          if (shortcutX > newItem.label.length + 2) {
            output += ESC + '[' + (row + 1) + ';' + (x + shortcutX) + 'H';
            output += colorCode(theme.menuShortcutFg, bg);
            output += shortcut;
          }
        }
        
        // Clear rest of line
        const textLen = newItem.label.length + (shortcut ? shortcut.length + 1 : 0);
        if (textLen < width - 2) {
          output += ESC + '[' + (row + 1) + ';' + (x + textLen + 1) + 'H';
          output += colorCode(fg, bg);
          output += ' '.repeat(width - textLen - 2);
        }
      }
    }
    
    // Move cursor back to menu bar
    output += ESC + '[1;' + (x + 1) + 'H';
    output += ESC + '[?2026l';
    
    process.stdout.write(output);
  }
  
  /**
   * Flush screen to terminal and position cursor
   * Uses synchronized output (DECSET 2026) to prevent flicker
   */
  _flush(layout, buffer, focus, searchMode, searchFocus, inputPrompt, menuOpen) {
    const ESC = '\x1b';
    
    // Start synchronized output to prevent flicker
    let output = ESC + '[?2026h';
    output += ESC + '[?25l';
    output += ESC + '[H';
    output += this.screen.toString();
    
    if (menuOpen) {
      output += ESC + '[?25h';
      // End synchronized output before writing
      output += ESC + '[?2026l';
      process.stdout.write(output);
      return;
    }
    
    if (inputPrompt) {
      const promptWidth = Math.min(50, layout.width - 10);
      const promptX = Math.floor((layout.width - promptWidth) / 2);
      const promptY = Math.floor(layout.height / 3);
      const cursorX = promptX + 2 + inputPrompt.length + 1 + (this.state.get('inputValue') || '').length;
      output += ESC + '[' + (promptY + 2) + ';' + (cursorX + 1) + 'H';
    } else if (searchMode) {
      const searchFieldX = layout.search.x + 7;
      const query = this.state.get('searchQuery') || '';
      const replace = this.state.get('replaceQuery') || '';
      
      if (searchFocus === 'search') {
        output += ESC + '[' + (layout.search.y + 1) + ';' + (searchFieldX + query.length + 1) + 'H';
      } else {
        output += ESC + '[' + (layout.search.y + 2) + ';' + (searchFieldX + 3 + replace.length) + 'H';
      }
    } else if (focus === 'editor' && buffer && layout.editor) {
      const scrollTop = buffer.scrollTop || 0;
      const scrollLeft = buffer.scrollLeft || 0;
      const screenLine = buffer.cursor.line - scrollTop;
      const screenCol = buffer.cursor.col - scrollLeft;
      
      if (screenLine >= 0 && screenLine < layout.editor.height) {
        const cursorX = layout.editor.x + layout.editor.gutterWidth + screenCol;
        const cursorY = layout.editor.y + screenLine;
        output += ESC + '[' + (cursorY + 1) + ';' + (cursorX + 1) + 'H';
      }
    }
    
    output += ESC + '[?25h';
    // End synchronized output before writing
    output += ESC + '[?2026l';
    
    process.stdout.write(output);
  }
  
  /**
   * Truncate a file path for display
   */
  _truncatePath(filePath, maxLen) {
    if (filePath.length <= maxLen) return filePath;
    
    const parts = filePath.replace(/\\/g, '/').split('/');
    const fileName = parts.pop();
    
    if (fileName.length >= maxLen - 3) {
      return '…' + fileName.slice(-maxLen + 1);
    }
    
    return '…/' + fileName;
  }
}

module.exports = Renderer;
