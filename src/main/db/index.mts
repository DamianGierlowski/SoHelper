import { DatabaseSync, type SQLInputValue, type StatementResultingChanges } from 'node:sqlite';
import { migrations } from './migrations.mts';

let db: DatabaseSync | null = null;

/** Otwiera baze, ustawia pragmy i doprowadza schemat do najnowszej wersji. */
export function openDatabase(file: string): DatabaseSync {
  db = new DatabaseSync(file);

  // WAL: zapisy nie blokuja odczytow i nie przepisuja calego pliku.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database has not been opened');
  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}

// node:sqlite zwraca Record<string, SQLOutputValue>, wiec ksztalt wiersza i tak
// deklarujemy sami. Te trzy funkcje sa jedynym miejscem z rzutowaniem - dalej
// w repozytorium typy sa juz prawdziwe.

export function queryAll<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function execute(sql: string, ...params: SQLInputValue[]): StatementResultingChanges {
  return getDb().prepare(sql).run(...params);
}

/** Uruchamia wszystko w jednej transakcji; przy bledzie cofa calosc. */
export function transaction<T>(fn: () => T): T {
  const conn = getDb();
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

function migrate(conn: DatabaseSync): void {
  const row = conn.prepare('PRAGMA user_version').get() as { user_version: number };
  const current = row.user_version;
  const target = migrations.length;

  // Baza z przyszlosci: nie ruszamy jej, zeby nie zniszczyc danych nowszej wersji.
  if (current > target) {
    throw new Error(
      `The database is at version ${current}, but this build supports ${target}. ` +
        'Update the app.',
    );
  }

  for (let version = current; version < target; version++) {
    const step = migrations[version];
    if (!step) continue;
    conn.exec('BEGIN');
    try {
      step(conn);
      // PRAGMA nie przyjmuje parametrow, a wartosc jest liczba z naszego kodu.
      conn.exec(`PRAGMA user_version = ${version + 1}`);
      conn.exec('COMMIT');
    } catch (err) {
      conn.exec('ROLLBACK');
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Migration to version ${version + 1} failed: ${message}`);
    }
  }
}
