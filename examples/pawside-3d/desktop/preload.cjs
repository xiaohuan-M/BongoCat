'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pawDesktop', {
  onInput(listener) {
    const handler = (_event, input) => listener(input);
    ipcRenderer.on('paw:input', handler);
    return () => ipcRenderer.removeListener('paw:input', handler);
  },
  local: (event) => ipcRenderer.send('paw:local', event),
  toggleInput: () => ipcRenderer.send('paw:toggle'),
  studio: () => ipcRenderer.send('paw:studio'),
  quit: () => ipcRenderer.send('paw:quit'),
});
