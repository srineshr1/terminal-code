/**
 * Screen buffer with double-buffering support
 * Handles character and color storage, renders to ANSI terminal output
 */

'use strict';

class Screen {
  constructor(width = 80, height = 24) {
    this.width = width;
    this.height = height;
    
    // Each cell stores: { char, fg, bg }
    this.buffer = [];
    this._initBuffer();
  }
  
  _initBuffer() {
    this.buffer = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push({ char: ' ', fg: [255, 255, 255], bg: [0, 0, 0] });
      }
      this.buffer.push(row);
    }
  }
  
  /**
   * Resize the buffer
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this._initBuffer();
  }
  
  /**
   * Clear the buffer with default colors
   */
  clear() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = { char: ' ', fg: [255, 255, 255], bg: [0, 0, 0] };
      }
    }
  }
  
  /**
   * Write a single character at position (0-indexed)
   */
  writeChar(x, y, char, fg = [255, 255, 255], bg = [0, 0, 0]) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.buffer[y][x] = { char: char[0] || ' ', fg, bg };
  }
  
  /**
   * Write text at position (0-indexed)
   */
  writeText(x, y, text, fg = [255, 255, 255], bg = [0, 0, 0]) {
    if (y < 0 || y >= this.height) return;
    
    for (let i = 0; i < text.length; i++) {
      const col = x + i;
      if (col >= 0 && col < this.width) {
        this.buffer[y][col] = { char: text[i], fg, bg };
      }
    }
  }
  
  /**
   * Fill a rectangle with a character and colors
   */
  fillRect(x, y, width, height, char = ' ', bg = [0, 0, 0], fg = [255, 255, 255]) {
    for (let row = y; row < y + height && row < this.height; row++) {
      if (row < 0) continue;
      for (let col = x; col < x + width && col < this.width; col++) {
        if (col < 0) continue;
        this.buffer[row][col] = { char, fg, bg };
      }
    }
  }
  
  /**
   * Convert buffer to ANSI string for terminal output
   * Uses differential coloring to minimize escape codes
   */
  toString() {
    const ESC = '\x1b';
    const lines = [];
    
    for (let y = 0; y < this.height; y++) {
      let line = '';
      let currentFg = null;
      let currentBg = null;
      
      for (let x = 0; x < this.width; x++) {
        const cell = this.buffer[y][x];
        
        const fgChanged = this._colorsDifferent(cell.fg, currentFg);
        const bgChanged = this._colorsDifferent(cell.bg, currentBg);
        
        if (fgChanged || bgChanged) {
          line = line + this._colorCode(cell.fg, cell.bg);
          currentFg = cell.fg;
          currentBg = cell.bg;
        }
        
        line = line + cell.char;
      }
      
      line = line + ESC + '[0m';
      lines.push(line);
    }
    
    return lines.join('\r\n');
  }
  
  /**
   * Compare two colors (handles both arrays and scalars)
   */
  _colorsDifferent(c1, c2) {
    if (c1 === null || c2 === null) return true;
    if (Array.isArray(c1) && Array.isArray(c2)) {
      return c1[0] !== c2[0] || c1[1] !== c2[1] || c1[2] !== c2[2];
    }
    return c1 !== c2;
  }
  
  /**
   * Generate ANSI color code (24-bit true color)
   */
  _colorCode(fg, bg) {
    const ESC = '\x1b';
    let fgR, fgG, fgB, bgR, bgG, bgB;
    
    if (Array.isArray(fg)) {
      [fgR, fgG, fgB] = fg;
    } else {
      fgR = fgG = fgB = fg;
    }
    
    if (Array.isArray(bg)) {
      [bgR, bgG, bgB] = bg;
    } else {
      bgR = bgG = bgB = bg;
    }
    
    return ESC + '[38;2;' + fgR + ';' + fgG + ';' + fgB + 'm' + ESC + '[48;2;' + bgR + ';' + bgG + ';' + bgB + 'm';
  }
  
  /**
   * Generate 24-bit color code string (for external use)
   */
  static color24(fg, bg) {
    const ESC = '\x1b';
    let fgR, fgG, fgB, bgR, bgG, bgB;
    
    if (Array.isArray(fg)) {
      [fgR, fgG, fgB] = fg;
    } else {
      fgR = fgG = fgB = fg;
    }
    
    if (Array.isArray(bg)) {
      [bgR, bgG, bgB] = bg;
    } else {
      bgR = bgG = bgB = bg;
    }
    
    return ESC + '[38;2;' + fgR + ';' + fgG + ';' + fgB + 'm' + ESC + '[48;2;' + bgR + ';' + bgG + ';' + bgB + 'm';
  }
  
  /**
   * Get character at position
   */
  getChar(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.buffer[y][x];
  }
}

module.exports = Screen;
