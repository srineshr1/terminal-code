#!/usr/bin/env node

/**
 * VSCode-style CLI Editor
 * Entry point
 */

'use strict';

const App = require('./src/app');

let terminalInitialized = false;

function restoreTerminal() {
  if (!terminalInitialized) return;
  process.stdout.write('\x1b[?1006l\x1b[?1003l\x1b[?1002l\x1b[?1000l');
  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[?1049l');
  terminalInitialized = false;
}

function initializeTerminal() {
  process.stdout.write('\x1b[?1049h');
  process.stdout.write('\x1b[?25l');
  terminalInitialized = true;
}

process.on('uncaughtException', (err) => {
  restoreTerminal();
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  console.error('\nFatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});

process.on('exit', () => {
  restoreTerminal();
});

// Get initial file path from command line
const args = process.argv.slice(2);
const initialPath = args[0] || null;

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
VSCode-style CLI Editor

Usage: node index.js [file]

Keyboard Shortcuts:
  File Operations:
    Ctrl+N          New file
    Ctrl+O          Open file (focus explorer)
    Ctrl+S          Save
    Ctrl+Shift+S    Save as
    Ctrl+W          Close tab
    Ctrl+Q          Quit

  Tab Navigation:
    Ctrl+Tab        Next tab
    Ctrl+Shift+Tab  Previous tab
    Ctrl+1-9        Go to tab 1-9

  Editing:
    Ctrl+C          Copy
    Ctrl+X          Cut
    Ctrl+V          Paste
    Ctrl+Z          Undo
    Ctrl+Y          Redo
    Ctrl+D          Duplicate line
    Ctrl+Shift+K    Delete line
    Alt+Up/Down     Move line up/down

  Selection:
    Shift+Arrows    Extend selection
    Ctrl+A          Select all
    Ctrl+L          Select line
    Ctrl+Shift+Arrows  Select word

  Navigation:
    Ctrl+Home       Go to document start
    Ctrl+End        Go to document end
    Ctrl+G          Go to line
    Ctrl+Left/Right Move by word
    PageUp/Down     Page navigation

  Search:
    Ctrl+F          Find
    Ctrl+H          Find and Replace
    F3              Find next
    Shift+F3        Find previous
    Escape          Close search

  View:
    Ctrl+B          Toggle sidebar
    Tab             Cycle focus (editor/explorer)

Mouse Support:
  - Click to position cursor
  - Drag to select text
  - Click tabs to switch
  - Click explorer to navigate
  - Scroll wheel to scroll
  - Shift+click to extend selection
`);
  process.exit(0);
}

// Check for version flag
if (args.includes('--version') || args.includes('-v')) {
  const pkg = require('./package.json');
  console.log(`vscode-multiplayer v${pkg.version || '1.0.0'}`);
  process.exit(0);
}

initializeTerminal();

const app = new App();
app.start(initialPath).catch(err => {
  restoreTerminal();
  console.error('Failed to start editor:', err.message);
  process.exit(1);
});
