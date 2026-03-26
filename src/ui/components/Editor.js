// src/ui/components/Editor.js
// Editor component - renders code with line numbers, selection, cursor

const { pad, truncate, RESET } = require('../../utils/ansi');

function render(screen, layout, editor, theme, showLineNumbers = true, lineNumberWidth = 0) {
  const hitMap = [];
  const { x, y, width, height } = layout;
  const ed = theme?.editor || {};
  const bg = `\x1b[${ed.bg || '40'}m`;
  const fg = `\x1b[${ed.fg || '37'}m`;
  const lineNumFg = `\x1b[${ed.lineNumberFg || '90'}m`;
  const selectionBg = `\x1b[${ed.selectionBg || '42'}m`;
  const selectionFg = `\x1b[${ed.selectionFg || '30'}m`;
  const gutterBg = `\x1b[${ed.gutterBg || '40'}m`;
  const gutterFg = `\x1b[${ed.gutterFg || '90'}m`;
  
  const lines = editor.lines || [''];
  const scrollOffset = editor.scrollOffset || 0;
  const cursorRow = editor.cursorRow || 0;
  const cursorCol = editor.cursorCol || 0;
  const selection = editor.selection || null;
  
  const gutterWidth = showLineNumbers ? lineNumberWidth : 0;
  const contentWidth = width - gutterWidth;
  
  // Draw gutter/line numbers
  if (showLineNumbers) {
    const visibleLines = Math.min(height, lines.length - scrollOffset);
    for (let i = 0; i < visibleLines; i++) {
      const lineNum = scrollOffset + i + 1;
      const lineStr = String(lineNum).padStart(lineNumberWidth - 1);
      screen.write(x + 1, y + 1 + i, lineNumFg + lineStr + RESET);
    }
    screen.fillStyled(x + gutterWidth, y, 1, height, '|', gutterFg + bg);
  }
  
  // Draw content
  const visibleEnd = Math.min(scrollOffset + height, lines.length);
  
  for (let i = scrollOffset; i < visibleEnd; i++) {
    const screenY = y + 1 + (i - scrollOffset);
    const line = lines[i] || '';
    const lineContent = truncate(line, contentWidth);
    
    // Check if this line has selection
    let hasSelection = false;
    let selStartCol = 0, selEndCol = 0;
    if (selection) {
      if (i >= selection.startRow && i <= selection.endRow) {
        hasSelection = true;
        if (selection.startRow === selection.endRow) {
          selStartCol = selection.startCol;
          selEndCol = selection.endCol;
        } else if (i === selection.startRow) {
          selStartCol = selection.startCol;
          selEndCol = line.length;
        } else if (i === selection.endRow) {
          selStartCol = 0;
          selEndCol = selection.endCol;
        } else {
          selStartCol = 0;
          selEndCol = line.length;
        }
      }
    }
    
    hitMap.push({ x: x + gutterWidth, y: screenY, width: contentWidth, height: 1, line: i, col: 0 });
    
    if (hasSelection) {
      const beforeSel = lineContent.slice(0, Math.max(0, selStartCol));
      const sel = lineContent.slice(selStartCol, selEndCol);
      const afterSel = lineContent.slice(selEndCol);
      
      screen.write(x + gutterWidth + 1, screenY, fg + beforeSel + RESET);
      if (sel) {
        screen.write(x + gutterWidth + 1 + beforeSel.length, screenY, selectionFg + selectionBg + sel + RESET);
      }
      screen.write(x + gutterWidth + 1 + beforeSel.length + sel.length, screenY, fg + afterSel + RESET);
    } else {
      screen.write(x + gutterWidth + 1, screenY, fg + lineContent + RESET);
    }
  }
  
  // Fill remaining rows
  const remainingRows = height - (visibleEnd - scrollOffset);
  for (let i = 0; i < remainingRows; i++) {
    screen.fillStyled(x + gutterWidth + 1, y + visibleEnd - scrollOffset + i, contentWidth, 1, ' ', bg);
  }
  
  // Cursor is handled by Screen.setCursor in Renderer
  return { hitMap };
}

module.exports = { render };