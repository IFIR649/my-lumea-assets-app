const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "lan-share.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function ensureNotesColumns(database) {
  const cols = database.prepare("PRAGMA table_info(notes)").all().map((c) => c.name);
  const hasLegacyPinned = cols.includes("is_pinned");

  if (!cols.includes("title")) database.exec("ALTER TABLE notes ADD COLUMN title TEXT;");
  if (!cols.includes("pinned")) {
    database.exec("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;");
    if (hasLegacyPinned) {
      database.exec("UPDATE notes SET pinned = COALESCE(is_pinned, 0);");
    }
  }
  if (!cols.includes("updated_at")) database.exec("ALTER TABLE notes ADD COLUMN updated_at INTEGER;");

  // Backfill metadata so old rows render correctly in the new UI.
  database.exec(`
    UPDATE notes
    SET
      title = COALESCE(NULLIF(TRIM(title), ''), NULLIF(SUBSTR(TRIM(content), 1, 80), ''), 'Sin titulo'),
      updated_at = COALESCE(updated_at, created_at),
      pinned = COALESCE(pinned, 0)
  `);

  database.exec("CREATE INDEX IF NOT EXISTS idx_notes_pinned_created ON notes(pinned, created_at DESC);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);");
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      client_id   TEXT PRIMARY KEY,
      name        TEXT,
      first_seen  INTEGER NOT NULL,
      last_seen   INTEGER NOT NULL,
      last_ip     TEXT,
      user_agent  TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   TEXT NOT NULL,
      ip          TEXT NOT NULL,
      user_agent  TEXT,
      first_seen  INTEGER NOT NULL,
      last_seen   INTEGER NOT NULL,
      last_ping   INTEGER,
      hits        INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      client_id   TEXT,
      client_name TEXT,
      ip          TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);

    CREATE TABLE IF NOT EXISTS files (
      id            TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL,
      size          INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      client_id     TEXT,
      client_name   TEXT,
      ip            TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);

    CREATE TABLE IF NOT EXISTS messages (
      id           TEXT PRIMARY KEY,
      kind         TEXT NOT NULL,
      from_id      TEXT NOT NULL,
      from_name    TEXT,
      to_id        TEXT,
      text         TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at      INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_to_delivered ON messages(to_id, delivered_at);

    CREATE TABLE IF NOT EXISTS activity (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   TEXT,
      client_name TEXT,
      ip          TEXT,
      kind        TEXT NOT NULL,
      path        TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);
  `);

  ensureNotesColumns(db);
}

module.exports = { db, initDb, ensureNotesColumns };
