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
}

module.exports = Search;
