'use strict';

function normalize(range) {
  if (!range) return null;
  const a = range.anchor;
  const h = range.head;
  if (a.line < h.line || (a.line === h.line && a.col <= h.col)) {
    return { start: { line: a.line, col: a.col }, end: { line: h.line, col: h.col } };
  }
  return { start: { line: h.line, col: h.col }, end: { line: a.line, col: a.col } };
}

function isEmpty(range) {
  if (!range) return true;
  return range.anchor.line === range.head.line && range.anchor.col === range.head.col;
}

function contains(range, line, col) {
  const n = normalize(range);
  if (!n) return false;
  if (line < n.start.line || line > n.end.line) return false;
  if (line === n.start.line && col < n.start.col) return false;
  if (line === n.end.line && col >= n.end.col) return false;
  return true;
}

function intersectionForLine(range, line) {
  const n = normalize(range);
  if (!n) return null;
  if (line < n.start.line || line > n.end.line) return null;
  const startCol = (line === n.start.line) ? n.start.col : 0;
  const endCol = (line === n.end.line) ? n.end.col : Infinity;
  return { startCol, endCol };
}

function compare(a, b) {
  if (a.line !== b.line) return a.line - b.line;
  return a.col - b.col;
}

function mergeOverlapping(ranges) {
  if (!ranges || ranges.length <= 1) return ranges || [];
  const norm = ranges.map(normalize).filter(Boolean).sort((a, b) => compare(a.start, b.start));
  const out = [norm[0]];
  for (let i = 1; i < norm.length; i++) {
    const last = out[out.length - 1];
    const cur = norm[i];
    if (compare(cur.start, last.end) <= 0) {
      if (compare(cur.end, last.end) > 0) last.end = cur.end;
    } else {
      out.push(cur);
    }
  }
  return out;
}

module.exports = { normalize, isEmpty, contains, intersectionForLine, compare, mergeOverlapping };
