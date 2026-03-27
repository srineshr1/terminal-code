/**
 * Blessed-based Renderer
 * VS Code-style terminal UI
 */

'use strict';

const blessed = require('blessed');
const theme = require('./themes/default');

function rgb(arr) {
  if (!arr) return 'white';
  if (typeof arr === 'string') {
    if (arr.startsWith('#')) return arr;
    if (/^[0-9a-f]{6}$/i.test(arr)) return '#' + arr;
    return arr;
  }
  if (!Array.isArray(arr) || arr.length < 3) return 'white';
  const r = Math.max(0, Math.min(255, Math.round(arr[0])));
  const g = Math.max(0, Math.min(255, Math.round(arr[1])));
  const b = Math.max(0, Math.min(255, Math.round(arr[2])));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

function stripAnsi(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[()][AB012]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

class BlessedRenderer {
  constructor(options = {}) {
    this.screen = null;
    this.widgets = {};
    this.state = options.state || {};
    this.onKeypress = options.onKeypress || (() => {});
    this.onClick = options.onClick || (() => {});
    this.onMenuClick = options.onMenuClick || (() => {});
    this.layout = null;
    this.menuSelectedIndex = -1;
    this.currentMenuItems = [];
    this._initialized = false;
    this._tabs = [];
  }

  init() {
    if (this._initialized) return this.screen;
    
    this.screen = blessed.screen({
      smartCSR: true,
      useBCE: true,
      autoPadding: true,
      terminal: 'xterm-256color',
      resizeTimeout: 100,
    });

    this.screen.enableMouse();
    this._initialized = true;

    this.screen.on('keypress', (ch, key) => {
      this._handleMenuNavigation(ch, key);
      this.onKeypress(ch, key);
    });

    this.screen.on('resize', () => {
      this._rebuildLayout();
      this.screen.render();
    });

    return this.screen;
  }

  _handleMenuNavigation(ch, key) {
    if (!this.state.menuOpen || !this.currentMenuItems.length) return;

    const items = this.currentMenuItems.filter(item => item.type !== 'separator');
    const currentIndex = this.menuSelectedIndex;

    if (key.name === 'up') {
      this.menuSelectedIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      this._updateMenuHighlight();
    } else if (key.name === 'down') {
      this.menuSelectedIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
      this._updateMenuHighlight();
    } else if (key.name === 'return' || key.name === 'enter') {
      if (this.menuSelectedIndex >= 0 && items[this.menuSelectedIndex]) {
        this.onClick('menu_action', items[this.menuSelectedIndex].action);
      }
    }
  }

  _updateMenuHighlight() {
    const items = this.currentMenuItems.filter(item => item.type !== 'separator');
    const shortcutFg = theme.menuShortcutFg.join(';');
    const itemContentWidth = 28;

    for (let i = 0; i < this.currentMenuItems.length; i++) {
      const item = this.currentMenuItems[i];
      const widget = this.widgets[`menuitem_${i}`];
      if (!widget) continue;

      if (item.type === 'separator') {
        widget.setContent('─'.repeat(24));
      } else {
        const itemIndex = items.indexOf(item);
        const isSelected = itemIndex === this.menuSelectedIndex;

        if (isSelected) {
          widget.style.bg = rgb(theme.menuDropdownHoverBg);
          widget.style.fg = rgb(theme.menuDropdownHoverFg);
          if (item.shortcut) {
            const padding = Math.max(1, itemContentWidth - item.label.length - item.shortcut.length - 2);
            widget.setContent(` ${item.label}${' '.repeat(padding)}{${shortcutFg}-fg}${item.shortcut}{/${shortcutFg}-fg}`);
          } else {
            widget.setContent(` ${item.label}`);
          }
        } else {
          widget.style.bg = rgb(theme.menuDropdownBg);
          widget.style.fg = rgb(theme.menuDropdownFg);
          if (item.shortcut) {
            const padding = Math.max(1, itemContentWidth - item.label.length - item.shortcut.length - 2);
            widget.setContent(` ${item.label}${' '.repeat(padding)}{${shortcutFg}-fg}${item.shortcut}{/${shortcutFg}-fg}`);
          } else {
            widget.setContent(` ${item.label}`);
          }
        }
      }
    }
    this.screen.render();
  }

  buildLayout(state) {
    if (!this._initialized || !this.screen) return;
    
    this.state = state;
    this.menuSelectedIndex = -1;
    this.currentMenuItems = [];
    this._tabs = state.tabs || [];

    this._clearWidgets();
    this._buildMenuBar();
    this._buildTabBar(this._tabs, state.activeTabIndex);

    if (state.showExplorer && state.fileTree) {
      this._buildSidebar(state.fileTree, state.selectedFileIndex);
    }

    if (state.buffer) {
      this._buildEditor(state.buffer, state.focus === 'editor');
    }

    this._buildStatusBar(state);

    if (state.searchMode) {
      this._buildSearchOverlay(state);
    }

    if (state.menuOpen) {
      this._buildMenuDropdown(state.menuOpen);
    }

    this.screen.render();
  }

  _clearWidgets() {
    for (const key of Object.keys(this.widgets)) {
      const widget = this.widgets[key];
      if (widget && widget.detach) {
        try {
          widget.detach();
        } catch (e) {
        }
      }
    }
    this.widgets = {};
  }

  _buildMenuBar() {
    const menuBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      bg: rgb(theme.menuBarBg),
      fg: rgb(theme.menuBarFg),
      tags: false,
    });

    const menus = ['File', 'Edit', 'View', 'Selection'];
    let col = 0;
    
    for (const menu of menus) {
      const item = blessed.text({
        parent: menuBar,
        left: col,
        top: 0,
        content: ` ${menu} `,
        bg: rgb(theme.menuBarBg),
        fg: rgb(theme.menuBarFg),
        hoverBg: rgb(theme.menuItemHoverBg),
        hoverFg: rgb(theme.menuItemHoverFg),
        tags: false,
      });

      item.on('click', () => {
        this.onMenuClick(menu.toLowerCase());
      });

      col += menu.length + 3;
      this.widgets[`menu_${menu}`] = item;
    }

    this.widgets.menuBar = menuBar;
  }

  _buildTabBar(tabs, activeIndex) {
    const sidebarWidth = this.state.showExplorer ? 30 : 0;
    const tabBarTop = 1;
    const tabBarHeight = 1;

    const tabBarBg = blessed.box({
      parent: this.screen,
      top: tabBarTop,
      left: sidebarWidth,
      width: `100%-${sidebarWidth}`,
      height: tabBarHeight,
      bg: rgb(theme.tabBarBg),
      tags: false,
    });

    const tabBarContent = blessed.box({
      parent: tabBarBg,
      top: 0,
      left: 0,
      width: '100%',
      height: tabBarHeight,
      scrollable: true,
      tags: false,
    });

    if (tabs.length === 0) {
      tabBarBg.setContent(' No files open');
      return;
    }

    let col = 0;

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const isActive = i === activeIndex;
      const title = tab.title || 'Untitled';
      const displayTitle = title.length > 12 ? title.substring(0, 11) + '\u2026' : title;
      const num = String(i + 1);

      const tabText = ` ${num} ${displayTitle}${tab.modified ? '*' : ' '} `;
      const tabWidth = tabText.length + 1;
      const tabLeft = col;

      const tabBox = blessed.box({
        parent: tabBarContent,
        left: tabLeft,
        top: 0,
        width: tabWidth,
        height: 1,
        bg: isActive ? rgb(theme.tabActiveBg) : rgb(theme.tabBarBg),
        fg: isActive ? rgb(theme.tabActiveFg) : rgb(theme.tabFg),
        clickable: true,
        tags: false,
        content: ` ${num} ${displayTitle}${tab.modified ? '*' : ' '}`,
      });

      const closeBtn = blessed.text({
        parent: tabBarContent,
        left: tabLeft + tabWidth - 2,
        top: 0,
        width: 2,
        height: 1,
        content: '\u00D7',
        bg: isActive ? rgb(theme.tabActiveBg) : rgb(theme.tabBarBg),
        fg: rgb(theme.tabCloseFg),
        clickable: true,
        tags: false,
      });

      if (i < tabs.length - 1) {
        const divider = blessed.text({
          parent: tabBarContent,
          left: tabLeft + tabWidth,
          top: 0,
          width: 1,
          height: 1,
          content: '\u2502',
          bg: rgb(theme.tabBarBg),
          fg: rgb(theme.tabDividerFg),
          tags: false,
        });
        this.widgets[`tab_divider_${i}`] = divider;
      }

      tabBox.on('click', () => {
        this.onClick('tab', i);
      });

      closeBtn.on('click', (e) => {
        this.onClick('tab_close', i);
      });

      tabBox.on('mouseover', () => {
        if (!isActive) {
          tabBox.style.bg = rgb(theme.tabHoverBg);
          closeBtn.style.bg = rgb(theme.tabHoverBg);
          this.screen.render();
        }
      });

      tabBox.on('mouseout', () => {
        if (!isActive) {
          tabBox.style.bg = rgb(theme.tabBarBg);
          closeBtn.style.bg = rgb(theme.tabBarBg);
          this.screen.render();
        }
      });

      col = tabLeft + tabWidth + 1;
      this.widgets[`tab_${i}`] = tabBox;
      this.widgets[`tabclose_${i}`] = closeBtn;
    }

    this.widgets.tabBar = tabBarBg;
    this.widgets.tabBarContent = tabBarContent;
  }

  _buildSidebar(fileTree, selectedIndex) {
    const sidebarWidth = 30;
    
    const sidebar = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      width: sidebarWidth,
      height: '100%-2',
      bg: rgb(theme.sidebarBg),
      fg: rgb(theme.sidebarFg),
      tags: false,
    });

    const logo = blessed.box({
      parent: sidebar,
      top: 0,
      left: 0,
      width: sidebarWidth,
      height: 8,
      content: '\n' +
        '{cyan-fg} ████████╗ ██████╗ {/cyan-fg}\n' +
        '{cyan-fg} ╚══██╔══╝██╔════╝ {/cyan-fg}\n' +
        '{cyan-fg}    ██║   ██║      {/cyan-fg}\n' +
        '{cyan-fg}    ██║   ██║      {/cyan-fg}\n' +
        '{cyan-fg}    ██║   ╚██████╗ {/cyan-fg}\n' +
        '{cyan-fg}    ╚═╝    ╚═════╝ {/cyan-fg}',
      tags: true,
      style: { transparent: true },
    });

    this._sidebarLastClick = { index: -1, time: 0 };

    for (let i = 0; i < fileTree.length; i++) {
      const file = fileTree[i];
      const isSelected = i === selectedIndex;
      const icon = file.isDirectory ? (file.expanded ? '▼ ' : '▸ ') : '';
      const displayName = stripAnsi(file.name);
      const truncatedName = displayName.length > 18 ? displayName.substring(0, 17) + '…' : displayName;
      
      let prefix = '';
      for (let d = 0; d < file.depth; d++) {
        for (let j = i - 1; j >= 0; j--) {
          const prev = fileTree[j];
          if (prev.depth === d) {
            if (!prev.isLast) {
              prefix += '│ ';
            }
            break;
          }
        }
      }
      
      const treePrefix = file.depth === 0 ? '' : (file.isLast ? '└─ ' : '├─ ');
      const content = prefix + treePrefix + icon + truncatedName;
      
      const item = blessed.text({
        parent: sidebar,
        top: i + 8,
        left: 1,
        width: sidebarWidth - 2,
        content: content,
        fg: isSelected ? rgb(theme.sidebarSelectedFg) : 
            (file.isDirectory ? rgb(theme.sidebarFolderFg) : rgb(theme.sidebarFileFg)),
        bg: isSelected ? rgb(theme.sidebarSelectedBg) : rgb(theme.sidebarBg),
        clickable: true,
        tags: false,
      });

      item.on('click', () => {
        if (!file.isDirectory) {
          this.onClick('explorer_open', i);
        } else {
          this.onClick('explorer_toggle', i);
        }
      });

      item.on('mouseover', () => {
        const currentlySelected = this.state.selectedFileIndex === i;
        if (!currentlySelected) {
          item.style.bg = rgb(theme.sidebarHoverBg);
          item.style.fg = rgb(theme.sidebarHoverFg);
          this.screen.render();
        }
      });

      item.on('mouseout', () => {
        const currentlySelected = this.state.selectedFileIndex === i;
        if (!currentlySelected) {
          item.style.bg = rgb(theme.sidebarBg);
          item.style.fg = file.isDirectory ? rgb(theme.sidebarFolderFg) : rgb(theme.sidebarFileFg);
          this.screen.render();
        }
      });

      this.widgets[`file_${i}`] = item;
    }

    this.widgets.sidebar = sidebar;
  }

  _buildEditor(buffer, focused) {
    const sidebarWidth = this.state.showExplorer ? 24 : 0;
    
    const editor = blessed.box({
      parent: this.screen,
      top: 2,
      left: sidebarWidth,
      width: '100%',
      height: '100%-3',
      bg: rgb(theme.editorBg),
      fg: rgb(theme.editorFg),
      scrollable: true,
      tags: false,
    });

    const gutterWidth = String(buffer.lines.length).length + 2;
    
    const lines = buffer.lines || [''];
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const cleanLine = stripAnsi(rawLine);
      const displayLine = cleanLine.substring(0, 200);
      const lineNum = String(i + 1).padStart(gutterWidth - 1, ' ');
      
      blessed.text({
        parent: editor,
        top: i,
        left: 0,
        width: gutterWidth,
        content: lineNum,
        fg: rgb(theme.gutterFg),
        bg: rgb(theme.gutterBg),
        tags: false,
      });

      const lineContent = blessed.text({
        parent: editor,
        top: i,
        left: gutterWidth,
        width: '100%-' + gutterWidth,
        content: displayLine,
        fg: rgb(theme.editorFg),
        bg: rgb(theme.editorBg),
        tags: false,
      });

      this.widgets[`line_${i}`] = lineContent;
    }

    if (focused && buffer.cursor) {
      const cursor = blessed.box({
        parent: editor,
        top: buffer.cursor.line,
        left: gutterWidth + buffer.cursor.col,
        width: 1,
        height: 1,
        bg: rgb(theme.cursorBg),
        fg: rgb(theme.cursorFg),
        content: ' ',
      });
      this.widgets.cursor = cursor;
    }

    this.widgets.editor = editor;
  }

  _buildStatusBar(state) {
    const statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      bg: rgb(theme.statusBarBg),
      fg: rgb(theme.statusBarFg),
      tags: false,
    });

    const filePath = state.filePath ? stripAnsi(state.filePath) : 'Untitled';
    const mode = state.focus === 'editor' ? 'EDITOR' : 'EXPLORER';
    
    blessed.text({
      parent: statusBar,
      left: 0,
      top: 0,
      width: 20,
      content: ` ${mode} `,
      bg: rgb([0, 100, 170]),
      fg: rgb([255, 255, 255]),
      tags: false,
    });

    blessed.text({
      parent: statusBar,
      left: 20,
      top: 0,
      content: ` ${filePath} `,
      fg: rgb(theme.statusBarFg),
      bg: rgb(theme.statusBarBg),
      tags: false,
    });

    const rightContent = `Ln ${state.cursorLine || 1}, Col ${state.cursorCol || 1} `;
    blessed.text({
      parent: statusBar,
      right: 0,
      top: 0,
      content: rightContent,
      fg: rgb(theme.statusBarFg),
      bg: rgb(theme.statusBarBg),
      tags: false,
    });

    this.widgets.statusBar = statusBar;
  }

  _buildSearchOverlay(state) {
    const searchBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 7,
      bg: rgb(theme.searchBg),
      fg: rgb(theme.searchFg),
      tags: false,
    });

    blessed.text({
      parent: searchBox,
      top: 1,
      left: 2,
      content: 'Search:',
      fg: rgb(theme.searchLabelFg),
      tags: false,
    });

    const searchInput = blessed.textbox({
      parent: searchBox,
      top: 1,
      left: 11,
      width: 35,
      height: 1,
      bg: rgb(theme.searchFieldBg),
      fg: rgb(theme.searchFg),
      inputOnFocus: true,
      value: state.searchQuery || '',
    });

    searchInput.on('submit', () => {
      this.onClick('search_next');
    });

    blessed.text({
      parent: searchBox,
      top: 3,
      left: 2,
      content: 'Replace:',
      fg: rgb(theme.searchLabelFg),
      tags: false,
    });

    const replaceInput = blessed.textbox({
      parent: searchBox,
      top: 3,
      left: 11,
      width: 35,
      height: 1,
      bg: rgb(theme.searchFieldBg),
      fg: rgb(theme.searchFg),
      inputOnFocus: false,
      value: state.replaceQuery || '',
    });

    blessed.button({
      parent: searchBox,
      top: 5,
      left: 2,
      content: 'Find',
      style: { bg: rgb(theme.sidebarSelectedBg), fg: rgb(theme.sidebarSelectedFg) },
      onClick: () => {
        this.onClick('search_next');
      },
    });

    blessed.button({
      parent: searchBox,
      top: 5,
      left: 10,
      content: 'Close',
      style: { bg: rgb(theme.tabBarBg), fg: rgb(theme.tabFg) },
      onClick: () => {
        this.onClick('search_close');
      },
    });

    searchInput.focus();
    this.widgets.searchBox = searchBox;
  }

  _buildMenuDropdown(menuId) {
    const menus = {
      file: [
        { label: 'New File', action: 'file.new', shortcut: 'Ctrl+N' },
        { label: 'Open...', action: 'file.open', shortcut: 'Ctrl+O' },
        { label: 'Open Folder...', action: 'file.openFolder', shortcut: '' },
        { type: 'separator' },
        { label: 'Save', action: 'file.save', shortcut: 'Ctrl+S' },
        { label: 'Save As...', action: 'file.saveAs', shortcut: '' },
        { type: 'separator' },
        { label: 'Exit', action: 'app.quit', shortcut: 'Ctrl+Q' },
      ],
      edit: [
        { label: 'Undo', action: 'edit.undo', shortcut: 'Ctrl+Z' },
        { label: 'Redo', action: 'edit.redo', shortcut: 'Ctrl+Y' },
        { type: 'separator' },
        { label: 'Cut', action: 'edit.cut', shortcut: 'Ctrl+X' },
        { label: 'Copy', action: 'edit.copy', shortcut: 'Ctrl+C' },
        { label: 'Paste', action: 'edit.paste', shortcut: 'Ctrl+V' },
      ],
      view: [
        { label: 'Toggle Sidebar', action: 'view.toggleSidebar', shortcut: 'Ctrl+B' },
        { label: 'Focus Editor', action: 'view.focusEditor', shortcut: '' },
        { label: 'Focus Explorer', action: 'view.focusExplorer', shortcut: '' },
      ],
      selection: [
        { label: 'Select All', action: 'select.all', shortcut: 'Ctrl+A' },
        { label: 'Expand Selection', action: 'select.expand', shortcut: 'Ctrl+Shift+Right' },
        { label: 'Shrink Selection', action: 'select.shrink', shortcut: 'Ctrl+Shift+Left' },
      ],
    };

    const items = menus[menuId];
    if (!items) return;

    this.currentMenuItems = items;

    const menuPositions = {
      file: 0,
      edit: 7,
      view: 14,
      selection: 21,
    };

    const leftPos = menuPositions[menuId] || 0;
    const dropdownWidth = 30;
    const itemContentWidth = 28;

    const dropdown = blessed.box({
      parent: this.screen,
      top: 1,
      left: leftPos,
      width: dropdownWidth + 2,
      height: items.length + 2,
      bg: rgb(theme.menuDropdownBg),
      fg: rgb(theme.menuDropdownFg),
      border: { type: 'line' },
      style: {
        border: { fg: rgb(theme.menuDropdownBorder) },
      },
      tags: false,
    });

    let row = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type === 'separator') {
        blessed.text({
          parent: dropdown,
          top: row,
          left: 1,
          width: dropdownWidth - 2,
          content: '─'.repeat(dropdownWidth - 4),
          fg: rgb(theme.menuSeparatorFg),
          bg: rgb(theme.menuDropdownBg),
          tags: false,
        });
        row++;
        continue;
      }

      const label = item.label;
      const shortcut = item.shortcut || '';
      let content;

      if (shortcut) {
        const padding = Math.max(1, itemContentWidth - label.length - shortcut.length - 2);
        const shortcutFg = theme.menuShortcutFg.join(';');
        content = ` ${label}${' '.repeat(padding)}{${shortcutFg}-fg}${shortcut}{/${shortcutFg}-fg}`;
      } else {
        content = ` ${label}`;
      }

      const menuItem = blessed.text({
        parent: dropdown,
        top: row,
        left: 1,
        width: dropdownWidth - 2,
        content: content,
        bg: rgb(theme.menuDropdownBg),
        fg: rgb(theme.menuDropdownBorder),
        hoverBg: rgb(theme.menuDropdownHoverBg),
        hoverFg: rgb(theme.menuDropdownHoverFg),
        clickable: true,
        tags: true,
      });

      menuItem.on('click', () => {
        this.onClick('menu_action', item.action);
      });

      menuItem.on('mouseover', () => {
        const itemsOnly = items.filter(x => x.type !== 'separator');
        const itemIndex = itemsOnly.indexOf(item);
        if (itemIndex >= 0) {
          this.menuSelectedIndex = itemIndex;
          this._updateMenuHighlight();
        }
      });

      this.widgets[`menuitem_${i}`] = menuItem;
      row++;
    }

    this.widgets.dropdown = dropdown;
    this.menuSelectedIndex = -1;
    this._updateMenuHighlight();
  }

  _rebuildLayout() {
    if (this.state && this._initialized) {
      this.buildLayout(this.state);
    }
  }

  render() {
    if (this.screen) {
      this.screen.render();
    }
  }

  closeMenu() {
    if (this.widgets.dropdown) {
      try {
        this.widgets.dropdown.detach();
      } catch (e) {
      }
      this.widgets.dropdown = null;
      this.menuSelectedIndex = -1;
      this.currentMenuItems = [];
      this.render();
    }
  }

  getDimensions() {
    if (!this.screen) return { width: 80, height: 24 };
    return {
      width: this.screen.width,
      height: this.screen.height,
    };
  }

  focusWidget(name) {
    const widget = this.widgets[name];
    if (widget && widget.focus) {
      widget.focus();
      this.render();
    }
  }

  destroy() {
    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
      this._initialized = false;
    }
  }
}

module.exports = BlessedRenderer;
module.exports.theme = theme;
module.exports.stripAnsi = stripAnsi;