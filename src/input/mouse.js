/**
 * Mouse event parsing
 * Handles SGR extended mouse protocol (1006)
 */

'use strict';

/**
 * Mouse button constants
 */
const MouseButton = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
  NONE: 3,      // For motion events without button
  SCROLL_UP: 4,
  SCROLL_DOWN: 5,
};

/**
 * Mouse event types
 */
const MouseEventType = {
  DOWN: 'down',
  UP: 'up',
  MOVE: 'move',
  DRAG: 'drag',
  SCROLL: 'scroll',
};

/**
 * Parse a mouse event from raw input
 * Supports SGR extended mouse protocol (mode 1006)
 * Format: ESC [ < Cb ; Cx ; Cy M/m
 * 
 * @param {string} str - Raw input string
 * @returns {Object|null} - Parsed mouse event or null
 */
function parseMouseEvent(str) {
  // SGR mouse protocol: ESC [ < Cb ; Cx ; Cy (M|m)
  // M = button press, m = button release
  const sgrMatch = str.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
  
  if (sgrMatch) {
    const cb = parseInt(sgrMatch[1], 10);
    const cx = parseInt(sgrMatch[2], 10);
    const cy = parseInt(sgrMatch[3], 10);
    const isRelease = sgrMatch[4] === 'm';
    
    return parseSGRMouseEvent(cb, cx, cy, isRelease);
  }
  
  // X10/Normal mouse protocol: ESC [ M Cb Cx Cy (legacy, less common now)
  if (str.startsWith('\x1b[M') && str.length >= 6) {
    const cb = str.charCodeAt(3) - 32;
    const cx = str.charCodeAt(4) - 32;
    const cy = str.charCodeAt(5) - 32;
    
    return parseX10MouseEvent(cb, cx, cy);
  }
  
  return null;
}

/**
 * Parse SGR mouse event parameters
 * @param {number} cb - Button/modifier code
 * @param {number} cx - Column (1-based)
 * @param {number} cy - Row (1-based)
 * @param {boolean} isRelease - Whether this is a release event
 * @returns {Object} - Parsed mouse event
 */
function parseSGRMouseEvent(cb, cx, cy, isRelease) {
  // Button encoding in SGR:
  // Bits 0-1: button (0=left, 1=middle, 2=right, 3=none)
  // Bit 2: shift
  // Bit 3: alt/meta
  // Bit 4: ctrl
  // Bit 5: motion
  // Bits 6-7: 01 for scroll up, 10 for scroll down (added to button)
  
  const buttonBits = cb & 3;
  const shift = !!(cb & 4);
  const alt = !!(cb & 8);
  const ctrl = !!(cb & 16);
  const motion = !!(cb & 32);
  const scrollBits = (cb >> 6) & 3;
  
  // Convert to 0-based coordinates
  const col = cx - 1;
  const row = cy - 1;
  
  let button;
  let type;
  
  // Check for scroll events
  if (scrollBits === 1) {
    // Scroll up
    button = MouseButton.SCROLL_UP;
    type = MouseEventType.SCROLL;
  } else if (scrollBits === 2 || (cb >= 64 && cb < 96)) {
    // Scroll down (also handle alternate encoding)
    button = (cb & 1) ? MouseButton.SCROLL_DOWN : MouseButton.SCROLL_UP;
    type = MouseEventType.SCROLL;
  } else if (motion) {
    // Motion event
    button = buttonBits === 3 ? MouseButton.NONE : buttonBits;
    type = buttonBits === 3 ? MouseEventType.MOVE : MouseEventType.DRAG;
  } else if (isRelease) {
    // Button release
    button = buttonBits;
    type = MouseEventType.UP;
  } else {
    // Button press
    button = buttonBits;
    type = MouseEventType.DOWN;
  }
  
  return {
    type,
    button,
    col,
    row,
    shift,
    alt,
    ctrl,
    raw: { cb, cx, cy, isRelease },
  };
}

/**
 * Parse X10/Normal mouse event (legacy protocol)
 * @param {number} cb - Button/modifier code
 * @param {number} cx - Column (1-based, offset by 32)
 * @param {number} cy - Row (1-based, offset by 32)
 * @returns {Object} - Parsed mouse event
 */
function parseX10MouseEvent(cb, cx, cy) {
  const buttonBits = cb & 3;
  const shift = !!(cb & 4);
  const alt = !!(cb & 8);
  const ctrl = !!(cb & 16);
  const motion = !!(cb & 32);
  
  // X10 doesn't support button release detection well
  // Button 3 typically means release
  const isRelease = buttonBits === 3;
  
  const col = cx - 1;
  const row = cy - 1;
  
  let button;
  let type;
  
  // Check for scroll (encoded as button 64/65 in some terminals)
  if (cb >= 64 && cb < 96) {
    button = (cb & 1) ? MouseButton.SCROLL_DOWN : MouseButton.SCROLL_UP;
    type = MouseEventType.SCROLL;
  } else if (motion) {
    button = isRelease ? MouseButton.NONE : buttonBits;
    type = isRelease ? MouseEventType.MOVE : MouseEventType.DRAG;
  } else if (isRelease) {
    button = MouseButton.LEFT; // X10 doesn't tell us which button was released
    type = MouseEventType.UP;
  } else {
    button = buttonBits;
    type = MouseEventType.DOWN;
  }
  
  return {
    type,
    button,
    col,
    row,
    shift,
    alt,
    ctrl,
    raw: { cb, cx, cy },
  };
}

/**
 * Check if input might be a partial mouse sequence
 * @param {string} str - Input string
 * @returns {boolean}
 */
function isPartialMouseEvent(str) {
  // SGR partial: ESC [ < followed by digits/semicolons
  if (str.match(/^\x1b\[<[\d;]*$/)) return true;
  
  // X10 partial: ESC [ M followed by 0-2 characters
  if (str.match(/^\x1b\[M.{0,2}$/)) return true;
  
  return false;
}

/**
 * Enable mouse tracking modes
 * @returns {string} - ANSI escape sequence to enable mouse
 */
function enableMouse() {
  return (
    '\x1b[?1000h' + // Enable basic mouse mode
    '\x1b[?1002h' + // Enable button event tracking (drag)
    '\x1b[?1003h' + // Enable any event tracking (motion)
    '\x1b[?1006h'   // Enable SGR extended mode
  );
}

/**
 * Disable mouse tracking modes
 * @returns {string} - ANSI escape sequence to disable mouse
 */
function disableMouse() {
  return (
    '\x1b[?1006l' + // Disable SGR extended mode
    '\x1b[?1003l' + // Disable any event tracking
    '\x1b[?1002l' + // Disable button event tracking
    '\x1b[?1000l'   // Disable basic mouse mode
  );
}

/**
 * Get a human-readable description of a mouse event
 * @param {Object} event - Mouse event
 * @returns {string}
 */
function describeMouseEvent(event) {
  const buttonNames = ['Left', 'Middle', 'Right', 'None', 'ScrollUp', 'ScrollDown'];
  const button = buttonNames[event.button] || 'Unknown';
  const mods = [];
  if (event.ctrl) mods.push('Ctrl');
  if (event.shift) mods.push('Shift');
  if (event.alt) mods.push('Alt');
  const modStr = mods.length ? mods.join('+') + '+' : '';
  return `${modStr}${button} ${event.type} at (${event.col}, ${event.row})`;
}

module.exports = {
  MouseButton,
  MouseEventType,
  parseMouseEvent,
  isPartialMouseEvent,
  enableMouse,
  disableMouse,
  describeMouseEvent,
};
