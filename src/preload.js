const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  getState: () => ipcRenderer.invoke('pet:get-state'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:state', listener);
    return () => ipcRenderer.removeListener('pet:state', listener);
  },
  setInteractive: (interactive) => ipcRenderer.send('pet:interactive', interactive),
  startDrag: () => ipcRenderer.send('pet:drag-start'),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  openMenu: () => ipcRenderer.send('pet:menu'),
});
