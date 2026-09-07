import type { DatabaseSync } from 'node:sqlite';

// Kazda migracja to jeden krok w gore. Indeks w tablicy + 1 == docelowy user_version.
// Nigdy nie zmieniamy istniejacego wpisu - dopisujemy nowy na koncu.
export const migrations: Array<(db: DatabaseSync) => void> = [
  function initialSchema(db) {
    db.exec(`
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE profiles (
        id         TEXT PRIMARY KEY,
        nick       TEXT NOT NULL,
        faction    TEXT,
        level      INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE npcs (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        location_id TEXT NOT NULL
      );

      CREATE TABLE quests (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        npc_id           TEXT NOT NULL REFERENCES npcs(id) ON DELETE RESTRICT,
        cooldown_minutes INTEGER NOT NULL
      );

      CREATE TABLE takes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        quest_id   TEXT NOT NULL REFERENCES quests(id)   ON DELETE CASCADE,
        taken_at   INTEGER NOT NULL
      );

      CREATE INDEX takes_lookup ON takes(profile_id, quest_id, taken_at DESC);
      CREATE INDEX quests_npc   ON quests(npc_id);
      CREATE INDEX npcs_loc     ON npcs(location_id);
    `);
  },

  function dropProfileFactionAndLevel(db) {
    // Postac to teraz sam nick - frakcja i poziom nie sluzyly do niczego,
    // a byly kolejnym polem do wypelnienia przy kazdej nowej postaci.
    db.exec('ALTER TABLE profiles DROP COLUMN faction');
    db.exec('ALTER TABLE profiles DROP COLUMN level');
  },
];
