/**
 * Keybinding definitions - Maps key combinations to actions
 * VSCode-style keybindings for the editor
 */

'use strict';

// Keybinding format: { key, ctrl, shift, alt, action, args? }
// Actions are string identifiers that the input handler dispatches

const keybindings = [
  // === FILE OPERATIONS ===
  { key: 'n', ctrl: true, action: 'file.new' },
  { key: 'o', ctrl: true, action: 'file.open' },
  { key: 'o', ctrl: true, shift: true, action: 'file.openFolder' },
  { key: 's', ctrl: true, action: 'file.save' },
  { key: 's', ctrl: true, shift: true, action: 'file.saveAs' },
  { key: 'r', ctrl: true, shift: true, action: 'file.rename' },
  { key: 'd', ctrl: true, shift: true, action: 'file.delete' },
  { key: 'w', ctrl: true, action: 'tab.close' },
  { key: 'q', ctrl: true, action: 'app.quit' },
  
  // === TAB NAVIGATION ===
  { key: 'Tab', ctrl: true, action: 'tab.next' },
  { key: 'Tab', ctrl: true, shift: true, action: 'tab.prev' },
  { key: 'PageDown', ctrl: true, action: 'tab.next' },
  { key: 'PageUp', ctrl: true, action: 'tab.prev' },
  { key: ']', alt: true, action: 'tab.next' },
  { key: '[', alt: true, action: 'tab.prev' },
  { key: 'w', alt: true, action: 'tab.close' },
  { key: '1', ctrl: true, action: 'tab.goto', args: { index: 0 } },
  { key: '2', ctrl: true, action: 'tab.goto', args: { index: 1 } },
  { key: '3', ctrl: true, action: 'tab.goto', args: { index: 2 } },
  { key: '4', ctrl: true, action: 'tab.goto', args: { index: 3 } },
  { key: '5', ctrl: true, action: 'tab.goto', args: { index: 4 } },
  { key: '6', ctrl: true, action: 'tab.goto', args: { index: 5 } },
  { key: '7', ctrl: true, action: 'tab.goto', args: { index: 6 } },
  { key: '8', ctrl: true, action: 'tab.goto', args: { index: 7 } },
  { key: '9', ctrl: true, action: 'tab.goto', args: { index: 8 } },
  
  // === EDIT - CLIPBOARD ===
  { key: 'c', ctrl: true, action: 'edit.copy' },
  { key: 'x', ctrl: true, action: 'edit.cut' },
  { key: 'v', ctrl: true, action: 'edit.paste' },
  
  // === EDIT - UNDO/REDO ===
  { key: 'z', ctrl: true, action: 'edit.undo' },
  { key: 'y', ctrl: true, action: 'edit.redo' },
  { key: 'z', ctrl: true, shift: true, action: 'edit.redo' },
  
  // === EDIT - LINE OPERATIONS ===
  { key: 'd', ctrl: true, action: 'edit.duplicateLine' },
  { key: 'k', ctrl: true, shift: true, action: 'edit.deleteLine' },
  { key: 'ArrowUp', alt: true, action: 'edit.moveLineUp' },
  { key: 'ArrowDown', alt: true, action: 'edit.moveLineDown' },
  { key: 'Enter', ctrl: true, action: 'edit.insertLineBelow' },
  { key: 'Enter', ctrl: true, shift: true, action: 'edit.insertLineAbove' },
  
  // === SELECTION ===
  { key: 'a', ctrl: true, action: 'select.all' },
  { key: 'l', ctrl: true, action: 'select.line' },
  { key: 'ArrowLeft', shift: true, action: 'select.left' },
  { key: 'ArrowRight', shift: true, action: 'select.right' },
  { key: 'ArrowUp', shift: true, action: 'select.up' },
  { key: 'ArrowDown', shift: true, action: 'select.down' },
  { key: 'Home', shift: true, action: 'select.lineStart' },
  { key: 'End', shift: true, action: 'select.lineEnd' },
  { key: 'Home', ctrl: true, shift: true, action: 'select.docStart' },
  { key: 'End', ctrl: true, shift: true, action: 'select.docEnd' },
  { key: 'ArrowLeft', ctrl: true, shift: true, action: 'select.shrink' },
  { key: 'ArrowRight', ctrl: true, shift: true, action: 'select.expand' },
  
  // === NAVIGATION - CURSOR ===
  { key: 'ArrowLeft', action: 'cursor.left' },
  { key: 'ArrowRight', action: 'cursor.right' },
  { key: 'ArrowUp', action: 'cursor.up' },
  { key: 'ArrowDown', action: 'cursor.down' },
  { key: 'Home', action: 'cursor.lineStart' },
  { key: 'End', action: 'cursor.lineEnd' },
  { key: 'Home', ctrl: true, action: 'cursor.docStart' },
  { key: 'End', ctrl: true, action: 'cursor.docEnd' },
  { key: 'ArrowLeft', ctrl: true, action: 'cursor.wordLeft' },
  { key: 'ArrowRight', ctrl: true, action: 'cursor.wordRight' },
  { key: 'PageUp', action: 'cursor.pageUp' },
  { key: 'PageDown', action: 'cursor.pageDown' },
  
  // === NAVIGATION - GO TO ===
  { key: 'g', ctrl: true, action: 'goto.line' },
  { key: 'p', ctrl: true, action: 'goto.file' },
  
  // === SEARCH ===
  { key: 'f', ctrl: true, action: 'search.open' },
  { key: 'h', ctrl: true, action: 'search.openReplace' },
  { key: 'F3', action: 'search.next' },
  { key: 'F3', shift: true, action: 'search.prev' },
  { key: 'g', ctrl: true, shift: true, action: 'search.next' },
  { key: 'Escape', action: 'search.close' },
  
  // === VIEW ===
  { key: 'b', ctrl: true, action: 'view.toggleSidebar' },
  { key: 'Tab', action: 'view.cycleFocus' }, // Tab without modifiers cycles focus
  { key: '=', ctrl: true, action: 'view.zoomIn' },
  { key: '-', ctrl: true, action: 'view.zoomOut' },
  
  // === EDITING KEYS ===
  { key: 'Backspace', action: 'edit.backspace' },
  { key: 'Delete', action: 'edit.delete' },
  { key: 'Enter', action: 'edit.newline' },
  { key: 'Tab', action: 'edit.indent' },  // Will be overridden in certain contexts
  { key: 'Tab', shift: true, action: 'edit.outdent' },
  
  // === EXPLORER SPECIFIC (when explorer focused) ===
  { key: 'n', ctrl: true, shift: true, action: 'explorer.newFile', context: 'explorer' },
  { key: 'n', ctrl: true, alt: true, action: 'explorer.newFolder', context: 'explorer' },
  { key: 'F2', action: 'explorer.rename', context: 'explorer' },
  { key: 'Delete', action: 'explorer.delete', context: 'explorer' },
  { key: 'Enter', action: 'explorer.open', context: 'explorer' },
  { key: 'ArrowUp', action: 'explorer.up', context: 'explorer' },
  { key: 'ArrowDown', action: 'explorer.down', context: 'explorer' },
  { key: 'ArrowLeft', action: 'explorer.collapse', context: 'explorer' },
  { key: 'ArrowRight', action: 'explorer.expand', context: 'explorer' },
];

/**
 * Find a keybinding that matches the given key event
 * @param {Object} event - { key, ctrl, shift, alt }
 * @param {string} context - Current focus context ('editor', 'explorer', 'search')
 * @returns {Object|null} - Matching keybinding or null
 */
function findKeybinding(event, context = 'editor') {
  const { key, ctrl = false, shift = false, alt = false } = event;
  
  // First try to find a context-specific binding (MUST match context)
  let binding = keybindings.find(b => {
    if (!b.context) return false; // Skip bindings without context
    if (b.context !== context) return false;
    if (b.key !== key) return false;
    if (!!b.ctrl !== ctrl) return false;
    if (!!b.shift !== shift) return false;
    if (!!b.alt !== alt) return false;
    return true;
  });
  
  // If no context-specific binding, try global bindings (no context)
  if (!binding) {
    binding = keybindings.find(b => {
      if (b.context) return false; // Skip context-specific bindings
      if (b.key !== key) return false;
      if (!!b.ctrl !== ctrl) return false;
      if (!!b.shift !== shift) return false;
      if (!!b.alt !== alt) return false;
      return true;
    });
  }
  
  return binding || null;
}

/**
 * Get all keybindings for a specific action
 * @param {string} action - Action identifier
 * @returns {Array} - Array of keybindings for that action
 */
function getKeybindingsForAction(action) {
  return keybindings.filter(b => b.action === action);
}

/**
 * Format a keybinding for display
 * @param {Object} binding - Keybinding object
 * @returns {string} - Human-readable key combination
 */
function formatKeybinding(binding) {
  const parts = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.shift) parts.push('Shift');
  if (binding.alt) parts.push('Alt');
  
  let key = binding.key;
  // Prettify key names
  if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'ArrowLeft') key = '←';
  else if (key === 'ArrowRight') key = '→';
  else if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  return parts.join('+');
}

module.exports = {
  keybindings,
  findKeybinding,
  getKeybindingsForAction,
  formatKeybinding
};
