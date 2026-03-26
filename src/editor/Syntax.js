/**
 * Syntax highlighting tokenizer
 * Provides basic syntax highlighting for common languages
 */

'use strict';

/**
 * Token types
 */
const TokenType = {
  KEYWORD: 'keyword',
  STRING: 'string',
  NUMBER: 'number',
  COMMENT: 'comment',
  FUNCTION: 'function',
  VARIABLE: 'variable',
  OPERATOR: 'operator',
  PUNCTUATION: 'punctuation',
  TYPE: 'type',
  CONSTANT: 'constant',
  TAG: 'tag',
  ATTRIBUTE: 'attribute',
  PROPERTY: 'property',
  TEXT: 'text',
};

/**
 * Language definitions with keywords and patterns
 */
const languages = {
  javascript: {
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of',
      'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
      'var', 'void', 'while', 'with', 'yield', 'from', 'as',
    ],
    constants: ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
    types: ['Array', 'Object', 'String', 'Number', 'Boolean', 'Function', 'Symbol', 'BigInt', 'Map', 'Set', 'Promise', 'Date', 'RegExp', 'Error'],
    lineComment: '//',
    blockComment: ['/*', '*/'],
    strings: ['"', "'", '`'],
  },
  typescript: {
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of',
      'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
      'var', 'void', 'while', 'with', 'yield', 'from', 'as',
      'interface', 'type', 'enum', 'implements', 'namespace', 'module', 'declare',
      'abstract', 'private', 'protected', 'public', 'readonly', 'keyof', 'infer',
    ],
    constants: ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
    types: ['Array', 'Object', 'String', 'Number', 'Boolean', 'Function', 'Symbol', 'BigInt', 'Map', 'Set', 'Promise', 'Date', 'RegExp', 'Error', 'any', 'unknown', 'never', 'void', 'string', 'number', 'boolean', 'object'],
    lineComment: '//',
    blockComment: ['/*', '*/'],
    strings: ['"', "'", '`'],
  },
  python: {
    keywords: [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
      'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
      'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
      'raise', 'return', 'try', 'while', 'with', 'yield',
    ],
    constants: ['True', 'False', 'None'],
    types: ['int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'bytes', 'type', 'object'],
    lineComment: '#',
    blockComment: ['"""', '"""'],
    strings: ['"', "'", '"""', "'''"],
  },
  json: {
    keywords: [],
    constants: ['true', 'false', 'null'],
    types: [],
    lineComment: null,
    blockComment: null,
    strings: ['"'],
  },
  html: {
    keywords: [],
    constants: [],
    types: [],
    lineComment: null,
    blockComment: ['<!--', '-->'],
    strings: ['"', "'"],
    tags: true,
  },
  css: {
    keywords: [
      'important', 'inherit', 'initial', 'unset', 'none', 'auto',
    ],
    constants: [],
    types: [],
    lineComment: null,
    blockComment: ['/*', '*/'],
    strings: ['"', "'"],
    properties: true,
  },
  markdown: {
    keywords: [],
    constants: [],
    types: [],
    lineComment: null,
    blockComment: null,
    strings: [],
    markdown: true,
  },
};

// File extension to language mapping
const extensionMap = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.pyw': 'python',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'html',
  '.svg': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.less': 'css',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

/**
 * Get language for a file path
 * @param {string} filePath - File path
 * @returns {string|null} - Language identifier or null
 */
function getLanguage(filePath) {
  if (!filePath) return null;
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return extensionMap[ext] || null;
}

/**
 * Tokenize a line of code
 * @param {string} line - Line of code
 * @param {string} language - Language identifier
 * @param {Object} state - Parser state from previous line
 * @returns {Object} - { tokens: Array, state: Object }
 */
function tokenizeLine(line, language, state = {}) {
  const lang = languages[language];
  if (!lang) {
    // Unknown language - return as plain text
    return {
      tokens: [{ type: TokenType.TEXT, text: line }],
      state: {},
    };
  }
  
  const tokens = [];
  let i = 0;
  let inBlockComment = state.inBlockComment || false;
  let inString = state.inString || null;
  let stringChar = state.stringChar || null;
  
  while (i < line.length) {
    // Handle continuing block comment
    if (inBlockComment && lang.blockComment) {
      const endIdx = line.indexOf(lang.blockComment[1], i);
      if (endIdx !== -1) {
        tokens.push({
          type: TokenType.COMMENT,
          text: line.slice(i, endIdx + lang.blockComment[1].length),
        });
        i = endIdx + lang.blockComment[1].length;
        inBlockComment = false;
        continue;
      } else {
        tokens.push({ type: TokenType.COMMENT, text: line.slice(i) });
        break;
      }
    }
    
    // Handle continuing string
    if (inString) {
      const result = parseStringContinuation(line, i, stringChar);
      tokens.push({ type: TokenType.STRING, text: result.text });
      i = result.end;
      if (result.closed) {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    
    // Skip whitespace
    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ type: TokenType.TEXT, text: line.slice(i, j) });
      i = j;
      continue;
    }
    
    // Check for line comment
    if (lang.lineComment && line.slice(i, i + lang.lineComment.length) === lang.lineComment) {
      tokens.push({ type: TokenType.COMMENT, text: line.slice(i) });
      break;
    }
    
    // Check for block comment start
    if (lang.blockComment && line.slice(i, i + lang.blockComment[0].length) === lang.blockComment[0]) {
      const endIdx = line.indexOf(lang.blockComment[1], i + lang.blockComment[0].length);
      if (endIdx !== -1) {
        tokens.push({
          type: TokenType.COMMENT,
          text: line.slice(i, endIdx + lang.blockComment[1].length),
        });
        i = endIdx + lang.blockComment[1].length;
      } else {
        tokens.push({ type: TokenType.COMMENT, text: line.slice(i) });
        inBlockComment = true;
        break;
      }
      continue;
    }
    
    // Check for strings
    let foundString = false;
    for (const quote of (lang.strings || [])) {
      if (line.slice(i, i + quote.length) === quote) {
        const result = parseString(line, i, quote);
        tokens.push({ type: TokenType.STRING, text: result.text });
        i = result.end;
        if (!result.closed) {
          inString = true;
          stringChar = quote;
        }
        foundString = true;
        break;
      }
    }
    if (foundString) continue;
    
    // Check for numbers
    if (/[0-9]/.test(line[i]) || (line[i] === '.' && /[0-9]/.test(line[i + 1]))) {
      const result = parseNumber(line, i);
      tokens.push({ type: TokenType.NUMBER, text: result.text });
      i = result.end;
      continue;
    }
    
    // Check for identifiers/keywords
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      
      let type = TokenType.TEXT;
      if (lang.keywords && lang.keywords.includes(word)) {
        type = TokenType.KEYWORD;
      } else if (lang.constants && lang.constants.includes(word)) {
        type = TokenType.CONSTANT;
      } else if (lang.types && lang.types.includes(word)) {
        type = TokenType.TYPE;
      } else if (line[j] === '(') {
        type = TokenType.FUNCTION;
      }
      
      tokens.push({ type, text: word });
      i = j;
      continue;
    }
    
    // Operators
    if (/[+\-*/%=<>!&|^~?:]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[+\-*/%=<>!&|^~?:]/.test(line[j])) j++;
      tokens.push({ type: TokenType.OPERATOR, text: line.slice(i, j) });
      i = j;
      continue;
    }
    
    // Punctuation
    if (/[{}()\[\];,.]/.test(line[i])) {
      tokens.push({ type: TokenType.PUNCTUATION, text: line[i] });
      i++;
      continue;
    }
    
    // Anything else
    tokens.push({ type: TokenType.TEXT, text: line[i] });
    i++;
  }
  
  return {
    tokens,
    state: {
      inBlockComment,
      inString,
      stringChar,
    },
  };
}

/**
 * Parse a string starting at position i
 */
function parseString(line, i, quote) {
  let j = i + quote.length;
  let escaped = false;
  
  while (j < line.length) {
    if (escaped) {
      escaped = false;
      j++;
      continue;
    }
    
    if (line[j] === '\\') {
      escaped = true;
      j++;
      continue;
    }
    
    if (line.slice(j, j + quote.length) === quote) {
      return {
        text: line.slice(i, j + quote.length),
        end: j + quote.length,
        closed: true,
      };
    }
    
    j++;
  }
  
  // String continues to next line
  return {
    text: line.slice(i),
    end: line.length,
    closed: false,
  };
}

/**
 * Parse continuation of a string from previous line
 */
function parseStringContinuation(line, i, quote) {
  let j = i;
  let escaped = false;
  
  while (j < line.length) {
    if (escaped) {
      escaped = false;
      j++;
      continue;
    }
    
    if (line[j] === '\\') {
      escaped = true;
      j++;
      continue;
    }
    
    if (line.slice(j, j + quote.length) === quote) {
      return {
        text: line.slice(i, j + quote.length),
        end: j + quote.length,
        closed: true,
      };
    }
    
    j++;
  }
  
  return {
    text: line.slice(i),
    end: line.length,
    closed: false,
  };
}

/**
 * Parse a number starting at position i
 */
function parseNumber(line, i) {
  let j = i;
  
  // Handle hex, octal, binary
  if (line[j] === '0' && line[j + 1]) {
    const next = line[j + 1].toLowerCase();
    if (next === 'x') {
      // Hex
      j += 2;
      while (j < line.length && /[0-9a-fA-F_]/.test(line[j])) j++;
      return { text: line.slice(i, j), end: j };
    } else if (next === 'o') {
      // Octal
      j += 2;
      while (j < line.length && /[0-7_]/.test(line[j])) j++;
      return { text: line.slice(i, j), end: j };
    } else if (next === 'b') {
      // Binary
      j += 2;
      while (j < line.length && /[01_]/.test(line[j])) j++;
      return { text: line.slice(i, j), end: j };
    }
  }
  
  // Decimal (including floats)
  while (j < line.length && /[0-9_]/.test(line[j])) j++;
  
  // Decimal point
  if (line[j] === '.' && /[0-9]/.test(line[j + 1])) {
    j++;
    while (j < line.length && /[0-9_]/.test(line[j])) j++;
  }
  
  // Exponent
  if ((line[j] === 'e' || line[j] === 'E') && /[0-9+-]/.test(line[j + 1])) {
    j++;
    if (line[j] === '+' || line[j] === '-') j++;
    while (j < line.length && /[0-9_]/.test(line[j])) j++;
  }
  
  // BigInt suffix
  if (line[j] === 'n') j++;
  
  return { text: line.slice(i, j), end: j };
}

/**
 * Tokenize an entire document
 * @param {string[]} lines - Array of lines
 * @param {string} language - Language identifier
 * @returns {Array} - Array of token arrays for each line
 */
function tokenizeDocument(lines, language) {
  const result = [];
  let state = {};
  
  for (const line of lines) {
    const { tokens, state: newState } = tokenizeLine(line, language, state);
    result.push(tokens);
    state = newState;
  }
  
  return result;
}

module.exports = {
  TokenType,
  getLanguage,
  tokenizeLine,
  tokenizeDocument,
  languages,
  extensionMap,
};
