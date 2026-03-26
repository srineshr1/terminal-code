// src/ansi.js
// ANSI escape code helpers for terminal rendering

// ANSI escape sequence prefix
const ESC = '\x1b';

// CSI (Control Sequence Introducer) sequences
const CSI = `${ESC}[`;

// Reset codes
const RESET = `${CSI}0m`;

// Color codes
const COLORS = {
  // Foreground colors
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  default: '39',
  
  // Bright foreground colors
  brightBlack: '90',
  brightRed: '91',
  brightGreen: '92',
  brightYellow: '93',
  brightBlue: '94',
  brightMagenta: '95',
  brightCyan: '96',
  brightWhite: '97',
  
  // Background colors
  bgBlack: '40',
  bgRed: '41',
  bgGreen: '42',
  bgYellow: '43',
  bgBlue: '44',
  bgMagenta: '45',
  bgCyan: '46',
  bgWhite: '47',
  
  // Bright background colors
  bgBrightBlack: '100',
  bgBrightRed: '101',
  bgBrightGreen: '102',
  bgBrightYellow: '103',
  bgBrightBlue: '104',
  bgBrightMagenta: '105',
  bgBrightCyan: '106',
  bgBrightWhite: '107',
};

/**
 * Apply foreground color
 * @param {string} color - Color name from COLORS
 * @returns {string} ANSI escape sequence
 */
function fg(color) {
  return `${CSI}${COLORS[color] || COLORS.default}m`;
}

/**
 * Apply background color
 * @param {string} color - Color name from COLORS (use 'bg' prefix)
 * @returns {string} ANSI escape sequence
 */
function bg(color) {
  const name = String(color || 'bgBlack');
  if (name.startsWith('bg')) {
    return `${CSI}${COLORS[name] || COLORS.bgBlack}m`;
  }
  const mapped = `bg${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return `${CSI}${COLORS[mapped] || COLORS.bgBlack}m`;
}

/**
 * Apply text style
 * @param {string} style - Style: 'bold', 'dim', 'italic', 'underline', 'blink', 'reverse', 'hidden', 'strikethrough'
 * @returns {string} ANSI escape sequence
 */
const STYLES = {
  bold: '1',
  dim: '2',
  italic: '3',
  underline: '4',
  blink: '5',
  reverse: '7',
  hidden: '8',
  strikethrough: '9'
};

function style(name) {
  return `${CSI}${STYLES[name] || '0'}m`;
}

/**
 * Move cursor to position (1-indexed)
 * @param {number} row - Row number (1-based)
 * @param {number} col - Column number (1-based)
 * @returns {string} ANSI escape sequence
 */
function cursorTo(row, col) {
  return `${CSI}${row};${col}H`;
}

/**
 * Move cursor up n lines
 * @param {number} n - Number of lines
 * @returns {string} ANSI escape sequence
 */
function cursorUp(n = 1) {
  return `${CSI}${n}A`;
}

/**
 * Move cursor down n lines
 * @param {number} n - Number of lines
 * @returns {string} ANSI escape sequence
 */
function cursorDown(n = 1) {
  return `${CSI}${n}B`;
}

/**
 * Move cursor forward n columns
 * @param {number} n - Number of columns
 * @returns {string} ANSI escape sequence
 */
function cursorForward(n = 1) {
  return `${CSI}${n}C`;
}

/**
 * Move cursor backward n columns
 * @param {number} n - Number of columns
 * @returns {string} ANSI escape sequence
 */
function cursorBackward(n = 1) {
  return `${CSI}${n}D`;
}

/**
 * Clear screen
 * @param {string} mode - 'all', 'fromCursor', 'toCursor' (default: 'all')
 * @returns {string} ANSI escape sequence
 */
function clearScreen(mode = 'all') {
  const modes = {
    all: '2J',
    fromCursor: 'J',
    toCursor: '1J'
  };
  return `${CSI}${modes[mode] || '2J'}`;
}

/**
 * Clear current line
 * @param {string} mode - 'all', 'fromCursor', 'toCursor' (default: 'all')
 * @returns {string} ANSI escape sequence
 */
function clearLine(mode = 'all') {
  const modes = {
    all: '2K',
    fromCursor: 'K',
    toCursor: '1K'
  };
  return `${CSI}${modes[mode] || '2K'}`;
}

/**
 * Show/hide cursor
 * @param {boolean} visible - Whether cursor should be visible
 * @returns {string} ANSI escape sequence
 */
function showCursor(visible = true) {
  return visible ? `${CSI}?25h` : `${CSI}?25l`;
}

/**
 * Enable/disable alternate screen buffer
 * @param {boolean} enable - Whether to enable alternate screen
 * @returns {string} ANSI escape sequence
 */
function alternateScreen(enable = true) {
  return enable ? `${ESC}[?1049h` : `${ESC}[?1049l`;
}

/**
 * Get terminal size (columns x rows)
 * @returns {{cols: number, rows: number}}
 */
function getTerminalSize() {
  return {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24
  };
}

/**
 * Create a string repeated n times
 * @param {string} str - String to repeat
 * @param {number} n - Number of times
 * @returns {string}
 */
function repeat(str, n) {
  return str.repeat(n);
}

/**
 * Pad string to specified length
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @param {string} char - Padding character (default: ' ')
 * @param {string} align - 'left', 'right', 'center'
 * @returns {string}
 */
function pad(str, length, char = ' ', align = 'left') {
  const s = String(str);
  const len = s.length;
  if (len >= length) return s;
  
  const padding = repeat(char, length - len);
  switch (align) {
    case 'right': return padding + s;
    case 'center': 
      const leftPad = Math.floor(padding.length / 2);
      return padding.slice(0, leftPad) + s + padding.slice(leftPad);
    default: return s + padding;
  }
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @returns {string}
 */
function truncate(str, length) {
  const s = String(str);
  if (s.length <= length) return s;
  return s.slice(0, length - 1) + '…';
}

function sanitizeTerminalText(value) {
  return String(value == null ? '' : value)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/[\r\n]/g, ' ');
}

module.exports = {
  ESC,
  CSI,
  RESET,
  COLORS,
  fg,
  bg,
  style,
  cursorTo,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBackward,
  clearScreen,
  clearLine,
  showCursor,
  alternateScreen,
  getTerminalSize,
  repeat,
  pad,
  truncate,
  sanitizeTerminalText
};
