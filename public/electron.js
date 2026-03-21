const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

ipcMain.handle('kill-app', () => {
  app.quit();
});

const useSteam = process.env.ELECTRON_USE_STEAM === 'true';

if (useSteam) {
  try {
    const steamworks = require('steamworks.js');
    const client = steamworks.init();
    console.log('Steam initialized for', client.localplayer.getName());

    app.commandLine.appendSwitch('in-process-gpu');
    app.commandLine.appendSwitch('disable-direct-composition');
    app.allowRendererProcessReuse = false;
  } catch (error) {
    console.error('Steam init failed:', error);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (app.isPackaged) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.removeMenu();
    mainWindow.setMenu(null);
  }

  const appUrl = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
      })
    : 'http://localhost:3000';

  mainWindow.loadURL(appUrl);
}

function setupLocalFilesNormalizerProxy() {
  protocol.registerHttpProtocol(
    'file',
    (request, callback) => {
      const normalizedPath = request.url.substr(8);
      callback({ path: path.normalize(`${__dirname}/${normalizedPath}`) });
    },
    (error) => {
      if (error) {
        console.error('Failed to register file protocol:', error);
      }
    }
  );
}

app.whenReady().then(() => {
  createWindow();
  setupLocalFilesNormalizerProxy();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (useSteam) {
  try {
    require('steamworks.js').electronEnableSteamOverlay();
  } catch (error) {
    console.error('Failed to enable Steam overlay:', error);
  }
}
