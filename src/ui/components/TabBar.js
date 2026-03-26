// src/ui/components/TabBar.js
// Tab bar component - renders open tabs with active highlight

const { pad, truncate, RESET } = require('../../utils/ansi');

function render(screen, layout, tabs, activeIndex, theme) {
  const hitMap = [];
  const { x, y, width, height } = layout;
  const tabBar = theme?.tabBar || {};
  const activeBg = `\x1b[${tabBar.activeBg || '104'}m`;
  const activeFg = `\x1b[${tabBar.activeFg || '37'}m`;
  const inactiveBg = `\x1b[${tabBar.bg || '44'}m`;
  const inactiveFg = `\x1b[${tabBar.inactiveFg || '90'}m`;
  const sep = `\x1b[${tabBar.separator || '90'}m`;
  const closeIcon = '\u2715';
  
  const tabsAreaWidth = width - 2;
  const maxTabWidth = Math.max(15, Math.floor(tabsAreaWidth / Math.max(tabs.length, 1)) - 2);
  
  let currentX = x + 1;
  
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isActive = i === activeIndex;
    const fileName = tab.title || truncate(tab.filePath?.split(/[/\\]/).pop() || 'Untitled', maxTabWidth - 5);
    const modified = tab.modified ? '*' : '';
    const displayText = fileName + modified;
    
    const tabWidth = Math.min(maxTabWidth, displayText.length + 2);
    const displayTextTrunc = truncate(displayText, tabWidth - 2);
    
    hitMap.push({ x: currentX, y: y, width: tabWidth, height: height, index: i, tab });
    
    if (isActive) {
      screen.fillStyled(currentX, y, tabWidth, height, ' ', activeBg);
      screen.write(currentX + 1, y + 1, activeFg + displayTextTrunc + RESET);
    } else {
      screen.fillStyled(currentX, y, tabWidth, height, ' ', inactiveBg);
      screen.write(currentX + 1, y + 1, inactiveFg + displayTextTrunc + RESET);
    }
    
    currentX += tabWidth;
    
    if (i < tabs.length - 1 && currentX < x + width - 1) {
      screen.write(currentX, y + 1, sep + '|' + RESET);
      currentX++;
    }
  }
  
  const remainingWidth = (x + width - 1) - currentX;
  if (remainingWidth > 0) {
    screen.fillStyled(currentX, y, remainingWidth, height, ' ', inactiveBg);
  }
  
  return { hitMap };
}

module.exports = { render };