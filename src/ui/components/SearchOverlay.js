// src/ui/components/SearchOverlay.js
// Search overlay component - renders search input and results

const { pad, truncate, RESET } = require('../../utils/ansi');

function render(screen, layout, search, theme) {
  const { x, y, width, height } = layout;
  const so = theme?.searchOverlay || {};
  const bg = `\x1b[${so.bg || '100'}m`;
  const fg = `\x1b[${so.fg || '97'}m`;
  const inputBg = `\x1b[${so.inputBg || '40'}m`;
  const matchBg = `\x1b[${so.matchBg || '43'}m`;
  const matchFg = `\x1b[${so.matchFg || '30'}m`;
  
  // Draw border box
  screen.fillStyled(x, y, width, 1, '\u2500', fg + bg);
  screen.fillStyled(x, y + height - 1, width, 1, '\u2500', fg + bg);
  screen.fillStyled(x, y, 1, height, '\u2502', fg + bg);
  screen.fillStyled(x + width - 1, y, 1, height, '\u2502', fg + bg);
  
  // Draw corners
  screen.write(x, y, fg + '\u250C' + RESET);
  screen.write(x, y + height - 1, fg + '\u2514' + RESET);
  screen.write(x + width - 1, y, fg + '\u2510' + RESET);
  screen.write(x + width - 1, y + height - 1, fg + '\u2518' + RESET);
  
  // Draw content area background
  screen.fillStyled(x + 1, y + 1, width - 2, height - 2, ' ', bg);
  
  // Draw search icon and query
  const searchIcon = '\u{1F50D}';
  const query = search.query || '';
  const resultCount = search.results?.length || 0;
  const currentResult = search.currentResult || 0;
  
  const inputLine = searchIcon + ' ' + query + '_';
  const infoLine = `${currentResult + 1}/${resultCount} results`;
  
  // Input line
  screen.fillStyled(x + 2, y + 1, width - 4, 1, ' ', inputBg);
  screen.write(x + 2, y + 1 + 1, fg + inputLine + RESET);
  
  // Info line
  const infoX = x + width - infoLine.length - 2;
  if (infoX > 2) {
    screen.write(Math.max(2, infoX), y + 1 + 1, fg + infoLine + RESET);
  }
  
  // Draw first result preview if available
  if (search.results && search.results.length > 0) {
    const result = search.results[Math.min(currentResult, search.results.length - 1)];
    const preview = truncate(result.preview || result.line || '', width - 4);
    const resultY = y + height - 2;
    screen.write(x + 2, resultY, fg + preview + RESET);
  }
  
  return {};
}

module.exports = { render };