#!/usr/bin/env node
/**
 * Set a new password for an account from the command line, for when nobody who
 * can sign in remembers theirs. Also signs that account out everywhere.
 *
 *   docker compose exec web node scripts/reset-password.mjs <username> '<new password>'
 *
 * Add --admin to make the account an admin as well.
 */
import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--admin");
const makeAdmin = process.argv.includes("--admin");
const [username, password] = args;
if (!username || !password) {
  console.error("Usage: node scripts/reset-password.mjs <username> '<new password>' [--admin]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("The password needs at least 8 characters.");
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "liftlog.db");
const db = new Database(DB_PATH);
const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username);
if (!user) {
  const names = db.prepare("SELECT username FROM users ORDER BY created_at").all().map((u) => u.username);
  console.error(`No account called "${username}". Accounts: ${names.join(", ") || "none"}`);
  process.exit(1);
}

// Same format as lib/server/auth.ts
const N = 2 ** 15, r = 8, p = 1;
const salt = randomBytes(16);
const key = scryptSync(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
const hash = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;

db.transaction(() => {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
  if (makeAdmin) db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(user.id);
  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(user.id);
})();

console.log(`New password set for ${user.username}${makeAdmin ? ", now an admin" : ""}. They've been signed out everywhere.`);
