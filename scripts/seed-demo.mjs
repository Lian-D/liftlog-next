#!/usr/bin/env node
/**
 * Fills a database with three months of made-up Push / Pull / Legs workouts so you
 * can see the charts before you have real history.
 *
 *   DB_PATH=./data/demo.db npm run seed:demo
 *   DB_PATH=./data/demo.db npm run dev
 *
 * It refuses to touch a database that already has workouts in it.
 */
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "demo.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// Same schema as lib/server/db.ts (migration 1)
const version = db.pragma("user_version", { simple: true });
if (version === 0) {
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE routines (id TEXT PRIMARY KEY, name TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE custom_exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, equipment TEXT NOT NULL DEFAULT '', primary_muscles TEXT NOT NULL, secondary_muscles TEXT NOT NULL DEFAULT '[]', measure TEXT NOT NULL DEFAULT 'weight', created_at INTEGER NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, routine_id TEXT, name TEXT NOT NULL, date TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, notes TEXT NOT NULL DEFAULT '', exercise_order TEXT NOT NULL DEFAULT '[]');
    CREATE INDEX sessions_date ON sessions(date);
    CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, set_index INTEGER NOT NULL, reps INTEGER, weight_kg REAL, done INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX sets_session ON sets(session_id);
    CREATE INDEX sets_exercise ON sets(exercise_id);
    PRAGMA user_version = 1;
  `);
}
if (db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n > 0) {
  console.error(`${DB_PATH} already has workouts. Point DB_PATH at a new file.`);
  process.exit(1);
}

const LB = 0.45359237;
// [exercise, sets, reps, start lb, end lb, plate step lb]
const PLAN = {
  Push: [
    ["bench-press", 3, 8, 135, 170, 5],
    ["incline-dumbbell-press", 3, 10, 45, 57.5, 2.5],
    ["seated-overhead-press", 3, 8, 85, 105, 5],
    ["lateral-raise", 3, 12, 15, 20, 2.5],
    ["rope-pushdown", 3, 12, 40, 55, 5],
  ],
  Pull: [
    ["barbell-row", 3, 8, 115, 150, 5],
    ["lat-pulldown", 3, 10, 120, 150, 5],
    ["seated-cable-row", 3, 10, 110, 140, 5],
    ["reverse-fly", 3, 12, 15, 20, 2.5],
    ["barbell-curl", 3, 10, 55, 70, 5],
  ],
  Legs: [
    ["back-squat", 3, 5, 185, 245, 5],
    ["romanian-deadlift", 3, 8, 155, 200, 5],
    ["leg-press", 3, 10, 270, 360, 10],
    ["lying-leg-curl", 3, 12, 80, 100, 5],
    ["standing-calf-raise", 3, 12, 140, 180, 10],
  ],
};

// With accounts (schema 2+), give the sample data to the first admin if one exists;
// otherwise it stays unclaimed and goes to whoever creates the first account.
const hasUsers = db.pragma("user_version", { simple: true }) >= 2;
const owner = hasUsers ? db.prepare("SELECT id FROM users WHERE is_admin = 1 ORDER BY created_at LIMIT 1").get()?.id ?? null : null;

// Newer databases also have set notes (schema 3+) and rest times (schema 4+)
const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
const hasNotes = cols("sets").includes("note");
const hasRest = cols("routines").includes("rest_sec");
const REST = { Push: 120, Pull: 120, Legs: 180 };
const NOTES = ["Felt easy", "Grip slipping", "Last rep was a grind", "Paused at the bottom", "Left elbow a bit sore", "Belt on", "Slow on the way down"];

const now = Date.now();
const routineIds = {};
let pos = 0;
for (const [name, items] of Object.entries(PLAN)) {
  const id = randomUUID();
  routineIds[name] = id;
  db.prepare("INSERT INTO routines (id, name, items, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id, name, JSON.stringify(items.map(([exerciseId, sets, reps]) => ({ exerciseId, sets, reps }))), pos++, now, now
  );
  if (owner) db.prepare("UPDATE routines SET user_id = ? WHERE id = ?").run(owner, id);
  if (hasRest) db.prepare("UPDATE routines SET rest_sec = ? WHERE id = ?").run(REST[name] ?? null, id);
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
const today = dayFmt.format(new Date());
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const WEEKS = 14;
const start = addDays(today, -WEEKS * 7);
const insS = db.prepare("INSERT INTO sessions (id, routine_id, name, date, started_at, finished_at, exercise_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insX = hasNotes
  ? db.prepare("INSERT INTO sets (session_id, exercise_id, set_index, reps, weight_kg, done, note) VALUES (?, ?, ?, ?, ?, 1, ?)")
  : db.prepare("INSERT INTO sets (session_id, exercise_id, set_index, reps, weight_kg, done) VALUES (?, ?, ?, ?, ?, 1)");

let count = 0;
db.transaction(() => {
  for (let d = 0; d < WEEKS * 7; d++) {
    const date = addDays(start, d);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 1 Mon, 3 Wed, 5 Fri
    const name = dow === 1 ? "Push" : dow === 3 ? "Pull" : dow === 5 ? "Legs" : null;
    if (!name || date >= today || rand() < 0.08) continue; // the odd missed day
    const progress = d / (WEEKS * 7);
    const deload = Math.floor(d / 7) === 9; // one lighter week
    const id = randomUUID();
    const startedAt = Date.parse(`${date}T18:05:00-07:00`) + Math.floor(rand() * 40) * 60000;
    insS.run(id, routineIds[name], name, date, startedAt, startedAt + (55 + Math.floor(rand() * 20)) * 60000, JSON.stringify(PLAN[name].map((p) => p[0])));
    if (hasRest) db.prepare("UPDATE sessions SET rest_sec = ? WHERE id = ?").run(REST[name] ?? null, id);
    if (owner) db.prepare("UPDATE sessions SET user_id = ? WHERE id = ?").run(owner, id);
    for (const [ex, sets, reps, lo, hi, step] of PLAN[name]) {
      let lb = lo + (hi - lo) * progress + (rand() - 0.5) * step * 1.2;
      if (deload) lb *= 0.88;
      lb = Math.max(step, Math.round(lb / step) * step);
      for (let i = 0; i < sets; i++) {
        const r = i === sets - 1 && rand() < 0.35 ? reps - 1 : reps;
        const args = [id, ex, i, r, lb * LB];
        if (hasNotes) args.push(rand() < 0.07 ? NOTES[Math.floor(rand() * NOTES.length)] : null);
        insX.run(...args);
      }
    }
    count++;
  }
})();

// Schema 6+: sports, bodyweight, a machine with stickers, setup notes and some treadmill warm-ups
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
let extras = "";
if (tables.has("activities") && owner) {
  const insA = db.prepare(
    "INSERT INTO activities (id, user_id, sport, date, started_at, duration_sec, distance_km, data, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)"
  );
  const insB = db.prepare("INSERT OR IGNORE INTO body_weights (user_id, date, kg, note, updated_at) VALUES (?, ?, ?, ?, ?)");
  let acts = 0;
  let bws = 0;
  db.transaction(() => {
    for (let d = 0; d < WEEKS * 7; d++) {
      const date = addDays(start, d);
      if (date >= today) continue;
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      const progress = d / (WEEKS * 7);
      const at = (h, m) => Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-07:00`);
      // Bodyweight most mornings, drifting down 6 lb over the period
      if (rand() < 0.6) {
        const lb = 182 - 6 * progress + (rand() - 0.5) * 2.4;
        insB.run(owner, date, Math.round(lb * LB * 1000) / 1000, rand() < 0.1 ? "After breakfast" : "", now);
        bws++;
      }
      // Badminton Tuesdays, runs on Thursdays and Sundays, a hike or golf some Saturdays
      if (dow === 2 && rand() < 0.85) {
        const games = 6 + Math.floor(rand() * 6);
        const won = Math.min(games, Math.floor(games * (0.35 + 0.3 * progress + rand() * 0.2)));
        insA.run(randomUUID(), owner, "badminton", date, at(19, 30), (80 + Math.floor(rand() * 30)) * 60, null,
          JSON.stringify({ format: rand() < 0.7 ? "doubles" : "singles", games, won, effort: 6 + Math.floor(rand() * 3), place: "Community centre" }), now);
        acts++;
      }
      if ((dow === 4 || dow === 0) && rand() < 0.7) {
        const km = dow === 0 ? 8 + rand() * 4 : 4 + rand() * 2;
        const pace = 360 - 40 * progress + (rand() - 0.5) * 20; // seconds per km
        insA.run(randomUUID(), owner, "running", date, at(7, 10), Math.round(km * pace), Math.round(km * 100) / 100,
          JSON.stringify({ type: dow === 0 ? "long" : "easy", elev: Math.round(20 + rand() * 60), hr: 145 + Math.floor(rand() * 15), effort: dow === 0 ? 6 : 4, place: "Seawall loop" }), now);
        acts++;
      }
      if (dow === 6 && rand() < 0.35) {
        if (rand() < 0.5) {
          insA.run(randomUUID(), owner, "hiking", date, at(9, 0), (150 + Math.floor(rand() * 90)) * 60, Math.round((8 + rand() * 6) * 10) / 10,
            JSON.stringify({ elev: 600 + Math.floor(rand() * 500), effort: 7, place: rand() < 0.5 ? "Grouse Grind" : "Lynn Peak" }), now);
        } else {
          const score = 96 - Math.round(8 * progress) + Math.floor(rand() * 8);
          insA.run(randomUUID(), owner, "golf", date, at(8, 30), (240 + Math.floor(rand() * 30)) * 60, null,
            JSON.stringify({ holes: "18", score, par: 72, putts: 34 + Math.floor(rand() * 6), fairways: 5 + Math.floor(rand() * 5), fairwaysOf: 14, gir: 3 + Math.floor(rand() * 4), mode: "walked", place: "Fraserview" }), now);
        }
        acts++;
      }
    }
    // A lat pulldown whose stack reads low: sticker 140 really holds 175 lb
    const mid = randomUUID();
    db.prepare("INSERT INTO machines (id, user_id, name, real_kg, sticker, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(mid, owner, "Lat pulldown (gym)", 175 * LB, 140, now);
    const pref = db.prepare("INSERT OR REPLACE INTO exercise_prefs (user_id, exercise_id, note, machine_id, updated_at) VALUES (?, ?, ?, ?, ?)");
    pref.run(owner, "lat-pulldown", "Thigh pad on 4", mid, now);
    pref.run(owner, "back-squat", "Rack on 7, safety pins on 4", null, now);
    pref.run(owner, "bench-press", "J-hooks on 9, feet flat", null, now);
  })();
  extras = `, ${acts} sports sessions, ${bws} weigh-ins`;
}
console.log(`Added 3 routines, ${count} workouts${extras} to ${DB_PATH}${owner ? " for the first admin" : "; the first account you create gets them"}`);
