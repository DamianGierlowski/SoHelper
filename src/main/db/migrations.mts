import type { DatabaseSync } from 'node:sqlite';
import builtInNpcs from '../../shared/npcs.json' with { type: 'json' };

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

  function npcsBecomeBuiltInData(db) {
    // NPC-e sa teraz danymi referencyjnymi w src/shared/npcs.json, tak samo jak
    // lokacje. Tabela znika, a quests.npc_id wskazuje na wpis z tej listy.
    // SQLite nie umie zdjac klucza obcego przez ALTER, wiec przebudowujemy tabele.

    // Stare NPC-e dopasowujemy po nazwie - id byly losowymi UUID-ami,
    // wiec nazwa to jedyne, co da sie porownac.
    const byName = new Map<string, string>();
    for (const npc of builtInNpcs) byName.set(npc.name.toLowerCase(), npc.id);

    const legacy = db.prepare('SELECT id, name FROM npcs').all() as Array<{
      id: string;
      name: string;
    }>;
    const remap = new Map<string, string>();
    for (const npc of legacy) {
      const match = byName.get(npc.name.toLowerCase());
      if (match) remap.set(npc.id, match);
    }

    db.exec(`
      CREATE TABLE quests_new (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        npc_id           TEXT NOT NULL,
        cooldown_minutes INTEGER NOT NULL
      );
      INSERT INTO quests_new SELECT id, name, npc_id, cooldown_minutes FROM quests;
      DROP TABLE quests;
      ALTER TABLE quests_new RENAME TO quests;
      CREATE INDEX quests_npc ON quests(npc_id);
      DROP TABLE npcs;
    `);

    // Questy NPC-tow spoza listy zostaja z nierozpoznawalnym npc_id - UI pokaze
    // je jako "Unknown NPC". Lepsze niz ciche skasowanie cudzej pracy.
    const update = db.prepare('UPDATE quests SET npc_id = ? WHERE npc_id = ?');
    for (const [oldId, newId] of remap) update.run(newId, oldId);
  },
];
