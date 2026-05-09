/**
 * Search - Find/Replace functionality
 */

'use strict';

class Search {
  constructor() {
    this.query = '';
    this.results = []; // Array of { line, col, length }
    this.currentIndex = 0;
  }
  
  /**
   * Perform a search on the given lines
   * @param {string[]} lines - Array of lines to search
   * @param {string} query - Search query
   */
  search(lines, query) {
    this.query = query;
    this.results = [];
    this.currentIndex = 0;
    
    if (!query || query.length === 0) {
      return;
    }
    
    // Case-insensitive search
    const lowerQuery = query.toLowerCase();
    
    for (let line = 0; line < lines.length; line++) {
      const lineText = lines[line];
      const lowerLine = lineText.toLowerCase();
      let col = 0;
      
      while (col <= lineText.length - query.length) {
        const index = lowerLine.indexOf(lowerQuery, col);
        if (index === -1) break;
        
        this.results.push({
          line,
          col: index,
          length: query.length,
        });
        
        col = index + 1;
      }
    }
  }
  
  /**
   * Get the next search result
   * @returns {Object|null} - Match object or null
   */
  next() {
    if (this.results.length === 0) return null;
    
    this.currentIndex = (this.currentIndex + 1) % this.results.length;
    return this.results[this.currentIndex];
  }
  
  /**
   * Get the previous search result
   * @returns {Object|null} - Match object or null
   */
  prev() {
    if (this.results.length === 0) return null;
    
    this.currentIndex = (this.currentIndex - 1 + this.results.length) % this.results.length;
    return this.results[this.currentIndex];
  }
  
  /**
   * Get current match
   * @returns {Object|null} - Match object or null
   */
  current() {
    if (this.results.length === 0 || this.currentIndex < 0) return null;
    return this.results[this.currentIndex];
  }
  
  /**
   * Clear search results
   */
  clear() {
    this.query = '';
    this.results = [];
    this.currentIndex = 0;
  }
  
  /**
   * Get match count
   */
  get count() {
    return this.results.length;
  }

  /**
   * Run a search on lines and return matches in renderer format.
   * Returns array of { line, startCol, endCol }.
   */
  findAll(lines, query, opts = {}) {
    if (!query) { this.clear(); return []; }
    const caseSensitive = !!opts.caseSensitive;
    const out = [];
    const needle = caseSensitive ? query : query.toLowerCase();
    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li] || '';
      const hay = caseSensitive ? raw : raw.toLowerCase();
      let from = 0;
      while (from <= hay.length - needle.length) {
        const idx = hay.indexOf(needle, from);
        if (idx === -1) break;
        out.push({ line: li, startCol: idx, endCol: idx + query.length });
        from = idx + Math.max(1, query.length);
      }
    }
    this.query = query;
    this.results = out.map(m => ({ line: m.line, col: m.startCol, length: m.endCol - m.startCol }));
    this.currentIndex = out.length ? 0 : -1;
    return out;
  }

  /**
   * Replace all occurrences in buffer.
   * Returns number replaced.
   */
  replaceAll(buffer, query, replacement, opts = {}) {
    if (!query) return 0;
    const caseSensitive = !!opts.caseSensitive;
    let total = 0;
    for (let li = 0; li < buffer.lines.length; li++) {
      const orig = buffer.lines[li];
      let result = '';
      let i = 0;
      const needle = caseSensitive ? query : query.toLowerCase();
      const hay = caseSensitive ? orig : orig.toLowerCase();
      while (i < orig.length) {
        const idx = hay.indexOf(needle, i);
        if (idx === -1) { result += orig.slice(i); break; }
        result += orig.slice(i, idx) + replacement;
        i = idx + query.length;
        total++;
      }
      buffer.lines[li] = result;
    }
    return total;
  }
}

module.exports = Search;
