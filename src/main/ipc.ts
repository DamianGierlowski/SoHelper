import { ipcMain } from 'electron';
import { locations, npcs, profiles, quests, questBoard, takes } from './db/repo.mts';
import { checkForUpdates, downloadUpdate, installUpdate } from './updater.ts';
import type { NpcInput, ProfileInput, QuestInput } from '../shared/types.mts';

/**
 * Rejestruje kanaly IPC. Wszystko przez invoke/handle, wiec renderer dostaje
 * obietnice, a rzucony tu blad odrzuca ja po jego stronie z ta sama trescia.
 * Kontrakt widziany przez renderer opisuje `Api` w src/shared/types.mts.
 */
export function registerIpc(): void {
  ipcMain.handle('locations:list', () => locations);

  ipcMain.handle('profiles:list', () => profiles.list());
  ipcMain.handle('profiles:create', (_e, data: ProfileInput) => profiles.create(data));
  ipcMain.handle('profiles:update', (_e, id: string, data: Partial<ProfileInput>) =>
    profiles.update(id, data),
  );
  ipcMain.handle('profiles:remove', (_e, id: string) => profiles.remove(id));
  ipcMain.handle('profiles:getActiveId', () => profiles.getActiveId());
  ipcMain.handle('profiles:setActive', (_e, id: string) => profiles.setActive(id));

  ipcMain.handle('npcs:list', () => npcs.list());
  ipcMain.handle('npcs:create', (_e, data: NpcInput) => npcs.create(data));
  ipcMain.handle('npcs:update', (_e, id: string, data: Partial<NpcInput>) => npcs.update(id, data));
  ipcMain.handle('npcs:remove', (_e, id: string) => npcs.remove(id));

  ipcMain.handle('quests:list', () => quests.list());
  ipcMain.handle('quests:create', (_e, data: QuestInput) => quests.create(data));
  ipcMain.handle('quests:update', (_e, id: string, data: Partial<QuestInput>) =>
    quests.update(id, data),
  );
  ipcMain.handle('quests:remove', (_e, id: string) => quests.remove(id));
  ipcMain.handle('quests:board', (_e, profileId: string) => questBoard(profileId));

  ipcMain.handle('takes:add', (_e, profileId: string, questId: string, takenAt?: number) =>
    takes.add(profileId, questId, takenAt),
  );
  ipcMain.handle('takes:undoLast', (_e, profileId: string, questId: string) =>
    takes.undoLast(profileId, questId),
  );
  ipcMain.handle('takes:history', (_e, profileId: string, limit?: number) =>
    takes.history(profileId, limit),
  );

  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:download', () => downloadUpdate());
  ipcMain.handle('updates:install', () => installUpdate());
}
