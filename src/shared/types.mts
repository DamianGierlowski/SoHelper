// Jedno zrodlo prawdy o ksztalcie danych. Importowane wylacznie przez `import type`,
// wiec znika przy kompilacji i nie tworzy zaleznosci w czasie dzialania.

export interface Location {
  id: string;
  name: string;
  nameRu: string;
  timezone: string;
}

export interface Profile {
  id: string;
  nick: string;
  createdAt: number;
}

export interface Npc {
  id: string;
  name: string;
  locationId: string;
}

export interface Quest {
  id: string;
  name: string;
  npcId: string;
  cooldownMinutes: number;
}

export interface Take {
  id: number;
  profileId: string;
  questId: string;
  takenAt: number;
}

export interface HistoryEntry {
  id: number;
  questId: string;
  questName: string;
  takenAt: number;
}

/**
 * Wiersz listy questow. Zwraca timestampy, nie pozostale sekundy - odliczanie
 * liczy renderer z `Date.now()`, zeby usypianie komputera nie rozjezdzalo licznikow.
 * `null` w obu polach oznacza quest jeszcze nigdy nie wziety tym profilem.
 */
export interface QuestBoardRow {
  id: string;
  name: string;
  cooldownMinutes: number;
  npcId: string;
  npcName: string;
  locationId: string;
  lastTakenAt: number | null;
  nextAvailableAt: number | null;
}

export interface ProfileInput {
  nick: string;
}

export interface NpcInput {
  name: string;
  locationId: string;
}

export interface QuestInput {
  name: string;
  npcId: string;
  cooldownMinutes: number;
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
}

export type UpdateEvent =
  | { type: 'available'; version: string; canAutoInstall: boolean }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded' }
  | { type: 'error'; message: string };

export type UpdateStatus =
  /** Tryb deweloperski - nie ma czego aktualizowac. */
  | { state: 'dev'; current: string }
  | { state: 'current'; current: string }
  | { state: 'available'; current: string; version: string; canAutoInstall: boolean }
  | { state: 'error'; current: string; message: string };

/** Kontrakt wystawiony przez preload jako `window.api`. */
export interface Api {
  getAppInfo(): Promise<AppInfo>;
  /** Sygnal wybudzenia komputera. Zwraca funkcje odpinajaca nasluch. */
  onWake(callback: () => void): () => void;

  locations: {
    list(): Promise<Location[]>;
  };
  profiles: {
    list(): Promise<Profile[]>;
    create(data: ProfileInput): Promise<Profile>;
    update(id: string, data: Partial<ProfileInput>): Promise<Profile>;
    remove(id: string): Promise<void>;
    getActiveId(): Promise<string | null>;
    setActive(id: string): Promise<void>;
  };
  npcs: {
    list(): Promise<Npc[]>;
    create(data: NpcInput): Promise<Npc>;
    update(id: string, data: Partial<NpcInput>): Promise<Npc>;
    remove(id: string): Promise<void>;
  };
  quests: {
    list(): Promise<Quest[]>;
    create(data: QuestInput): Promise<Quest>;
    update(id: string, data: Partial<QuestInput>): Promise<Quest>;
    remove(id: string): Promise<void>;
    board(profileId: string): Promise<QuestBoardRow[]>;
  };
  takes: {
    add(profileId: string, questId: string, takenAt?: number): Promise<Take>;
    undoLast(profileId: string, questId: string): Promise<boolean>;
    history(profileId: string, limit?: number): Promise<HistoryEntry[]>;
  };
  updates: {
    check(): Promise<UpdateStatus>;
    download(): Promise<void>;
    install(): Promise<void>;
    openReleasePage(): Promise<void>;
    /** Zwraca funkcje odpinajaca nasluch. */
    onEvent(callback: (event: UpdateEvent) => void): () => void;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}
