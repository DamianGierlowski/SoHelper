import { app, BrowserWindow, ipcMain, powerMonitor, session, shell } from 'electron';
import { join } from 'node:path';
import { closeDatabase, openDatabase } from './db/index.mts';
import { registerIpc } from './ipc.ts';
import { setupUpdater } from './updater.ts';
import type { AppInfo } from '../shared/types.mts';

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0C0E11',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Otwieraj linki zewnetrzne w domyslnej przegladarce, nie w oknie aplikacji.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// CSP tylko w buildzie produkcyjnym - dev server Vite potrzebuje inline
// skryptow i websocketu na HMR.
function applyContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; style-src 'self' 'unsafe-inline'"],
      },
    });
  });
}

ipcMain.handle(
  'app:info',
  (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
  }),
);

void app.whenReady().then(() => {
  openDatabase(join(app.getPath('userData'), 'sohelper.db'));
  registerIpc();

  // Po wybudzeniu komputera liczniki w rendererze sa o caly sen do tylu.
  // Nie czekamy na kolejny tick, tylko kazemy im przeliczyc sie od razu.
  powerMonitor.on('resume', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('system:wake');
    }
  });

  if (!isDev) applyContentSecurityPolicy();
  createWindow();
  setupUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', closeDatabase);
