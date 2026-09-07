// Test dymny warstwy danych. Chodzi na czystym Node (node:sqlite jest wbudowane,
// a typy zdejmowane w locie), bez uruchamiania Electrona - sprawdza schemat,
// walidacje i reguly kasowania.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, getDb, openDatabase } from '../src/main/db/index.mts';
import { npcs, profiles, quests, questBoard, takes } from '../src/main/db/repo.mts';
import { migrations } from '../src/main/db/migrations.mts';
import type { Npc, Profile, Quest, QuestBoardRow } from '../src/shared/types.mts';

const dir = mkdtempSync(join(tmpdir(), 'sohelper-smoke-'));
const checks: string[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    checks.push(`  ok   ${name}`);
  } catch (err) {
    checks.push(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function throws(fn: () => unknown, fragment: string): void {
  try {
    fn();
  } catch (err) {
    assert.match(err instanceof Error ? err.message : String(err), new RegExp(fragment, 'i'));
    return;
  }
  throw new Error(`oczekiwano bledu zawierajacego "${fragment}"`);
}

function only(rows: QuestBoardRow[]): QuestBoardRow {
  assert.equal(rows.length, 1, `oczekiwano jednego questa, jest ${rows.length}`);
  return rows[0] as QuestBoardRow;
}

function pragma(name: string): unknown {
  const row = getDb().prepare(`PRAGMA ${name}`).get() as Record<string, unknown>;
  return row[name];
}

openDatabase(join(dir, 'test.db'));

let wedrowiec: Profile;
let tulacz: Profile;
let sidorowicz: Npc;
let quest: Quest;

check('migracje doprowadzaja do najnowszej wersji', () => {
  assert.equal(pragma('user_version'), migrations.length);
});

check('profil to juz tylko nick', () => {
  const columns = (getDb().prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string }>)
    .map((c) => c.name)
    .sort();
  assert.deepEqual(columns, ['created_at', 'id', 'nick']);
});

check('klucze obce sa wlaczone', () => {
  assert.equal(pragma('foreign_keys'), 1);
});

check('baza chodzi w WAL', () => {
  assert.equal(pragma('journal_mode'), 'wal');
});

check('tworzenie profili', () => {
  wedrowiec = profiles.create({ nick: 'Wedrowiec_PL' });
  tulacz = profiles.create({ nick: 'Tulacz' });
  assert.equal(profiles.list().length, 2);
});

check('pierwszy profil staje sie aktywny', () => {
  assert.equal(profiles.getActiveId(), wedrowiec.id);
});

check('pusty nick odrzucony', () => {
  throws(() => profiles.create({ nick: '   ' }), 'name cannot be empty');
});

check('tworzenie NPC z wbudowana lokacja', () => {
  sidorowicz = npcs.create({ name: 'Sidorowicz', locationId: 'lyubech' });
  assert.equal(sidorowicz.locationId, 'lyubech');
});

check('nieznana lokacja odrzucona', () => {
  throws(() => npcs.create({ name: 'Ktos', locationId: 'kordon' }), 'unknown location');
});

check('tworzenie questa', () => {
  quest = quests.create({
    name: 'Zabezpieczenie przeprawy',
    npcId: sidorowicz.id,
    cooldownMinutes: 1440,
  });
  assert.equal(quest.cooldownMinutes, 1440);
});

check('cooldown musi byc dodatni', () => {
  throws(() => quests.create({ name: 'X', npcId: sidorowicz.id, cooldownMinutes: 0 }), 'positive');
  throws(() => quests.create({ name: 'X', npcId: sidorowicz.id, cooldownMinutes: 1.5 }), 'positive');
});

check('quest u nieistniejacego NPC odrzucony', () => {
  throws(() => quests.create({ name: 'X', npcId: 'brak', cooldownMinutes: 60 }), 'no such npc');
});

check('NPC z questami nie da sie usunac', () => {
  throws(() => npcs.remove(sidorowicz.id), 'quest\\(s\\) assigned');
});

check('board bez wziec: nextAvailableAt = null', () => {
  const row = only(questBoard(wedrowiec.id));
  assert.equal(row.lastTakenAt, null);
  assert.equal(row.nextAvailableAt, null);
  assert.equal(row.npcName, 'Sidorowicz');
  assert.equal(row.locationId, 'lyubech');
});

check('wziecie ustawia moment odnowy', () => {
  const at = Date.now() - 3_600_000; // godzine temu
  takes.add(wedrowiec.id, quest.id, at);
  const row = only(questBoard(wedrowiec.id));
  assert.equal(row.lastTakenAt, at);
  assert.equal(row.nextAvailableAt, at + 1440 * 60_000);
});

check('profile nie dziela historii', () => {
  assert.equal(only(questBoard(tulacz.id)).lastTakenAt, null);
});

check('wziecie w przyszlosci odrzucone', () => {
  throws(() => takes.add(wedrowiec.id, quest.id, Date.now() + 60_000), 'cannot be recorded in the future');
});

check('cofniecie przywraca poprzednie wziecie', () => {
  const previous = only(questBoard(wedrowiec.id)).lastTakenAt;
  const newer = Date.now() - 60_000;

  takes.add(wedrowiec.id, quest.id, newer);
  assert.equal(only(questBoard(wedrowiec.id)).lastTakenAt, newer);

  assert.equal(takes.undoLast(wedrowiec.id, quest.id), true);
  assert.equal(only(questBoard(wedrowiec.id)).lastTakenAt, previous);
});

check('cofniecie bez wziec zwraca false', () => {
  assert.equal(takes.undoLast(tulacz.id, quest.id), false);
});

check('historia jest posortowana malejaco', () => {
  const rows = takes.history(wedrowiec.id);
  const sorted = [...rows].sort((a, b) => b.takenAt - a.takenAt);
  assert.deepEqual(
    rows.map((r) => r.takenAt),
    sorted.map((r) => r.takenAt),
  );
  assert.equal(rows[0]?.questName, 'Zabezpieczenie przeprawy');
});

check('usuniecie profilu kasuje jego wziecia kaskada', () => {
  assert.ok(takes.history(wedrowiec.id).length > 0);
  profiles.remove(wedrowiec.id);
  assert.equal(profiles.get(wedrowiec.id), null);
  assert.notEqual(profiles.getActiveId(), wedrowiec.id, 'aktywny profil musi sie przelaczyc');
});

check('usuniecie questa kasuje jego wziecia kaskada', () => {
  takes.add(tulacz.id, quest.id, Date.now() - 1000);
  assert.equal(takes.history(tulacz.id).length, 1);
  quests.remove(quest.id);
  assert.equal(takes.history(tulacz.id).length, 0);
});

closeDatabase();

// Migracja prawdziwej bazy w wersji 1, z danymi - nie swiezo utworzonej.
check('baza v1 z danymi migruje bez utraty postaci', () => {
  const legacyFile = join(dir, 'legacy.db');
  const legacy = new DatabaseSync(legacyFile);
  migrations[0]?.(legacy);
  legacy.exec('PRAGMA user_version = 1');
  legacy
    .prepare('INSERT INTO profiles(id, nick, faction, level, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('p1', 'Stary_Gracz', 'Wolnosc', 41, Date.now());
  legacy.close();

  openDatabase(legacyFile);
  assert.equal(pragma('user_version'), migrations.length);
  const rows = profiles.list();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.nick, 'Stary_Gracz');
  closeDatabase();
});

rmSync(dir, { recursive: true, force: true });

console.log(checks.join('\n'));
console.log(process.exitCode ? '\nSA BLEDY' : `\n${checks.length} testow OK`);
