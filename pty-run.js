'use strict';

const pty = require('node-pty');
const path = require('path');

const editorPath = path.join(__dirname, 'index.js');
const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: process.stdout.columns || 120,
  rows: process.stdout.rows || 40,
  cwd: process.cwd(),
  env: process.env
});

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (args.length > 0) {
  ptyProcess.write(`node "${editorPath}" ${args.map(a => `"${a}"`).join(' ')}\r`);
} else {
  ptyProcess.write(`node "${editorPath}"\r`);
}

ptyProcess.onData((data) => {
  process.stdout.write(data);
});

ptyProcess.onExit(({ exitCode }) => {
  process.exit(exitCode);
});

process.stdin.on('data', (data) => {
  ptyProcess.write(data);
});

process.stdin.resume();
process.stdin.setRawMode(true);
