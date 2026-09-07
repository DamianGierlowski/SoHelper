import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateEvent, UpdateStatus } from '../shared/types.mts';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASES_URL = 'https://github.com/DamianGierlowski/SoHelper/releases/latest';

/**
 * Squirrel.Mac weryfikuje podpis aplikacji przy instalacji aktualizacji, wiec
 * na niepodpisanym macOS-ie nie ma czego automatyzowac - tam tylko informujemy
 * o nowej wersji i otwieramy strone wydan. Windows aktualizuje sie bez podpisu.
 */
const canAutoInstall = process.platform === 'win32';

function broadcast(event: UpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:event', event);
  }
}

export function setupUpdater(): void {
  // W dev nie ma zainstalowanej aplikacji do podmiany; electron-updater
  // rzucilby "App is not packaged".
  if (!app.isPackaged) return;

  // Pobieranie tylko na wyrazna zgode uzytkownika - nie zjadamy komus transferu.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = canAutoInstall;

  autoUpdater.on('update-available', (info) => {
    broadcast({ type: 'available', version: info.version, canAutoInstall });
  });
  autoUpdater.on('download-progress', (progress) => {
    broadcast({ type: 'progress', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', () => broadcast({ type: 'downloaded' }));
  autoUpdater.on('error', (err) => broadcast({ type: 'error', message: err.message }));

  void checkQuietly();
  setInterval(() => void checkQuietly(), CHECK_INTERVAL_MS);
}

/** Sprawdzenie w tle - brak sieci nie jest bledem wartym pokazywania. */
async function checkQuietly(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // cisza
  }
}

/** Sprawdzenie na zadanie uzytkownika - tu odpowiedz jest potrzebna zawsze. */
export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return { state: 'dev', current: app.getVersion() };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo.version ?? null;
    if (!version || version === app.getVersion()) {
      return { state: 'current', current: app.getVersion() };
    }
    return { state: 'available', current: app.getVersion(), version, canAutoInstall };
  } catch (err) {
    return {
      state: 'error',
      current: app.getVersion(),
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

export async function openReleasePage(): Promise<void> {
  await shell.openExternal(RELEASES_URL);
}
