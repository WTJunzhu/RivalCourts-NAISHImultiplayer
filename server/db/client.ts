import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function getDb(): Client | null {
  if (_db) return _db;
  const url = process.env.TURSO_URL;
  if (!url) return null;
  _db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  if (!db) { console.log('[DB] no TURSO_URL — running in-memory only'); return; }
  await db.batch([
    'CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host_id TEXT NOT NULL, options TEXT NOT NULL, player_list TEXT NOT NULL, created_at INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS game_snapshots (code TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  ], 'write');
  console.log('[DB] tables ready');
}
