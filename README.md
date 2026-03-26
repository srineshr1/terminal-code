# VSCode CLI Editor

A basic VSCode-style text editor for the terminal, built with Node.js and ANSI rendering.

## Run

```bash
npm .
```

Open a specific file:

```bash
node index.js path/to/file.txt
```

## Controls

- `Arrow keys`: Move cursor / navigate explorer
- `Tab`: Toggle focus between editor and explorer
- `Enter`: New line in editor, open selected file in explorer
- `Backspace`: Delete previous character
- `Delete`: Delete character at cursor (if your terminal sends `\x1b[3~`)
- `Ctrl+S`: Save current file
- `Ctrl+O`: Open selected file from explorer
- `Ctrl+N`: New empty buffer
- `Ctrl+R`: Refresh explorer file list
- `Ctrl+Q`: Quit

## Notes

- New unsaved buffers are saved as `untitled.txt` when pressing `Ctrl+S`.
- For now, explorer navigation is single-level (workspace root listing).
# terminal-code
