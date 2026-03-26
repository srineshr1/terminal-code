# AGENTS.md - VSCode CLI Editor Project Guidelines

## Project Overview

A VSCode-style CLI text editor built with Node.js and the blessed library for terminal UI rendering. Supports tabs, file explorer, search/replace, syntax highlighting, and mouse/keyboard input.

## Build/Run Commands

```bash
npm start                    # Run the editor
node index.js <filepath>     # Run with a specific file
node index.js --help         # Show help
node index.js --version      # Show version
```

**Note**: No automated tests are currently configured.

## Project Structure

```
src/
├── app.js               # Main Application class
├── core/state.js        # State management (EventEmitter-based)
├── core/actions.js      # Action types and creators
├── editor/Buffer.js     # Text buffer model (core editing)
├── editor/Clipboard.js  # Copy/cut/paste clipboard store
├── editor/History.js    # Undo/redo (snapshot-based)
├── editor/Search.js     # Search/replace functionality
├── files/FileTree.js    # Directory tree model
├── files/fileSystem.js  # Safe file operations
├── input/keybindings.js # VSCode-style keybinding definitions
├── ui/BlessedRenderer.js# Blessed-based terminal UI
└── utils/logger.js      # Debug logging utility
```

## Code Style Guidelines

### General Rules

- **No comments** in code unless explaining complex logic
- **JSDoc comments** only for public class methods and API
- Use `'use strict';` at top of every module file
- CommonJS modules (`require`/`module.exports`) - NOT ES modules

### Imports (Order matters)

```javascript
const path = require('path');              // Node built-ins first
const fs = require('fs').promises;
const blessed = require('blessed');         // External dependencies second
const State = require('./core/state');      // Internal modules last
```

### Formatting

- 2 spaces indentation
- Single quotes for strings
- No trailing commas
- Max line length: ~100 chars
- Blank lines between logical sections

### Naming Conventions

| Type | Convention | Example |
|------|------------|----------|
| Classes | PascalCase | `Buffer`, `FileTree` |
| Functions/Methods | camelCase | `findKeybinding` |
| Private methods | _camelCase | `_handleKeypress` |
| Constants | SCREAMING_SNAKE_CASE | `LOG_LEVELS` |
| Event types | category.action | `file.save` |

### Classes

```javascript
class Buffer {
  constructor(options = {}) {
    this.lines = options.lines || [''];
    this._cursor = { line: 0, col: 0 };
  }
  
  _bindMethods() {
    this._onChange = this._onChange.bind(this);
  }
  
  /**
   * @param {string} text - Text to insert
   */
  insert(text) { /* ... */ }
}
```

### Error Handling

```javascript
// Async: try/catch
async function openFile(filePath) {
  try {
    const content = await readFile(filePath);
  } catch (err) {
    console.error('Failed to open file:', err.message);
  }
}

// Sync: validate inputs early
function setCursor(line, col) {
  this.cursor.line = Math.max(0, Math.min(line, this.lines.length - 1));
}
```

### State Management

```javascript
class State extends EventEmitter {
  get(key) { return this._data[key]; }
  set(key, value) {
    const old = this._data[key];
    this._data[key] = value;
    if (old !== value) this.emit('change', key, value, old);
  }
  subscribe(listener) {
    this.on('change', listener);
    return () => this.off('change', listener);
  }
}
```

### Module Exports

```javascript
module.exports = ClassName;                    // Single class
module.exports = { readFile, writeFile };       // Named exports
const { readFile } = require('./fileSystem');   // Destructured import
```

## Key Patterns

### Action Dispatch Pattern

Actions are strings in format `category.actionName`:

```javascript
executeAction(action) {
  const [category, name] = action.split('.');
  switch (category) {
    case 'file': this._handleFileAction(name); break;
    case 'edit': this._handleEditAction(name); break;
  }
}
```

### Buffer Model

Core editing model with cursor `{line, col}` and selection `{anchor, head}`.

## Testing

No test framework configured. Recommended: Jest

```bash
npm install --save-dev jest
npx jest path/to/test.js    # Run single test file
npx jest -t "test name"     # Run specific test
```

## Debugging

```javascript
const logger = require('./utils/logger');
logger.debug('category', 'message', { data });
```

Logs written to `./editor.log`.

## Dependencies

- **blessed** (^0.1.81): Terminal UI rendering
- Node.js built-ins: `path`, `fs`, `events`