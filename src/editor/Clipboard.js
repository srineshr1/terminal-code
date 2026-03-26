// src/editor/Clipboard.js
// Simple clipboard utility for copy/cut/paste operations

class Clipboard {
  constructor() {
    this.text = '';
    this.type = null; // 'copy' or 'cut'
  }

  copy(text) {
    this.text = text;
    this.type = 'copy';
  }

  cut(text) {
    this.text = text;
    this.type = 'cut';
  }

  paste() {
    return this.text;
  }

  clear() {
    this.text = '';
    this.type = null;
  }

  hasContent() {
    return this.text.length > 0;
  }
}

module.exports = Clipboard;