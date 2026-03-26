/**
 * Simple logger for debugging
 */

'use strict';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const config = {
  level: LOG_LEVELS.DEBUG,
  enableConsole: true,
  enableFile: true,
  filePath: './editor.log',
};

const logs = [];
let fs = null;

function getFs() {
  if (!fs) {
    try {
      fs = require('fs');
    } catch (e) {
      // fs not available
    }
  }
  return fs;
}

function setLevel(level) {
  if (typeof level === 'string') {
    config.level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  } else {
    config.level = level;
  }
}

function log(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, category, message, data };
  
  logs.push(entry);
  
  // Keep last 1000 entries
  if (logs.length > 1000) {
    logs.shift();
  }
  
  if (config.enableConsole) {
    const levelName = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'DEBUG';
    const prefix = `[${timestamp}] [${levelName}] [${category}]`;
    
    if (level >= config.level) {
      if (data !== null) {
        console.error(prefix, message, JSON.stringify(data));
      } else {
        console.error(prefix, message);
      }
    }
  }
  
  // Write to file
  if (config.enableFile) {
    const fileSystem = getFs();
    if (fileSystem) {
      const levelName = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'DEBUG';
      const line = `[${timestamp}] [${levelName}] [${category}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
      fileSystem.appendFile(config.filePath, line, (err) => {
        if (err) console.error('Log write error:', err);
      });
    }
  }
  
  return entry;
}

function debug(category, message, data) {
  return log(LOG_LEVELS.DEBUG, category, message, data);
}

function info(category, message, data) {
  return log(LOG_LEVELS.INFO, category, message, data);
}

function warn(category, message, data) {
  return log(LOG_LEVELS.WARN, category, message, data);
}

function error(category, message, data) {
  return log(LOG_LEVELS.ERROR, category, message, data);
}

function getLogs() {
  return [...logs];
}

function clearLogs() {
  logs.length = 0;
}

module.exports = {
  LOG_LEVELS,
  setLevel,
  debug,
  info,
  warn,
  error,
  getLogs,
  clearLogs,
};
