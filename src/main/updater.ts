import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateEvent, UpdateStatus } from '../shared/types.mts';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Wydania powstaja wylacznie dla Windows. Na macOS nie ma latest-mac.yml,
 * wiec nie ma czego sprawdzac - i osobno: Squirrel.Mac i tak wymagalby
 * podpisanej aplikacji, ktorej nie mamy.
 */
const UPDATES_SUPPORTED = process.platform === 'win32';

function broadcast(event: UpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:event', event);
  }
}

export function setupUpdater(): void {
  // W dev nie ma zainstalowanej aplikacji do podmiany; electron-updater
  // rzucilby "App is not packaged".
  if (!UPDATES_SUPPORTED || !app.isPackaged) return;

  // Pobieranie tylko na wyrazna zgode uzytkownika - nie zjadamy komus transferu.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    broadcast({ type: 'available', version: info.version });
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
  const current = app.getVersion();
  if (!UPDATES_SUPPORTED) return { state: 'unsupported', current };
  if (!app.isPackaged) return { state: 'dev', current };

  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo.version ?? null;
    if (!version || version === current) return { state: 'current', current };
    return { state: 'available', current, version };
  } catch (err) {
    return { state: 'error', current, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
