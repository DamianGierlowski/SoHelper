import { contextBridge, ipcRenderer } from 'electron';
import type { Api, UpdateEvent } from '../shared/types.mts';

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

// Adnotacja `: Api` sprawia, ze TypeScript pilnuje zgodnosci tego obiektu
// z kontraktem, ktory widzi renderer. Rozjazd nie przejdzie kompilacji.
const api: Api = {
  getAppInfo: invoke('app:info'),

  /** Wybudzenie komputera - sygnal, ze liczniki trzeba przeliczyc od razu. */
  onWake(callback) {
    const listener = (): void => callback();
    ipcRenderer.on('system:wake', listener);
    return () => ipcRenderer.removeListener('system:wake', listener);
  },

  locations: {
    list: invoke('locations:list'),
  },
  profiles: {
    list: invoke('profiles:list'),
    create: invoke('profiles:create'),
    update: invoke('profiles:update'),
    remove: invoke('profiles:remove'),
    getActiveId: invoke('profiles:getActiveId'),
    setActive: invoke('profiles:setActive'),
  },
  npcs: {
    list: invoke('npcs:list'),
    create: invoke('npcs:create'),
    update: invoke('npcs:update'),
    remove: invoke('npcs:remove'),
  },
  quests: {
    list: invoke('quests:list'),
    create: invoke('quests:create'),
    update: invoke('quests:update'),
    remove: invoke('quests:remove'),
    board: invoke('quests:board'),
  },
  takes: {
    add: invoke('takes:add'),
    undoLast: invoke('takes:undoLast'),
    history: invoke('takes:history'),
  },
  updates: {
    check: invoke('updates:check'),
    download: invoke('updates:download'),
    install: invoke('updates:install'),
    onEvent(callback) {
      const listener = (_event: unknown, payload: UpdateEvent): void => callback(payload);
      ipcRenderer.on('update:event', listener);
      return () => ipcRenderer.removeListener('update:event', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
