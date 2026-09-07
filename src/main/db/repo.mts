import { randomUUID } from 'node:crypto';
import { execute, queryAll, queryOne, transaction } from './index.mts';
import locationsData from '../../shared/locations.json' with { type: 'json' };
import type {
  HistoryEntry,
  Location,
  Npc,
  NpcInput,
  Profile,
  ProfileInput,
  Quest,
  QuestBoardRow,
  QuestInput,
  Take,
} from '../../shared/types.mts';

const MINUTE = 60_000;

export const locations: Location[] = locationsData;
const locationIds = new Set(locations.map((l) => l.id));

// --- ksztalty wierszy w bazie (snake_case) ---------------------------------

interface ProfileRow {
  id: string;
  nick: string;
  created_at: number;
}
interface NpcRow {
  id: string;
  name: string;
  location_id: string;
}
interface QuestRow {
  id: string;
  name: string;
  npc_id: string;
  cooldown_minutes: number;
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  nick: r.nick,
  createdAt: r.created_at,
});
const toNpc = (r: NpcRow): Npc => ({ id: r.id, name: r.name, locationId: r.location_id });
const toQuest = (r: QuestRow): Quest => ({
  id: r.id,
  name: r.name,
  npcId: r.npc_id,
  cooldownMinutes: r.cooldown_minutes,
});

// --- walidacja -------------------------------------------------------------

function requireText(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} cannot be empty`);
  return text;
}

function requireLocation(id: string): string {
  if (!locationIds.has(id)) throw new Error(`Unknown location: ${id}`);
  return id;
}

function requireCooldown(minutes: number): number {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error('Cooldown must be a positive number of minutes');
  }
  return minutes;
}

function requireTimestamp(ms: number, label: string): number {
  if (!Number.isFinite(ms)) throw new Error(`${label}: invalid time`);
  if (ms > Date.now()) throw new Error('A take cannot be recorded in the future');
  return Math.round(ms);
}

function requireRow<T>(row: T | null | undefined, message: string): T {
  if (row === null || row === undefined) throw new Error(message);
  return row;
}

// --- settings --------------------------------------------------------------

export const settings = {
  get(key: string): string | null {
    return queryOne<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', key)
      ?.value ?? null;
  },
  set(key: string, value: string | null): void {
    execute(
      'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  },
};

// --- profile ---------------------------------------------------------------

export const profiles = {
  list(): Profile[] {
    return queryAll<ProfileRow>('SELECT * FROM profiles ORDER BY created_at').map(toProfile);
  },

  get(id: string): Profile | null {
    const row = queryOne<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id);
    return row ? toProfile(row) : null;
  },

  create({ nick }: ProfileInput): Profile {
    const id = randomUUID();
    execute(
      'INSERT INTO profiles(id, nick, created_at) VALUES (?, ?, ?)',
      id,
      requireText(nick, 'Name'),
      Date.now(),
    );
    // Pierwszy utworzony profil od razu staje sie aktywny.
    if (!settings.get('activeProfileId')) settings.set('activeProfileId', id);
    return requireRow(this.get(id), 'Failed to create the character');
  },

  update(id: string, { nick }: Partial<ProfileInput>): Profile {
    const current = requireRow(this.get(id), 'No such character');
    execute(
      'UPDATE profiles SET nick = ? WHERE id = ?',
      nick === undefined ? current.nick : requireText(nick, 'Name'),
      id,
    );
    return requireRow(this.get(id), 'No such character');
  },

  remove(id: string): void {
    transaction(() => {
      // takes znikaja kaskada z klucza obcego
      execute('DELETE FROM profiles WHERE id = ?', id);
      if (settings.get('activeProfileId') === id) {
        settings.set('activeProfileId', this.list()[0]?.id ?? null);
      }
    });
  },

  getActiveId(): string | null {
    const id = settings.get('activeProfileId');
    return id && this.get(id) ? id : null;
  },

  setActive(id: string): void {
    requireRow(this.get(id), 'No such character');
    settings.set('activeProfileId', id);
  },
};

// --- NPC -------------------------------------------------------------------

export const npcs = {
  list(): Npc[] {
    return queryAll<NpcRow>('SELECT * FROM npcs ORDER BY name').map(toNpc);
  },

  get(id: string): Npc | null {
    const row = queryOne<NpcRow>('SELECT * FROM npcs WHERE id = ?', id);
    return row ? toNpc(row) : null;
  },

  create({ name, locationId }: NpcInput): Npc {
    const id = randomUUID();
    execute(
      'INSERT INTO npcs(id, name, location_id) VALUES (?, ?, ?)',
      id,
      requireText(name, 'NPC name'),
      requireLocation(locationId),
    );
    return requireRow(this.get(id), 'Failed to create the NPC');
  },

  update(id: string, { name, locationId }: Partial<NpcInput>): Npc {
    const current = requireRow(this.get(id), 'No such NPC');
    execute(
      'UPDATE npcs SET name = ?, location_id = ? WHERE id = ?',
      name === undefined ? current.name : requireText(name, 'NPC name'),
      locationId === undefined ? current.locationId : requireLocation(locationId),
      id,
    );
    return requireRow(this.get(id), 'No such NPC');
  },

  /** Odmawia usuniecia NPC-ta, ktory ma questy - zamiast po cichu je skasowac. */
  remove(id: string): void {
    const row = queryOne<{ count: number }>(
      'SELECT count(*) count FROM quests WHERE npc_id = ?',
      id,
    );
    if (row && row.count > 0) {
      throw new Error(`This NPC has ${row.count} quest(s) assigned. Delete them first.`);
    }
    execute('DELETE FROM npcs WHERE id = ?', id);
  },
};

// --- questy ----------------------------------------------------------------

export const quests = {
  list(): Quest[] {
    return queryAll<QuestRow>('SELECT * FROM quests ORDER BY name').map(toQuest);
  },

  get(id: string): Quest | null {
    const row = queryOne<QuestRow>('SELECT * FROM quests WHERE id = ?', id);
    return row ? toQuest(row) : null;
  },

  create({ name, npcId, cooldownMinutes }: QuestInput): Quest {
    requireRow(npcs.get(npcId), 'No such NPC');
    const id = randomUUID();
    execute(
      'INSERT INTO quests(id, name, npc_id, cooldown_minutes) VALUES (?, ?, ?, ?)',
      id,
      requireText(name, 'Quest name'),
      npcId,
      requireCooldown(cooldownMinutes),
    );
    return requireRow(this.get(id), 'Failed to create the quest');
  },

  update(id: string, { name, npcId, cooldownMinutes }: Partial<QuestInput>): Quest {
    const current = requireRow(this.get(id), 'No such quest');
    if (npcId !== undefined) requireRow(npcs.get(npcId), 'No such NPC');
    execute(
      'UPDATE quests SET name = ?, npc_id = ?, cooldown_minutes = ? WHERE id = ?',
      name === undefined ? current.name : requireText(name, 'Quest name'),
      npcId === undefined ? current.npcId : npcId,
      cooldownMinutes === undefined ? current.cooldownMinutes : requireCooldown(cooldownMinutes),
      id,
    );
    return requireRow(this.get(id), 'No such quest');
  },

  remove(id: string): void {
    // takes znikaja kaskada z klucza obcego
    execute('DELETE FROM quests WHERE id = ?', id);
  },
};

// --- wziecia ---------------------------------------------------------------

export const takes = {
  /** Zapisuje wziecie. Domyslnie teraz; `takenAt` pozwala uzupelnic wstecz. */
  add(profileId: string, questId: string, takenAt: number = Date.now()): Take {
    requireRow(profiles.get(profileId), 'No such character');
    requireRow(quests.get(questId), 'No such quest');
    const at = requireTimestamp(takenAt, 'Take time');
    const { lastInsertRowid } = execute(
      'INSERT INTO takes(profile_id, quest_id, taken_at) VALUES (?, ?, ?)',
      profileId,
      questId,
      at,
    );
    return { id: Number(lastInsertRowid), profileId, questId, takenAt: at };
  },

  /** Cofa ostatnie wziecie - poprzednie znow staje sie aktualne. */
  undoLast(profileId: string, questId: string): boolean {
    const row = queryOne<{ id: number }>(
      'SELECT id FROM takes WHERE profile_id = ? AND quest_id = ? ORDER BY taken_at DESC, id DESC LIMIT 1',
      profileId,
      questId,
    );
    if (!row) return false;
    execute('DELETE FROM takes WHERE id = ?', row.id);
    return true;
  },

  history(profileId: string, limit = 100): HistoryEntry[] {
    return queryAll<{ id: number; quest_id: string; taken_at: number; quest_name: string }>(
      `SELECT t.id, t.quest_id, t.taken_at, q.name quest_name
         FROM takes t JOIN quests q ON q.id = t.quest_id
        WHERE t.profile_id = ?
        ORDER BY t.taken_at DESC, t.id DESC
        LIMIT ?`,
      profileId,
      limit,
    ).map((r) => ({
      id: r.id,
      questId: r.quest_id,
      questName: r.quest_name,
      takenAt: r.taken_at,
    }));
  },
};

// --- widok listy questow ---------------------------------------------------

/**
 * Questy z momentem odnowy dla danego profilu. Zwraca timestampy, nie napisy
 * ani pozostale sekundy - odliczanie robi renderer z `Date.now()`, zeby usypianie
 * komputera nie rozjezdzalo licznikow.
 */
export function questBoard(profileId: string): QuestBoardRow[] {
  return queryAll<{
    id: string;
    name: string;
    cooldown_minutes: number;
    npc_id: string;
    npc_name: string;
    location_id: string;
    last_taken_at: number | null;
  }>(
    `SELECT q.id, q.name, q.cooldown_minutes, q.npc_id,
            n.name npc_name, n.location_id,
            (SELECT max(taken_at) FROM takes t
              WHERE t.quest_id = q.id AND t.profile_id = ?) last_taken_at
       FROM quests q
       JOIN npcs n ON n.id = q.npc_id
      ORDER BY q.name`,
    profileId,
  ).map((r) => ({
    id: r.id,
    name: r.name,
    cooldownMinutes: r.cooldown_minutes,
    npcId: r.npc_id,
    npcName: r.npc_name,
    locationId: r.location_id,
    lastTakenAt: r.last_taken_at,
    nextAvailableAt: r.last_taken_at ? r.last_taken_at + r.cooldown_minutes * MINUTE : null,
  }));
}
