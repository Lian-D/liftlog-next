import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/** Where the database lives. In Docker this is /data/liftlog.db on a named volume. */
export const DB_PATH = process.env.DB_PATH?.trim() || path.join(process.cwd(), "data", "liftlog.db");

const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    items TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE custom_exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    equipment TEXT NOT NULL DEFAULT '',
    primary_muscles TEXT NOT NULL,
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    measure TEXT NOT NULL DEFAULT 'weight',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    routine_id TEXT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    exercise_order TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX sessions_date ON sessions(date);

  CREATE TABLE sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    reps INTEGER,
    weight_kg REAL,
    done INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX sets_session ON sets(session_id);
  CREATE INDEX sets_exercise ON sets(exercise_id);
  `,
  // 2: accounts. Rows from before accounts existed have user_id NULL until the first account claims them.
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX auth_sessions_user ON auth_sessions(user_id);

  CREATE TABLE user_settings (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  ALTER TABLE routines ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE custom_exercises ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  CREATE INDEX routines_user ON routines(user_id);
  CREATE INDEX sessions_user ON sessions(user_id, started_at);
  CREATE INDEX custom_exercises_user ON custom_exercises(user_id);
  `,
  // 3: a note on each set ("felt easy", "left elbow")
  `
  ALTER TABLE sets ADD COLUMN note TEXT;
  `,
  // 4: rest between sets per routine and per workout (NULL = use the account default),
  // plus per-exercise overrides for a workout as {exerciseId: seconds}. Routine items carry theirs in the items JSON.
  `
  ALTER TABLE routines ADD COLUMN rest_sec INTEGER;
  ALTER TABLE sessions ADD COLUMN rest_sec INTEGER;
  ALTER TABLE sessions ADD COLUMN exercise_rest TEXT NOT NULL DEFAULT '{}';
  `,
  // 5: lock-screen alerts. One row per browser that turned them on, and at most one
  // pending timer alarm per browser.
  `
  CREATE TABLE push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);

  -- end_at 0 means no alarm. seq is the page's own counter, so updates that arrive
  -- out of order (common as a phone locks) can't undo newer ones.
  CREATE TABLE timer_alarms (
    endpoint TEXT PRIMARY KEY REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE,
    end_at INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    hidden INTEGER NOT NULL DEFAULT 0,
    seq INTEGER NOT NULL DEFAULT 0
  );
  `,
  // 6: setup notes and machine choice per exercise, machine sticker presets, bodyweight
  // per day, sports, workouts logged afterwards, and extra numbers on a set (machine
  // stickers, cardio distance/level/etc.) as JSON.
  `
  ALTER TABLE sets ADD COLUMN extra TEXT;
  ALTER TABLE sessions ADD COLUMN past_min INTEGER;

  CREATE TABLE exercise_prefs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    machine_id TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, exercise_id)
  );

  CREATE TABLE machines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    real_kg REAL NOT NULL,
    sticker REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX machines_user ON machines(user_id);

  CREATE TABLE body_weights (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    kg REAL,
    note TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport TEXT NOT NULL,
    date TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    distance_km REAL,
    data TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX activities_user ON activities(user_id, started_at);
  `,
];

function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

const g = globalThis as unknown as { __liftlogDb?: Database.Database };

/** One shared connection per server process (survives dev hot reloads). */
export function db(): Database.Database {
  if (g.__liftlogDb) return g.__liftlogDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("synchronous = NORMAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  migrate(conn);
  g.__liftlogDb = conn;
  return conn;
}
