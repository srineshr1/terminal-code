'use strict';

let clipboardy = null;
try {
  clipboardy = require('clipboardy');
} catch (e) {
  clipboardy = null;
}

class Clipboard {
  constructor() {
    this.text = '';
    this.type = null;
  }

  copy(text) {
    this.text = text;
    this.type = 'copy';
    if (clipboardy && typeof clipboardy.writeSync === 'function') {
      try { clipboardy.writeSync(text); } catch (e) {}
    }
  }

  cut(text) {
    this.copy(text);
    this.type = 'cut';
  }

  paste() {
    if (clipboardy && typeof clipboardy.readSync === 'function') {
      try {
        const sys = clipboardy.readSync();
        if (typeof sys === 'string' && sys.length > 0) {
          this.text = sys;
          return sys;
        }
      } catch (e) {}
    }
    return this.text;
  }

  clear() {
    this.text = '';
    this.type = null;
  }

  hasContent() {
    return (this.text && this.text.length > 0);
  }
}

module.exports = Clipboard;
