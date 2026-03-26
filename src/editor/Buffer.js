/**
 * Text Buffer with selection support
 * Core editing model for the editor
 */

'use strict';

class Buffer {
  constructor(content = '') {
    this.lines = content ? content.split('\n') : [''];
    this.cursor = { line: 0, col: 0 };
    this.selection = null; // { anchor: {line, col}, head: {line, col} }
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }
  
  // === BUFFER MANAGEMENT ===
  
  setLines(lines) {
    this.lines = Array.isArray(lines) ? lines : [''];
    this.cursor = { line: 0, col: 0 };
    this.selection = null;
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }
  
  // === BASIC ACCESSORS ===
  
  getLine(line) {
    return this.lines[line] || '';
  }
  
  getLineCount() {
    return this.lines.length;
  }
  
  getText() {
    return this.lines.join('\n');
  }
  
  // === CURSOR MOVEMENT ===
  
  setCursor(line, col) {
    this.cursor.line = Math.max(0, Math.min(line, this.lines.length - 1));
    const lineText = this.lines[this.cursor.line] || '';
    this.cursor.col = Math.max(0, Math.min(col, lineText.length));
    this.clearSelection();
  }
  
  moveCursor(dx, dy) {
    if (dy !== 0) {
      // Vertical movement
      const newLine = Math.max(0, Math.min(this.cursor.line + dy, this.lines.length - 1));
      this.cursor.line = newLine;
      const lineText = this.lines[newLine] || '';
      this.cursor.col = Math.min(this.cursor.col, lineText.length);
    }
    
    if (dx !== 0) {
      // Horizontal movement
      const line = this.lines[this.cursor.line] || '';
      let newCol = this.cursor.col + dx;
      
      if (newCol < 0) {
        // Move to end of previous line
        if (this.cursor.line > 0) {
          this.cursor.line--;
          this.cursor.col = this.lines[this.cursor.line].length;
        }
      } else if (newCol > line.length) {
        // Move to start of next line
        if (this.cursor.line < this.lines.length - 1) {
          this.cursor.line++;
          this.cursor.col = 0;
        }
      } else {
        this.cursor.col = newCol;
      }
    }
    
    this.clearSelection();
  }
  
  moveToLineStart() {
    // Smart home: go to first non-whitespace, or to 0 if already there
    const line = this.lines[this.cursor.line] || '';
    const firstNonSpace = line.search(/\S/);
    const target = firstNonSpace === -1 ? 0 : firstNonSpace;
    
    if (this.cursor.col === target || this.cursor.col <= firstNonSpace) {
      this.cursor.col = 0;
    } else {
      this.cursor.col = target;
    }
    this.clearSelection();
  }
  
  moveToLineEnd() {
    const line = this.lines[this.cursor.line] || '';
    this.cursor.col = line.length;
    this.clearSelection();
  }
  
  moveToDocStart() {
    this.cursor.line = 0;
    this.cursor.col = 0;
    this.clearSelection();
  }
  
  moveToDocEnd() {
    this.cursor.line = this.lines.length - 1;
    this.cursor.col = this.lines[this.cursor.line].length;
    this.clearSelection();
  }
  
  moveWordLeft() {
    const line = this.lines[this.cursor.line] || '';
    
    if (this.cursor.col === 0) {
      if (this.cursor.line > 0) {
        this.cursor.line--;
        this.cursor.col = this.lines[this.cursor.line].length;
      }
      return;
    }
    
    let col = this.cursor.col - 1;
    
    // Skip whitespace
    while (col > 0 && /\s/.test(line[col])) col--;
    
    // Skip word characters
    while (col > 0 && /\w/.test(line[col - 1])) col--;
    
    this.cursor.col = col;
    this.clearSelection();
  }
  
  moveWordRight() {
    const line = this.lines[this.cursor.line] || '';
    
    if (this.cursor.col >= line.length) {
      if (this.cursor.line < this.lines.length - 1) {
        this.cursor.line++;
        this.cursor.col = 0;
      }
      return;
    }
    
    let col = this.cursor.col;
    
    // Skip current word
    while (col < line.length && /\w/.test(line[col])) col++;
    
    // Skip whitespace
    while (col < line.length && /\s/.test(line[col])) col++;
    
    this.cursor.col = col;
    this.clearSelection();
  }
  
  // === SELECTION ===
  
  hasSelection() {
    return this.selection !== null;
  }
  
  clearSelection() {
    this.selection = null;
  }
  
  setSelection(startLine, startCol, endLine, endCol) {
    this.selection = {
      anchor: { line: startLine, col: startCol },
      head: { line: endLine, col: endCol },
    };
  }
  
  /**
   * Start or extend selection
   */
  _ensureSelection() {
    if (!this.selection) {
      this.selection = {
        anchor: { line: this.cursor.line, col: this.cursor.col },
        head: { line: this.cursor.line, col: this.cursor.col },
      };
    }
  }
  
  extendSelection(dx, dy) {
    this._ensureSelection();
    
    if (dy !== 0) {
      const newLine = Math.max(0, Math.min(this.cursor.line + dy, this.lines.length - 1));
      this.cursor.line = newLine;
      const lineText = this.lines[newLine] || '';
      this.cursor.col = Math.min(this.cursor.col, lineText.length);
    }
    
    if (dx !== 0) {
      const line = this.lines[this.cursor.line] || '';
      let newCol = this.cursor.col + dx;
      
      if (newCol < 0) {
        if (this.cursor.line > 0) {
          this.cursor.line--;
          this.cursor.col = this.lines[this.cursor.line].length;
        }
      } else if (newCol > line.length) {
        if (this.cursor.line < this.lines.length - 1) {
          this.cursor.line++;
          this.cursor.col = 0;
        }
      } else {
        this.cursor.col = newCol;
      }
    }
    
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  extendSelectionTo(line, col) {
    this._ensureSelection();
    this.cursor.line = Math.max(0, Math.min(line, this.lines.length - 1));
    const lineText = this.lines[this.cursor.line] || '';
    this.cursor.col = Math.max(0, Math.min(col, lineText.length));
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  extendSelectionToLineStart() {
    this._ensureSelection();
    this.cursor.col = 0;
    this.selection.head = { line: this.cursor.line, col: 0 };
  }
  
  extendSelectionToLineEnd() {
    this._ensureSelection();
    const line = this.lines[this.cursor.line] || '';
    this.cursor.col = line.length;
    this.selection.head = { line: this.cursor.line, col: line.length };
  }
  
  extendSelectionToDocStart() {
    this._ensureSelection();
    this.cursor.line = 0;
    this.cursor.col = 0;
    this.selection.head = { line: 0, col: 0 };
  }
  
  extendSelectionToDocEnd() {
    this._ensureSelection();
    this.cursor.line = this.lines.length - 1;
    this.cursor.col = this.lines[this.cursor.line].length;
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  extendSelectionWordLeft() {
    this._ensureSelection();
    this.moveWordLeft();
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  extendSelectionWordRight() {
    this._ensureSelection();
    this.moveWordRight();
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  selectAll() {
    this.selection = {
      anchor: { line: 0, col: 0 },
      head: { line: this.lines.length - 1, col: this.lines[this.lines.length - 1].length },
    };
    this.cursor.line = this.lines.length - 1;
    this.cursor.col = this.lines[this.cursor.line].length;
  }
  
  selectLine(lineNum) {
    const line = lineNum !== undefined ? lineNum : this.cursor.line;
    const lineText = this.lines[line] || '';
    this.selection = {
      anchor: { line, col: 0 },
      head: { line, col: lineText.length },
    };
    this.cursor.line = line;
    this.cursor.col = lineText.length;
  }
  
  /**
   * Get normalized selection range (start always before end)
   */
  getSelectionRange() {
    if (!this.selection) return null;
    
    const { anchor, head } = this.selection;
    let start, end;
    
    if (anchor.line < head.line || (anchor.line === head.line && anchor.col <= head.col)) {
      start = anchor;
      end = head;
    } else {
      start = head;
      end = anchor;
    }
    
    return { start, end };
  }
  
  /**
   * Get selected text
   */
  getSelectedText() {
    const range = this.getSelectionRange();
    if (!range) return '';
    
    const { start, end } = range;
    
    if (start.line === end.line) {
      return this.lines[start.line].slice(start.col, end.col);
    }
    
    const result = [];
    result.push(this.lines[start.line].slice(start.col));
    
    for (let i = start.line + 1; i < end.line; i++) {
      result.push(this.lines[i]);
    }
    
    result.push(this.lines[end.line].slice(0, end.col));
    return result.join('\n');
  }
  
  /**
   * Alias for getSelectedText for compatibility
   */
  getSelection() {
    return this.getSelectedText();
  }
  
  /**
   * Select text by index (for search highlighting)
   */
  select(index, total) {
    // This is for search highlighting, not actual selection
    // We'll implement a visual selection marker instead
  }
  
  /**
   * Expand selection by one character
   */
  expandSelection() {
    this._ensureSelection();
    const line = this.lines[this.cursor.line] || '';
    if (this.cursor.col < line.length) {
      this.cursor.col++;
    }
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  /**
   * Shrink selection by one character
   */
  shrinkSelection() {
    if (!this.selection) return;
    const line = this.lines[this.cursor.line] || '';
    if (this.cursor.col > 0) {
      this.cursor.col--;
    }
    this.selection.head = { line: this.cursor.line, col: this.cursor.col };
  }
  
  // === EDITING ===
  
  /**
   * Insert text at cursor, replacing selection if any
   */
  insert(text) {
    if (this.selection) {
      this.deleteSelection();
    }
    
    const insertLines = text.split('\n');
    
    if (insertLines.length === 1) {
      // Single line insert
      const line = this.lines[this.cursor.line] || '';
      const before = line.slice(0, this.cursor.col);
      const after = line.slice(this.cursor.col);
      this.lines[this.cursor.line] = before + insertLines[0] + after;
      this.cursor.col += insertLines[0].length;
    } else {
      // Multi-line insert
      const line = this.lines[this.cursor.line] || '';
      const before = line.slice(0, this.cursor.col);
      const after = line.slice(this.cursor.col);
      
      // First line
      this.lines[this.cursor.line] = before + insertLines[0];
      
      // Middle lines
      for (let i = 1; i < insertLines.length - 1; i++) {
        this.lines.splice(this.cursor.line + i, 0, insertLines[i]);
      }
      
      // Last line
      const lastInsertLine = insertLines[insertLines.length - 1];
      this.lines.splice(this.cursor.line + insertLines.length - 1, 0, lastInsertLine + after);
      
      // Update cursor
      this.cursor.line += insertLines.length - 1;
      this.cursor.col = lastInsertLine.length;
    }
  }
  
  insertNewline() {
    if (this.selection) {
      this.deleteSelection();
    }
    
    const line = this.lines[this.cursor.line] || '';
    const before = line.slice(0, this.cursor.col);
    const after = line.slice(this.cursor.col);
    
    // Auto-indent: match leading whitespace
    const indent = before.match(/^[\t ]*/)[0];
    
    this.lines[this.cursor.line] = before;
    this.lines.splice(this.cursor.line + 1, 0, indent + after);
    this.cursor.line++;
    this.cursor.col = indent.length;
  }
  
  backspace() {
    if (this.selection) {
      this.deleteSelection();
      return;
    }
    
    if (this.cursor.col === 0 && this.cursor.line === 0) {
      return; // Nothing to delete
    }
    
    if (this.cursor.col === 0) {
      // Join with previous line
      const prevLine = this.lines[this.cursor.line - 1];
      const currLine = this.lines[this.cursor.line];
      this.lines[this.cursor.line - 1] = prevLine + currLine;
      this.lines.splice(this.cursor.line, 1);
      this.cursor.line--;
      this.cursor.col = prevLine.length;
    } else {
      // Delete character before cursor
      const line = this.lines[this.cursor.line];
      this.lines[this.cursor.line] = line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col);
      this.cursor.col--;
    }
  }
  
  delete() {
    if (this.selection) {
      this.deleteSelection();
      return;
    }
    
    const line = this.lines[this.cursor.line] || '';
    
    if (this.cursor.col >= line.length) {
      // At end of line, join with next
      if (this.cursor.line < this.lines.length - 1) {
        this.lines[this.cursor.line] = line + this.lines[this.cursor.line + 1];
        this.lines.splice(this.cursor.line + 1, 1);
      }
    } else {
      // Delete character at cursor
      this.lines[this.cursor.line] = line.slice(0, this.cursor.col) + line.slice(this.cursor.col + 1);
    }
  }
  
  deleteSelection() {
    const range = this.getSelectionRange();
    if (!range) return;
    
    const { start, end } = range;
    
    if (start.line === end.line) {
      // Same line
      const line = this.lines[start.line];
      this.lines[start.line] = line.slice(0, start.col) + line.slice(end.col);
    } else {
      // Multi-line
      const startLine = this.lines[start.line].slice(0, start.col);
      const endLine = this.lines[end.line].slice(end.col);
      this.lines.splice(start.line, end.line - start.line + 1, startLine + endLine);
    }
    
    this.cursor.line = start.line;
    this.cursor.col = start.col;
    this.clearSelection();
  }
  
  indent() {
    if (this.selection) {
      // Indent all selected lines
      const range = this.getSelectionRange();
      for (let i = range.start.line; i <= range.end.line; i++) {
        this.lines[i] = '  ' + this.lines[i];
      }
      this.selection.anchor.col += 2;
      this.selection.head.col += 2;
      this.cursor.col += 2;
    } else {
      // Insert 2 spaces at cursor
      this.insert('  ');
    }
  }
  
  outdent() {
    if (this.selection) {
      // Outdent all selected lines
      const range = this.getSelectionRange();
      for (let i = range.start.line; i <= range.end.line; i++) {
        const line = this.lines[i];
        if (line.startsWith('  ')) {
          this.lines[i] = line.slice(2);
        } else if (line.startsWith('\t')) {
          this.lines[i] = line.slice(1);
        } else if (line.startsWith(' ')) {
          this.lines[i] = line.slice(1);
        }
      }
    } else {
      // Outdent current line
      const line = this.lines[this.cursor.line];
      if (line.startsWith('  ')) {
        this.lines[this.cursor.line] = line.slice(2);
        this.cursor.col = Math.max(0, this.cursor.col - 2);
      } else if (line.startsWith('\t')) {
        this.lines[this.cursor.line] = line.slice(1);
        this.cursor.col = Math.max(0, this.cursor.col - 1);
      } else if (line.startsWith(' ')) {
        this.lines[this.cursor.line] = line.slice(1);
        this.cursor.col = Math.max(0, this.cursor.col - 1);
      }
    }
  }
  
  // === LINE OPERATIONS ===
  
  duplicateLine() {
    const line = this.lines[this.cursor.line];
    this.lines.splice(this.cursor.line + 1, 0, line);
    this.cursor.line++;
  }
  
  deleteLine() {
    this.lines.splice(this.cursor.line, 1);
    
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    
    if (this.cursor.line >= this.lines.length) {
      this.cursor.line = this.lines.length - 1;
    }
    
    const lineLen = this.lines[this.cursor.line].length;
    if (this.cursor.col > lineLen) {
      this.cursor.col = lineLen;
    }
  }
  
  moveLineUp() {
    if (this.cursor.line === 0) return;
    
    const line = this.lines[this.cursor.line];
    this.lines.splice(this.cursor.line, 1);
    this.lines.splice(this.cursor.line - 1, 0, line);
    this.cursor.line--;
  }
  
  moveLineDown() {
    if (this.cursor.line >= this.lines.length - 1) return;
    
    const line = this.lines[this.cursor.line];
    this.lines.splice(this.cursor.line, 1);
    this.lines.splice(this.cursor.line + 1, 0, line);
    this.cursor.line++;
  }
  
  insertLineBelow() {
    this.lines.splice(this.cursor.line + 1, 0, '');
    this.cursor.line++;
    this.cursor.col = 0;
  }
  
  insertLineAbove() {
    this.lines.splice(this.cursor.line, 0, '');
    this.cursor.col = 0;
  }
  
  // === REPLACE ===
  
  replaceRange(startLine, startCol, endLine, endCol, text) {
    // Delete the range
    if (startLine === endLine) {
      const line = this.lines[startLine];
      this.lines[startLine] = line.slice(0, startCol) + text + line.slice(endCol);
    } else {
      const startLineText = this.lines[startLine].slice(0, startCol);
      const endLineText = this.lines[endLine].slice(endCol);
      this.lines.splice(startLine, endLine - startLine + 1, startLineText + text + endLineText);
    }
    
    // Position cursor at end of replacement
    const insertLines = text.split('\n');
    if (insertLines.length === 1) {
      this.cursor.line = startLine;
      this.cursor.col = startCol + text.length;
    } else {
      this.cursor.line = startLine + insertLines.length - 1;
      this.cursor.col = insertLines[insertLines.length - 1].length;
    }
  }
  
  // === STATE MANAGEMENT ===
  
  getState() {
    return {
      lines: [...this.lines],
      cursor: { ...this.cursor },
      selection: this.selection ? {
        anchor: { ...this.selection.anchor },
        head: { ...this.selection.head },
      } : null,
      scrollTop: this.scrollTop,
      scrollLeft: this.scrollLeft,
    };
  }
  
  setState(state) {
    this.lines = [...state.lines];
    this.cursor = { ...state.cursor };
    this.selection = state.selection ? {
      anchor: { ...state.selection.anchor },
      head: { ...state.selection.head },
    } : null;
    this.scrollTop = state.scrollTop || 0;
    this.scrollLeft = state.scrollLeft || 0;
  }
}

module.exports = Buffer;
