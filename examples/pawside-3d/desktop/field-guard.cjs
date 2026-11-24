'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
// A focus probe may lag, exit, or be denied permission. Outside our own window
// keyboard packets therefore always contain only coarse activity, even after 'O'.
function watchField(onChange) {
  const platform = process.platform;
  if (!['win32', 'darwin'].includes(platform)) return () => {};
  const args =
    platform === 'darwin'
      ? ['-l', 'JavaScript', path.join(__dirname, 'field-macos.js')]
      : [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-File',
          path.join(__dirname, 'field-windows.ps1'),
        ];
  const exe =
    platform === 'darwin'
      ? '/usr/bin/osascript'
      : path.join(
          process.env.SystemRoot || 'C:\\Windows',
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'powershell.exe'
        );
  const child = spawn(exe, args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  let stopped = false;
  lines.on('line', (line) => {
    if (!stopped)
      onChange(
        line === 'P' ? 'protected' : line === 'O' ? 'ordinary' : 'unknown'
      );
  });
  // Keep a known protected field covered on a lost reading, until trusted evidence changes.
  child.on('error', () => {
    if (!stopped) onChange('unknown');
  });
  child.on('exit', () => {
    if (!stopped) onChange('unknown');
  });
  return () => {
    stopped = true;
    lines.close();
    child.kill();
  };
}
module.exports = { watchField };
