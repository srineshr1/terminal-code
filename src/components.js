// src/components.js
// Individual component renderers for the terminal UI

const {
  RESET,
  fg,
  bg,
  style,
  cursorTo,
  repeat,
  pad,
  truncate,
  sanitizeTerminalText
} = require('./ansi');

/**
 * Render the header/title bar
 * @param {Object} layout - Layout object with header dimensions
 * @param {Object} options - Header options
 * @returns {string} Rendered header string
 */
function renderHeader(layout, options = {}) {
  const { width } = layout;
  const title = options.title || 'VSCode CLI';
  const leftInfo = options.leftInfo || '';
  const rightInfo = options.rightInfo || '';
  
  const titleStr = ` ${title} `;
  const availableWidth = width - leftInfo.length - rightInfo.length - titleStr.length;
  const centerPadding = Math.max(0, availableWidth);
  const center = repeat(' ', Math.floor(centerPadding / 2));
  
  const line = leftInfo + center + titleStr + center + rightInfo;
  const content = pad(line, width);
  
  const headerBg = bg(options.headerBg || 'blue');
  const headerFg = fg(options.headerFg || 'white');
  
  return `${headerBg}${headerFg}${content}${RESET}`;
}

/**
 * Render the explorer pane
 * @param {Object} layout - Layout object with explorer dimensions
 * @param {Object} options - Explorer options
 * @returns {Object} Rendered content and lines
 */
function renderExplorer(layout, options = {}) {
  const { x, y, width, height } = layout;
  const files = options.files || [];
  const selectedIndex = options.selectedIndex || 0;
  const scrollOffset = options.scrollOffset || 0;
  
  const explorerBg = bg(options.explorerBg || 'black');
  const explorerFg = fg(options.explorerFg || 'white');
  const selectedBg = bg(options.selectedBg || 'blue');
  const selectedFg = fg(options.selectedFg || 'white');
  const folderFg = fg(options.folderFg || 'cyan');
  const dimFg = fg(options.dimFg || 'brightBlack');
  
  let content = [];
  
  // Title bar
  const title = options.title || 'EXPLORER';
  content.push(`${explorerBg}${explorerFg}${pad(' ' + title, width)}${RESET}`);
  
  // Files (visible range)
  const visibleHeight = height - 1;
  const visibleFiles = files.slice(scrollOffset, scrollOffset + visibleHeight);
  
  for (let i = 0; i < visibleHeight; i++) {
    const fileIndex = scrollOffset + i;
    const file = visibleFiles[i];
    
    let lineContent;
    if (file) {
      const icon = file.type === 'directory' ? '📁' : '📄';
      const safeName = sanitizeTerminalText(file.name);
      const name = truncate(safeName, width - 4);
      const isSelected = fileIndex === selectedIndex;
      
      const fgColor = file.type === 'directory' ? folderFg : (isSelected ? selectedFg : explorerFg);
      const bgColor = isSelected ? selectedBg : explorerBg;
      
      lineContent = `${bgColor}${fgColor} ${icon} ${name}${RESET}`;
    } else {
      lineContent = `${explorerBg}${explorerFg}${repeat(' ', width)}${RESET}`;
    }
    
    content.push(pad(lineContent, width));
  }
  
  // Scroll indicator if needed
  if (files.length > visibleHeight) {
    const scrollPercent = Math.floor((scrollOffset / files.length) * (visibleHeight - 1));
    const lastLine = `${explorerBg}${dimFg}${pad(` ▼ ${scrollOffset}/${files.length} `, width, ' ', 'right')}${RESET}`;
    content[content.length - 1] = lastLine;
  }
  
  return {
    content,
    lines: content
  };
}

/**
 * Render the editor pane
 * @param {Object} layout - Layout object with editor dimensions
 * @param {Object} options - Editor options
 * @returns {Object} Rendered content and metadata
 */
function renderEditor(layout, options = {}) {
  const { x, y, width, height } = layout;
  const lines = options.lines || [''];
  const cursorRow = options.cursorRow || 0;
  const cursorCol = options.cursorCol || 0;
  const scrollOffset = options.scrollOffset || 0;
  const syntaxHighlighting = options.syntaxHighlighting || false;
  
  const editorBg = bg(options.editorBg || 'black');
  const editorFg = fg(options.editorFg || 'white');
  const lineNumberFg = fg(options.lineNumberFg || 'brightBlack');
  const lineNumberBg = bg(options.lineNumberBg || 'brightBlack');
  const cursorBg = bg(options.cursorBg || 'white');
  const cursorFg = fg(options.cursorFg || 'black');
  
  const lineNumberWidth = String(lines.length).length + 2;
  const contentWidth = width - lineNumberWidth - 1;
  
  let content = [];
  const visibleHeight = height;
  
  // Calculate visible line range
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(scrollOffset + visibleHeight, lines.length);
  
  for (let i = 0; i < visibleHeight; i++) {
    const lineIndex = visibleStart + i;
    const line = sanitizeTerminalText(lines[lineIndex] || '');
    const isCursorLine = lineIndex === cursorRow;
    
    // Line number
    let lineNumStr = lineIndex < lines.length ? String(lineIndex + 1) : '~';
    lineNumStr = pad(lineNumStr, lineNumberWidth, ' ', 'right');
    
    // Line content (truncated to fit)
    const visibleContent = line.slice(0, contentWidth);
    const paddedContent = pad(visibleContent, contentWidth);
    
    // Cursor position in this line
    let renderedLine;
    if (isCursorLine && cursorCol < contentWidth) {
      // Cursor is within this line
      const beforeCursor = paddedContent.slice(0, cursorCol);
      const cursorChar = paddedContent[cursorCol] || ' ';
      const afterCursor = paddedContent.slice(cursorCol + 1);
      renderedLine = `${editorBg}${editorFg}${beforeCursor}${cursorBg}${cursorFg}${cursorChar}${editorBg}${editorFg}${afterCursor}${RESET}`;
    } else {
      renderedLine = `${editorBg}${editorFg}${paddedContent}${RESET}`;
    }
    
    const lineNum = `${lineNumberBg}${lineNumberFg}${lineNumStr}${RESET}`;
    content.push(lineNum + renderedLine);
  }
  
  // Store cursor position for the main renderer
  const cursorScreenRow = cursorRow - scrollOffset;
  const cursorScreenCol = x + lineNumberWidth + cursorCol;
  const cursorScreenY = y + 1 + cursorScreenRow;
  
  return {
    content,
    lines: content,
    cursor: {
      x: cursorScreenCol,
      y: cursorScreenY,
      visible: cursorScreenRow >= 0 && cursorScreenRow < visibleHeight
    }
  };
}

/**
 * Render the status bar
 * @param {Object} layout - Layout object with status bar dimensions
 * @param {Object} options - Status bar options
 * @returns {string} Rendered status bar string
 */
function renderStatusBar(layout, options = {}) {
  const { width } = layout;
  const leftInfo = options.leftInfo || '';
  const rightInfo = options.rightInfo || '';
  
  const left = pad(leftInfo, Math.floor(width / 2), ' ', 'left');
  const right = pad(rightInfo, Math.ceil(width / 2), ' ', 'left');
  const content = left + right;
  
  const statusBg = bg(options.statusBg || 'magenta');
  const statusFg = fg(options.statusFg || 'white');
  
  return `${statusBg}${statusFg}${content}${RESET}`;
}

/**
 * Render a pane border
 * @param {Object} layout - Layout object
 * @param {Object} options - Border options
 * @returns {string} Rendered border
 */
function renderBorder(layout, options = {}) {
  const { x, y, width, height } = layout;
  const borderChar = options.borderChar || '│';
  const borderColor = fg(options.borderColor || 'cyan');
  const cornerColor = fg(options.cornerColor || 'brightCyan');
  
  let border = '';
  
  // Top border
  border += cursorTo(y + 1, x + 1);
  border += cornerColor + '┌' + borderColor + repeat('─', width - 2) + cornerColor + '┐' + RESET;
  
  // Side borders
  for (let i = 1; i < height - 1; i++) {
    border += cursorTo(y + 1 + i, x + 1);
    border += borderColor + borderChar + repeat(' ', width - 2) + borderColor + borderChar + RESET;
  }
  
  // Bottom border
  border += cursorTo(y + height, x + 1);
  border += cornerColor + '└' + borderColor + repeat('─', width - 2) + cornerColor + '┘' + RESET;
  
  return border;
}

module.exports = {
  renderHeader,
  renderExplorer,
  renderEditor,
  renderStatusBar,
  renderBorder
};
