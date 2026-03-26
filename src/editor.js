// src/editor.js
// Editable line-buffer model for a terminal text editor

class Editor {
  constructor() {
    // Buffer is an array of strings, each string is a line
    this.lines = [''];
    // Cursor position: { row, col } where row is line index, col is character index in that line
    this.cursor = { row: 0, col: 0 };
  }

  // Insert a character at the cursor position
  insertChar(char) {
    const { row, col } = this.cursor;
    const line = this.lines[row];
    this.lines[row] = line.slice(0, col) + char + line.slice(col);
    this.cursor.col += 1;
  }

  // Insert a newline at the cursor position (split the line)
  insertNewline() {
    const { row, col } = this.cursor;
    const line = this.lines[row];
    const before = line.slice(0, col);
    const after = line.slice(col);
    this.lines[row] = before;
    this.lines.splice(row + 1, 0, after);
    this.cursor = { row: row + 1, col: 0 };
  }

  // Delete character before cursor (backspace)
  backspace() {
    const { row, col } = this.cursor;
    if (col === 0 && row === 0) {
      // At start of buffer, nothing to delete
      return;
    }
    if (col === 0) {
      // At start of line, join with previous line
      const prevLine = this.lines[row - 1];
      this.lines[row - 1] = prevLine + this.lines[row];
      this.lines.splice(row, 1);
      this.cursor = { row: row - 1, col: prevLine.length };
    } else {
      // Delete character before cursor in same line
      const line = this.lines[row];
      this.lines[row] = line.slice(0, col - 1) + line.slice(col);
      this.cursor.col -= 1;
    }
  }

  // Delete character at cursor (delete key)
  delete() {
    const { row, col } = this.cursor;
    const line = this.lines[row];
    if (col >= line.length) {
      // At end of line, join with next line if exists
      if (row + 1 < this.lines.length) {
        const nextLine = this.lines[row + 1];
        this.lines[row] = line + nextLine;
        this.lines.splice(row + 1, 1);
        // cursor stays at same position (end of merged line)
      }
      // else: at end of buffer, nothing to delete
    } else {
      // Delete character at cursor in same line
      this.lines[row] = line.slice(0, col) + line.slice(col + 1);
      // cursor stays at same column (now points to next character)
    }
  }

  // Move cursor up
  moveUp() {
    if (this.cursor.row > 0) {
      this.cursor.row -= 1;
      // Adjust column if new line is shorter
      const maxCol = this.lines[this.cursor.row].length;
      if (this.cursor.col > maxCol) {
        this.cursor.col = maxCol;
      }
    }
  }

  // Move cursor down
  moveDown() {
    if (this.cursor.row < this.lines.length - 1) {
      this.cursor.row += 1;
      // Adjust column if new line is shorter
      const maxCol = this.lines[this.cursor.row].length;
      if (this.cursor.col > maxCol) {
        this.cursor.col = maxCol;
      }
    }
  }

  // Move cursor left
  moveLeft() {
    if (this.cursor.col > 0) {
      this.cursor.col -= 1;
    } else if (this.cursor.row > 0) {
      // Move to end of previous line
      this.cursor.row -= 1;
      this.cursor.col = this.lines[this.cursor.row].length;
    }
  }

  // Move cursor right
  moveRight() {
    const { row, col } = this.cursor;
    const line = this.lines[row];
    if (col < line.length) {
      this.cursor.col += 1;
    } else if (row < this.lines.length - 1) {
      // Move to start of next line
      this.cursor.row += 1;
      this.cursor.col = 0;
    }
  }

  // Get current line text
  getLine() {
    return this.lines[this.cursor.row];
  }

  // Get current cursor position
  getCursor() {
    return { ...this.cursor };
  }

  // Set buffer lines (for loading file)
  setLines(lines) {
    const maxLines = 200000;
    if (Array.isArray(lines) && lines.length > maxLines) {
      throw new Error(`File has too many lines (${lines.length}, max ${maxLines})`);
    }
    this.lines = lines.slice(); // copy
    // Ensure cursor is within bounds
    if (this.cursor.row >= this.lines.length) {
      this.cursor.row = Math.max(0, this.lines.length - 1);
    }
    const maxCol = this.lines[this.cursor.row].length;
    if (this.cursor.col > maxCol) {
      this.cursor.col = maxCol;
    }
  }

  // Serialize buffer to string (for saving)
  serialize() {
    return this.lines.join('\n');
  }
}

module.exports = Editor;
