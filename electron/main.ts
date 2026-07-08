import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import find from 'local-devices';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "AssetLink Desktop",
    icon: process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, '../public/icon.png')
      : path.join(app.getAppPath(), 'dist', 'icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    let isLoaded = false;
    const loadDevURL = () => {
      if (isLoaded) return;
      win.loadURL('http://localhost:3000').then(() => {
        isLoaded = true;
      }).catch((err) => {
        console.log('Failed to load dev URL, retrying in 1.5s...', err.message);
      });
    };

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        console.log('Main frame load failed. Vite dev server might still be compiling or starting up. Retrying connection in 1.5 seconds...');
        setTimeout(loadDevURL, 1500);
      }
    });

    loadDevURL();
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html from the dist folder
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  ipcMain.handle('scan-network', async () => {
    try {
      console.log('Starting network scan...');
      const devices = await find();
      console.log(`Scan complete. Found ${devices.length} devices.`);
      return devices;
    } catch (error) {
      console.error('Network scan failed:', error);
      throw error;
    }
  });

  createWindow();

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
