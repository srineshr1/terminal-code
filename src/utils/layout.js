/**
 * Layout calculations and hit testing for the terminal UI
 */

'use strict';

/**
 * Menu definitions - labels and widths for hit testing
 */
const MENU_ITEMS = [
  { id: 'file', label: 'File', width: 6 },
  { id: 'edit', label: 'Edit', width: 6 },
  { id: 'view', label: 'View', width: 6 },
  { id: 'selection', label: 'Selection', width: 11 },
];

/**
 * Compute the layout for all UI components
 * @param {number} width - Terminal width
 * @param {number} height - Terminal height
 * @param {number} sidebarWidth - Width of the sidebar
 * @param {boolean} sidebarVisible - Whether sidebar is visible
 * @returns {Object} - Layout object with component positions
 */
function computeLayout(width, height, sidebarWidth = 25, sidebarVisible = true) {
  const menuBarHeight = 1;
  const tabBarHeight = 1;
  const statusBarHeight = 1;
  const searchHeight = 2;
  
  const actualSidebarWidth = sidebarVisible ? Math.min(sidebarWidth, Math.floor(width * 0.4)) : 0;
  const editorWidth = width - actualSidebarWidth;
  
  // Calculate gutter width based on typical line counts
  const gutterWidth = 5; // "9999 " = 5 chars
  
  // Content height = total - menuBar - tabBar - statusBar
  const contentHeight = height - menuBarHeight - tabBarHeight - statusBarHeight;
  
  return {
    width,
    height,
    sidebarVisible,
    
    // Menu bar at very top (full width)
    menuBar: {
      x: 0,
      y: 0,
      width: width,
      height: menuBarHeight,
      items: MENU_ITEMS,
    },
    
    // Tab bar below menu, only above editor (not sidebar)
    tabBar: {
      x: actualSidebarWidth,
      y: menuBarHeight,
      width: editorWidth,
      height: tabBarHeight,
    },
    
    // Explorer starts below menu bar
    explorer: sidebarVisible ? {
      x: 0,
      y: menuBarHeight,
      width: actualSidebarWidth,
      height: height - menuBarHeight - statusBarHeight,
    } : null,
    
    // Editor below tab bar
    editor: {
      x: actualSidebarWidth,
      y: menuBarHeight + tabBarHeight,
      width: editorWidth,
      height: contentHeight,
      gutterWidth: gutterWidth,
    },
    
    statusBar: {
      x: 0,
      y: height - statusBarHeight,
      width: width,
      height: statusBarHeight,
    },
    
    search: {
      x: actualSidebarWidth,
      y: menuBarHeight + tabBarHeight,
      width: editorWidth,
      height: searchHeight,
    },
  };
}

/**
 * Perform hit testing to determine what UI element is at a position
 * @param {number} col - Column (0-indexed)
 * @param {number} row - Row (0-indexed)
 * @param {Object} layout - Layout object from computeLayout
 * @param {Object} context - Additional context (tabs, scrollTop, menuOpen, etc.)
 * @returns {Object|null} - Hit test result
 */
function hitTest(col, row, layout, context = {}) {
  // Test menu bar
  if (layout.menuBar && inRect(col, row, layout.menuBar)) {
    return hitTestMenuBar(col, row, layout.menuBar);
  }
  
  // Test dropdown menu if open
  if (context.menuOpen && context.menuDropdown) {
    if (inRect(col, row, context.menuDropdown)) {
      return hitTestMenuDropdown(col, row, context.menuDropdown, context.menuItems || []);
    }
  }
  
  // Test tab bar
  if (layout.tabBar && inRect(col, row, layout.tabBar)) {
    return hitTestTabBar(col, row, layout.tabBar, context.tabs || []);
  }
  
  // Test explorer
  if (layout.explorer && inRect(col, row, layout.explorer)) {
    return hitTestExplorer(col, row, layout.explorer, context.fileTree || [], context.explorerScrollTop || 0);
  }
  
  // Test editor
  if (layout.editor && inRect(col, row, layout.editor)) {
    return hitTestEditor(col, row, layout.editor, context.scrollTop || 0, context.scrollLeft || 0);
  }
  
  // Test status bar
  if (layout.statusBar && inRect(col, row, layout.statusBar)) {
    return { area: 'statusbar' };
  }
  
  return null;
}

/**
 * Check if a point is inside a rectangle
 */
function inRect(col, row, rect) {
  return col >= rect.x && col < rect.x + rect.width &&
         row >= rect.y && row < rect.y + rect.height;
}

/**
 * Hit test the menu bar
 */
function hitTestMenuBar(col, row, menuBar) {
  let x = menuBar.x; // Start at the beginning of the menu bar
  
  for (const item of menuBar.items) {
    if (col >= x && col < x + item.width) {
      return { area: 'menubar', menuId: item.id };
    }
    x += item.width + 1; // Add spacing between items (matches rendering)
  }
  
  return { area: 'menubar' };
}

/**
 * Hit test menu dropdown
 */
function hitTestMenuDropdown(col, row, dropdown, items) {
  const relRow = row - dropdown.y;
  
  if (relRow < 0 || relRow >= items.length) {
    return { area: 'menu-dropdown' };
  }
  
  const item = items[relRow];
  if (item.type === 'separator') {
    return { area: 'menu-dropdown' };
  }
  
  return { area: 'menu-dropdown', itemIndex: relRow };
}

/**
 * Hit test the tab bar
 */
function hitTestTabBar(col, row, tabBar, tabs) {
  if (!tabs || tabs.length === 0) return { area: 'tabbar' };
  
  let x = tabBar.x;
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const title = tab.title || 'Untitled';
    const tabWidth = title.length + 4; // padding + close button
    
    if (col >= x && col < x + tabWidth) {
      // Check if clicking close button (last 2 chars of tab)
      if (col >= x + tabWidth - 2) {
        return { area: 'tabbar', tabIndex: i, closeButton: true };
      }
      return { area: 'tabbar', tabIndex: i };
    }
    x += tabWidth + 1;
  }
  
  return { area: 'tabbar' };
}

/**
 * Hit test the explorer
 */
function hitTestExplorer(col, row, explorer, fileTree, scrollTop) {
  // No header row anymore - files start directly at explorer.y
  const itemRow = row - explorer.y;
  const itemIndex = itemRow + (scrollTop || 0);
  
  if (itemIndex >= 0 && itemIndex < fileTree.length) {
    return { area: 'explorer', fileIndex: itemIndex };
  }
  
  return { area: 'explorer' };
}

/**
 * Hit test the editor area
 */
function hitTestEditor(col, row, editor, scrollTop, scrollLeft) {
  const { gutterWidth } = editor;
  const relCol = col - editor.x;
  const relRow = row - editor.y;
  
  // Check if in gutter
  if (relCol < gutterWidth) {
    const line = relRow + scrollTop;
    return { area: 'editor-gutter', line };
  }
  
  // In editor content
  const textCol = relCol - gutterWidth + scrollLeft;
  const line = relRow + scrollTop;
  
  return { area: 'editor', line, col: textCol };
}

// Legacy exports for backwards compatibility
function calculateLayout(config = {}) {
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;
  const sidebarWidth = config.explorerWidth || 25;
  return computeLayout(width, height, sidebarWidth, true);
}

function getDimensions() {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

module.exports = {
  computeLayout,
  hitTest,
  hitTestMenuBar,
  hitTestMenuDropdown,
  inRect,
  calculateLayout,
  getDimensions,
  MENU_ITEMS,
};
