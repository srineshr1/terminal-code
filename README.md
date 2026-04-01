# terminal-code

VSCode-style terminal text editor built with Node.js and blessed.

## Install

```bash
npm install -g @ricky/terminal-code
```

## Usage

Start editor in current directory:

```bash
terminal-code
```

Open a file directly:

```bash
terminal-code path/to/file.txt
```

## Core Shortcuts

- `Ctrl+N`: New file (prompts full path)
- `Ctrl+S`: Save
- `Ctrl+Shift+S`: Save As (full path prompt)
- `Ctrl+Shift+R`: Rename active tab file
- `Ctrl+Shift+D`: Delete active tab file (with confirmation)
- `Ctrl+O`: Focus explorer
- `Ctrl+Q`: Quit

Explorer shortcuts (when explorer is focused):

- `Ctrl+Shift+N`: New file
- `Ctrl+Alt+N`: New folder
- `F2`: Rename selected item
- `Delete`: Delete selected item
- `Enter`: Open file / toggle folder

## Publish

```bash
npm login
npm publish --access public
```

After publishing, users can install globally with `npm install -g @ricky/terminal-code`.
