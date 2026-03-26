/**
 * Keyboard event parsing
 * Parses raw terminal input into structured key events
 */

'use strict';

/**
 * Parse a raw input buffer into a key event object
 * Handles ANSI escape sequences, control characters, and regular keys
 * 
 * @param {Buffer|string} data - Raw input data
 * @returns {Object|null} - Parsed key event { key, ctrl, shift, alt, raw }
 */
function parseKeyEvent(data) {
  const str = typeof data === 'string' ? data : data.toString('utf8');
  
  if (str.length === 0) return null;
  
  // Check for escape sequences first
  if (str.startsWith('\x1b')) {
    return parseEscapeSequence(str);
  }
  
  // Control characters (Ctrl+A through Ctrl+Z)
  const code = str.charCodeAt(0);
  if (code >= 1 && code <= 26) {
    // Ctrl+A = 1, Ctrl+B = 2, etc.
    const letter = String.fromCharCode(code + 96); // 1 -> 'a', 2 -> 'b', etc.
    return { key: letter, ctrl: true, shift: false, alt: false, raw: str };
  }
  
  // Special control codes
  if (code === 0) {
    // Ctrl+Space or Ctrl+@ 
    return { key: 'Space', ctrl: true, shift: false, alt: false, raw: str };
  }
  if (code === 27) {
    // Escape key alone
    return { key: 'Escape', ctrl: false, shift: false, alt: false, raw: str };
  }
  if (code === 127) {
    // Backspace (DEL)
    return { key: 'Backspace', ctrl: false, shift: false, alt: false, raw: str };
  }
  if (code === 8) {
    // Ctrl+Backspace or Backspace on some terminals
    return { key: 'Backspace', ctrl: true, shift: false, alt: false, raw: str };
  }
  if (code === 9) {
    // Tab
    return { key: 'Tab', ctrl: false, shift: false, alt: false, raw: str };
  }
  if (code === 13 || code === 10) {
    // Enter
    return { key: 'Enter', ctrl: false, shift: false, alt: false, raw: str };
  }
  
  // Regular printable character
  if (str.length === 1 && code >= 32) {
    return { key: str, ctrl: false, shift: false, alt: false, raw: str };
  }
  
  // Multi-byte UTF-8 character
  if (str.length > 1 && !str.startsWith('\x1b')) {
    return { key: str.charAt(0), ctrl: false, shift: false, alt: false, raw: str };
  }
  
  return null;
}

/**
 * Parse an ANSI escape sequence into a key event
 * @param {string} str - String starting with ESC
 * @returns {Object|null} - Parsed key event
 */
function parseEscapeSequence(str) {
  // Alt+key: ESC followed by a character
  if (str.length === 2 && str.charCodeAt(1) >= 32) {
    return { key: str[1], ctrl: false, shift: false, alt: true, raw: str };
  }
  
  // CSI sequences: ESC [
  if (str.startsWith('\x1b[')) {
    return parseCSISequence(str);
  }
  
  // SS3 sequences: ESC O (some terminals use this for F1-F4)
  if (str.startsWith('\x1bO')) {
    return parseSS3Sequence(str);
  }
  
  // Just escape
  if (str === '\x1b') {
    return { key: 'Escape', ctrl: false, shift: false, alt: false, raw: str };
  }
  
  return null;
}

/**
 * Parse CSI (Control Sequence Introducer) sequences
 * Format: ESC [ <params> <final>
 * @param {string} str - CSI sequence
 * @returns {Object|null} - Parsed key event
 */
function parseCSISequence(str) {
  // Remove ESC [
  const seq = str.slice(2);
  
  // Arrow keys: ESC [ A/B/C/D
  if (seq === 'A') return { key: 'ArrowUp', ctrl: false, shift: false, alt: false, raw: str };
  if (seq === 'B') return { key: 'ArrowDown', ctrl: false, shift: false, alt: false, raw: str };
  if (seq === 'C') return { key: 'ArrowRight', ctrl: false, shift: false, alt: false, raw: str };
  if (seq === 'D') return { key: 'ArrowLeft', ctrl: false, shift: false, alt: false, raw: str };
  
  // Home/End: ESC [ H/F
  if (seq === 'H') return { key: 'Home', ctrl: false, shift: false, alt: false, raw: str };
  if (seq === 'F') return { key: 'End', ctrl: false, shift: false, alt: false, raw: str };
  
  // Modified arrow keys: ESC [ 1 ; <mod> A/B/C/D
  const modArrowMatch = seq.match(/^1;(\d+)([ABCD])$/);
  if (modArrowMatch) {
    const mod = parseInt(modArrowMatch[1], 10);
    const dir = modArrowMatch[2];
    const mods = parseModifier(mod);
    const keyMap = { A: 'ArrowUp', B: 'ArrowDown', C: 'ArrowRight', D: 'ArrowLeft' };
    return { key: keyMap[dir], ...mods, raw: str };
  }
  
  // Extended keys with modifiers: ESC [ <code> ; <mod> ~
  const extendedMatch = seq.match(/^(\d+);(\d+)~$/);
  if (extendedMatch) {
    const code = parseInt(extendedMatch[1], 10);
    const mod = parseInt(extendedMatch[2], 10);
    const keyName = getExtendedKeyName(code);
    if (keyName) {
      const mods = parseModifier(mod);
      return { key: keyName, ...mods, raw: str };
    }
  }
  
  // Extended keys without modifiers: ESC [ <code> ~
  const extendedNoModMatch = seq.match(/^(\d+)~$/);
  if (extendedNoModMatch) {
    const code = parseInt(extendedNoModMatch[1], 10);
    const keyName = getExtendedKeyName(code);
    if (keyName) {
      return { key: keyName, ctrl: false, shift: false, alt: false, raw: str };
    }
  }
  
  // F1-F4 on some terminals: ESC [ [ A/B/C/D
  if (seq.startsWith('[')) {
    const fKey = seq[1];
    if (fKey >= 'A' && fKey <= 'D') {
      return { key: `F${fKey.charCodeAt(0) - 64}`, ctrl: false, shift: false, alt: false, raw: str };
    }
  }
  
  // Shift+Tab: ESC [ Z
  if (seq === 'Z') {
    return { key: 'Tab', ctrl: false, shift: true, alt: false, raw: str };
  }
  
  return null;
}

/**
 * Parse SS3 sequences (used by some terminals for F1-F4)
 * Format: ESC O <final>
 * @param {string} str - SS3 sequence
 * @returns {Object|null} - Parsed key event
 */
function parseSS3Sequence(str) {
  const final = str[2];
  
  // F1-F4
  if (final === 'P') return { key: 'F1', ctrl: false, shift: false, alt: false, raw: str };
  if (final === 'Q') return { key: 'F2', ctrl: false, shift: false, alt: false, raw: str };
  if (final === 'R') return { key: 'F3', ctrl: false, shift: false, alt: false, raw: str };
  if (final === 'S') return { key: 'F4', ctrl: false, shift: false, alt: false, raw: str };
  
  // Home/End on some terminals
  if (final === 'H') return { key: 'Home', ctrl: false, shift: false, alt: false, raw: str };
  if (final === 'F') return { key: 'End', ctrl: false, shift: false, alt: false, raw: str };
  
  return null;
}

/**
 * Get key name from extended key code (used in CSI sequences)
 * @param {number} code - Key code
 * @returns {string|null} - Key name
 */
function getExtendedKeyName(code) {
  const keyMap = {
    1: 'Home',
    2: 'Insert',
    3: 'Delete',
    4: 'End',
    5: 'PageUp',
    6: 'PageDown',
    7: 'Home',
    8: 'End',
    11: 'F1',
    12: 'F2',
    13: 'F3',
    14: 'F4',
    15: 'F5',
    17: 'F6',
    18: 'F7',
    19: 'F8',
    20: 'F9',
    21: 'F10',
    23: 'F11',
    24: 'F12',
  };
  return keyMap[code] || null;
}

/**
 * Parse modifier byte from CSI sequences
 * Modifier = 1 + (shift ? 1 : 0) + (alt ? 2 : 0) + (ctrl ? 4 : 0)
 * @param {number} mod - Modifier byte
 * @returns {Object} - { ctrl, shift, alt }
 */
function parseModifier(mod) {
  const val = mod - 1;
  return {
    shift: !!(val & 1),
    alt: !!(val & 2),
    ctrl: !!(val & 4),
  };
}

/**
 * Check if input might be a partial escape sequence
 * (i.e., more bytes might be coming)
 * @param {string} str - Input string
 * @returns {boolean}
 */
function isPartialEscape(str) {
  if (!str.startsWith('\x1b')) return false;
  if (str === '\x1b') return true;
  if (str === '\x1b[') return true;
  if (str === '\x1bO') return true;
  
  // CSI sequence that might need more chars
  if (str.startsWith('\x1b[')) {
    const seq = str.slice(2);
    // If it ends with a digit or semicolon, might be incomplete
    if (/[\d;]$/.test(seq)) return true;
  }
  
  return false;
}

/**
 * Check if this is a mouse event (starts with mouse escape sequence)
 * @param {string} str - Input string
 * @returns {boolean}
 */
function isMouseEvent(str) {
  // SGR mouse: ESC [ < ...
  if (str.startsWith('\x1b[<')) return true;
  // X10/Normal mouse: ESC [ M ...
  if (str.startsWith('\x1b[M')) return true;
  return false;
}

module.exports = {
  parseKeyEvent,
  isPartialEscape,
  isMouseEvent,
};
