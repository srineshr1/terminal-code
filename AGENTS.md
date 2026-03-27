# AGENTS.md - VSCode CLI Editor

## Project Overview

VSCode-style CLI text editor built with Node.js and blessed for terminal UI. Supports tabs, file explorer, search/replace, syntax highlighting, and mouse/keyboard input.

## Build/Run Commands

```bash
npm start                    # Run the editor
node index.js <filepath>     # Run with a specific file
node index.js --help         # Show help
node index.js --version      # Show version
```

## Project Structure

```
src/
├── app.js               # Main Application class
├── core/
│   ├── state.js         # State management (EventEmitter-based)
│   └── actions.js       # Action types and creators
├── editor/
│   ├── Buffer.js        # Text buffer model (cursor, selection, editing)
│   ├── Clipboard.js     # Copy/cut/paste clipboard store
│   ├── History.js       # Undo/redo (snapshot-based)
│   ├── Search.js        # Search/replace functionality
│   └── Syntax.js        # Syntax highlighting
├── files/
│   ├── FileTree.js      # Directory tree model
│   ├── fileSystem.js    # Safe file read/write
│   └── fileOps.js       # File operations (mkdir, rename, delete)
├── input/
│   ├── keybindings.js   # VSCode-style keybinding definitions
│   ├── keyboard.js      # Keyboard event handling
│   ├── mouse.js         # Mouse event handling
│   └── inputHandler.js  # Unified input handling
├── ui/
│   ├── BlessedRenderer.js # Blessed-based terminal UI
│   ├── Renderer.js      # Renderer abstraction layer
│   ├── Screen.js        # Screen management
│   ├── themes/default.js # Theme definitions
│   └── components/      # UI components (Editor, Explorer, TabBar, StatusBar, SearchOverlay)
├── utils/
│   ├── logger.js        # Debug logging (writes to ./editor.log)
│   └── layout.js        # Layout utilities
├── editor.js, files.js, components.js, ui.js, layout.js, ansi.js, index.js
```

## Code Style

### General Rules
- No comments unless explaining complex logic
- JSDoc for public class methods and API only
- `'use strict';` at top of every module
- CommonJS modules (`require`/`module.exports`) - NOT ES modules

### Imports (Order: built-ins → external → internal)
```javascript
const path = require('path');
const fs = require('fs').promises;
const blessed = require('blessed');
const State = require('./core/state');
```

### Formatting
- 2 spaces indentation
- Single quotes for strings
- No trailing commas
- ~100 char line length
- Blank lines between logical sections

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `Buffer`, `FileTree` |
| Functions/Methods | camelCase | `findKeybinding` |
| Private methods | _camelCase | `_handleKeypress` |
| Constants | SCREAMING_SNAKE_CASE | `LOG_LEVELS` |
| Event types | category.action | `file.save` |

### Class Structure
```javascript
class Buffer {
  constructor(content = '') {
    this.lines = content ? content.split('\n') : [''];
    this.cursor = { line: 0, col: 0 };
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
    const oldValue = this._data[key];
    this._data[key] = value;
    if (oldValue !== value) this.emit('change', key, value, oldValue);
  }
  subscribe(listener) {
    this.on('change', listener);
    return () => this.off('change', listener);
  }
}
```

### Module Exports
```javascript
module.exports = ClassName;
module.exports = { readFile, writeFile };
```

## Key Patterns

### Action Dispatch
Actions are strings: `category.actionName`
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

No test framework configured. To add tests:
```bash
npm install --save-dev jest
npx jest path/to/test.js    # Run single test file
npx jest -t "test name"      # Run specific test by name
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
