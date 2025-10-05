import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import { getOptionalEnv } from '@/lib/config/env';

const DB_DIRECTORY = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIRECTORY, 'app.db');

mkdirSync(DB_DIRECTORY, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

type Migration = {
  id: string;
  statement: string;
};

let vecEnabled = false;

function loadVectorExtension() {
  const potentialPaths: string[] = [];
  const configuredPath = getOptionalEnv('SQLITE_VEC_PATH');
  if (configuredPath) {
    potentialPaths.push(configuredPath);
  }
  // Attempt default module name as fallback.
  potentialPaths.push('sqlite-vec');

  for (const candidate of potentialPaths) {
    try {
      db.loadExtension(candidate);
      vecEnabled = true;
      console.info(`[sqlite] Loaded vector extension from: ${candidate}`);
      return;
    } catch (error) {
      // Try next candidate.
    }
  }

  console.warn('[sqlite] sqlite-vec extension not loaded. Falling back to cosine similarity in JavaScript.');
}

loadVectorExtension();

const migrations: Migration[] = [
  {
    id: 'conversation_state_v1',
    statement: `
      CREATE TABLE IF NOT EXISTS conversation_state (
        session_id TEXT PRIMARY KEY,
        last_summary TEXT,
        highlights TEXT,
        todos TEXT,
        updated_at TEXT
      );
    `,
  },
  {
    id: 'memory_summary_v1',
    statement: `
      CREATE TABLE IF NOT EXISTS memory_summary (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
      );
    `,
  },
  {
    id: 'memory_summary_index_v1',
    statement: `
      CREATE INDEX IF NOT EXISTS idx_memory_summary_session
      ON memory_summary (session_id, created_at DESC);
    `,
  },
  {
    id: 'assets_v1',
    statement: `
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        type TEXT,
        title TEXT,
        path TEXT,
        created_at TEXT,
        metadata TEXT
      );
    `,
  },
  {
    id: 'assets_index_v1',
    statement: `
      CREATE INDEX IF NOT EXISTS idx_assets_session
      ON assets (session_id, created_at DESC);
    `,
  },
];

if (vecEnabled) {
  migrations.push({
    id: 'memory_summary_vec_table_v1',
    statement: `
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_summary_vec
      USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      );
    `,
  });
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id TEXT PRIMARY KEY
    );
  `);

  const applied = new Set<string>();
  const rows = db.prepare('SELECT id FROM __migrations').all();
  rows.forEach((row: { id: string }) => applied.add(row.id));

  const insertMigration = db.prepare('INSERT INTO __migrations (id) VALUES (?)');

  db.transaction(() => {
    migrations.forEach((migration) => {
      if (!applied.has(migration.id)) {
        db.exec(migration.statement);
        insertMigration.run(migration.id);
      }
    });
  })();
}

runMigrations();

try {
  const columns = db.prepare('PRAGMA table_info(memory_summary)').all() as Array<{ name: string }>;
  const hasMetadata = columns.some((column) => column.name === 'metadata');
  if (!hasMetadata) {
    db.exec('ALTER TABLE memory_summary ADD COLUMN metadata TEXT;');
  }
} catch (error) {
  console.warn('[sqlite] Unable to verify memory_summary metadata column:', error);
}

export function getDatabase(): Database.Database {
  return db;
}

export function isVectorSearchEnabled(): boolean {
  return vecEnabled;
}
