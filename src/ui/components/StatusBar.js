// src/ui/components/StatusBar.js
// Status bar component - renders bottom info bar

const { pad, RESET } = require('../../utils/ansi');

function render(screen, layout, leftInfo, rightInfo, theme) {
  const { x, y, width, height } = layout;
  const sb = theme?.statusBar || {};
  const leftBg = `\x1b[${sb.leftBg || '45'}m`;
  const rightBg = `\x1b[${sb.rightBg || '43'}m`;
  const fg = `\x1b[${sb.fg || '37'}m`;
  const sep = `\x1b[${sb.separator || '90'}m`;
  
  const midX = x + Math.floor(width / 2);
  const leftText = leftInfo || '';
  const rightText = rightInfo || '';
  
  screen.fillStyled(x, y, width, height, ' ', leftBg);
  
  screen.write(x + 1, y + 1, fg + leftText + RESET);
  
  const rightStart = width - rightText.length;
  if (rightStart > midX) {
    screen.fillStyled(midX, y, rightStart - midX, height, ' ', rightBg);
    screen.write(rightStart, y + 1, fg + rightText + RESET);
  }
  
  return {};
}

module.exports = { render };