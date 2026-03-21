const { ipcRenderer } = require('electron');

process.once('loaded', () => {
  try {
    window.steamworks = require('steamworks.js');
  } catch (error) {
    window.steamworks = null;
  }

  window.electronAPI = {
    killApp: () => ipcRenderer.invoke('kill-app')
  };
});
