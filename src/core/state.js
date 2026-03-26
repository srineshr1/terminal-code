/**
 * State - Central state store with EventEmitter
 * Provides get/set methods for key-value state management
 */

'use strict';

const { EventEmitter } = require('events');

class State extends EventEmitter {
  constructor() {
    super();
    this._data = {};
  }
  
  /**
   * Get a value from state
   * @param {string} key - The key to get
   * @returns {*} The value or undefined
   */
  get(key) {
    return this._data[key];
  }
  
  /**
   * Set a value in state
   * @param {string} key - The key to set
   * @param {*} value - The value to set
   */
  set(key, value) {
    const oldValue = this._data[key];
    this._data[key] = value;
    
    if (oldValue !== value) {
      this.emit('change', key, value, oldValue);
    }
  }
  
  /**
   * Check if a key exists
   * @param {string} key - The key to check
   * @returns {boolean}
   */
  has(key) {
    return key in this._data;
  }
  
  /**
   * Get all state as an object
   * @returns {Object}
   */
  getAll() {
    return { ...this._data };
  }
  
  /**
   * Set multiple values at once
   * @param {Object} values - Key-value pairs to set
   */
  setAll(values) {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }
  
  /**
   * Subscribe to state changes
   * @param {Function} listener - Called with (key, value, oldValue)
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.on('change', listener);
    return () => this.off('change', listener);
  }
}

module.exports = State;