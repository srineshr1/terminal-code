// src/ui/components/Explorer.js
// Explorer component - renders file tree with selection

const { pad, truncate, RESET } = require('../../utils/ansi');

function render(screen, layout, explorer, theme) {
  const hitMap = [];
  const { x, y, width, height } = layout;
  const exp = theme?.explorer || {};
  const bg = `\x1b[${exp.bg || '40'}m`;
  const fg = `\x1b[${exp.fg || '37'}m`;
  const selectedBg = `\x1b[${exp.selectedBg || '42'}m`;
  const selectedFg = `\x1b[${exp.selectedFg || '30'}m`;
  const folderFg = `\x1b[${exp.folderFg || '93'}m`;
  const headerBg = `\x1b[${exp.headerBg || '44'}m`;
  const headerFg = `\x1b[${exp.headerFg || '37'}m`;
  
  // Draw header
  const headerText = 'EXPLORER';
  screen.fillStyled(x, y, width, 1, ' ', headerBg);
  screen.write(x + 1, y + 1, headerFg + headerText + RESET);
  
  const fileListY = y + 1;
  const visibleHeight = height - 1;
  const files = explorer.files || [];
  const startIdx = explorer.scrollOffset || 0;
  
  // Draw file list
  for (let i = 0; i < visibleHeight; i++) {
    const fileIdx = startIdx + i;
    if (fileIdx >= files.length) {
      screen.fillStyled(x, fileListY + i, width, 1, ' ', bg);
      continue;
    }
    
    const file = files[fileIdx];
    const isSelected = fileIdx === explorer.selectedIndex;
    const isDir = file.isDirectory || file.type === 'directory';
    
    const icon = isDir ? '\u{1F4C1}' : '\u{1F4C4}';
    const name = truncate(file.name, width - 4);
    const displayText = icon + ' ' + name;
    
    hitMap.push({ x, y: fileListY + i, width, height: 1, index: fileIdx, item: file });
    
    if (isSelected) {
      screen.fillStyled(x, fileListY + i, width, 1, ' ', selectedBg);
      screen.write(x + 1, fileListY + i + 1, selectedFg + displayText + RESET);
    } else {
      screen.fillStyled(x, fileListY + i, width, 1, ' ', bg);
      const color = isDir ? folderFg : fg;
      screen.write(x + 1, fileListY + i + 1, color + displayText + RESET);
    }
  }
  
  return { hitMap };
}

module.exports = { render };