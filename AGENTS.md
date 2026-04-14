# AGENTS.md - VSCode CLI Editor

## Project Overview
VSCode-style CLI text editor built with Node.js and blessed for terminal UI. Supports tabs, file explorer, search/replace, syntax highlighting, and mouse/keyboard input.

## Build/Run/Test Commands

```bash
# Run
npm start                           # Empty editor buffer
node index.js <filepath>            # Open specific file
npm run start:file                  # Open package.json

# Test (no framework configured yet)
npm test                            # Placeholder only
# To add tests: npm install --save-dev jest
# npx jest path/to/test.js          # Run single test file
# npx jest -t "test name"            # Run specific test by name

# Debug
node --inspect index.js <filepath>  # Node debugger

Logger (src/utils/logger.js):
- Default: DEBUG level, file enabled, console disabled
- Logs to ./editor.log
- Set LOG_LEVELS in code or use logger.setLevel('INFO')
```

## Architecture

```
src/
├── app.js                   # Main Application class (1161 lines)
├── core/                    # State management
│   ├── state.js             # EventEmitter-based key-value store
│   └── actions.js           # Action types and creators
├── editor/                  # Text editing core
│   ├── Buffer.js            # Text buffer (lines, cursor, selection)
│   ├── History.js           # Undo/redo (snapshot-based)
│   ├── Clipboard.js         # Copy/cut/paste store
│   ├── Search.js            # Search/replace
│   └── Syntax.js            # Syntax highlighting
├── files/                   # File system operations
│   ├── FileTree.js          # Directory tree model
│   ├── fileSystem.js        # Safe file read/write
│   └── fileOps.js           # Create/rename/delete
├── input/                   # Input handling
│   ├── keybindings.js       # VSCode-style key mappings
│   ├── keyboard.js          # Keyboard events
│   ├── mouse.js             # Mouse events
│   └── inputHandler.js      # Unified input dispatcher
└── ui/                      # Terminal UI (blessed)
    ├── BlessedRenderer.js   # Terminal rendering
    ├── components/          # UI widgets
    └── themes/default.js    # Color schemes
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

### Class Structure & Error Handling
```javascript
class Buffer {
  constructor(content = '') {
    this.lines = content ? content.split('\n') : [''];
    this.cursor = { line: 0, col: 0 };
  }
  
  /** @param {string} text - Text to insert */
  insert(text) { /* ... */ }
}

// Async: try/catch | Sync: validate inputs early
async function openFile(filePath) {
  try {
    const content = await readFile(filePath);
  } catch (err) {
    console.error('Failed to open file:', err.message);
  }
}
```

### Module Exports & State
```javascript
module.exports = ClassName;
module.exports = { readFile, writeFile };

// State: EventEmitter-based key-value store
state.set(key, value);  // Auto-emits 'change' event
state.get(key);
state.subscribe(listener); // Returns unsubscribe function
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
const logger = require('./src/utils/logger');
logger.debug('category', 'message', { data });
```
Logger (src/utils/logger.js):
- Default: DEBUG level, file enabled, console disabled
- Logs to ./editor.log
- Use logger.setLevel('INFO') to reduce verbosity

## Entry Point

index.js handles terminal init/exit escape sequences - don't remove these:
- `'\x1b[?1049h'` - alternate screen buffer
- `'\x1b[?25l'` - hide cursor
- Cleanup on exit: `'\x1b[?1049l'\x1b[?25h'`

## Dependencies
- **blessed** (^0.1.81): Terminal UI rendering
- **node-pty** (^1.1.0): Pseudo-terminal functionality
- Node.js built-ins: `path`, `fs`, `events`

