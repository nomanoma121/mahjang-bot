import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = Bun.env.DB_PATH ?? "./data/mahjang.db";

if (dbPath !== ":memory:") {
  mkdirSync(dirname(resolve(dbPath)), { recursive: true });
}

export const db = new Database(dbPath, { create: true });

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE players (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    played_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE game_players (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    seat INTEGER NOT NULL,
    score INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    PRIMARY KEY (game_id, user_id)
  );

  CREATE INDEX idx_games_guild ON games(guild_id, played_at, id);
  CREATE INDEX idx_game_players_user ON game_players(user_id);
  `,
];

export function migrate(): void {
  const row = db.query<{ user_version: number }, []>("PRAGMA user_version").get();
  const currentVersion = row?.user_version ?? 0;

  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (!sql) continue;

    db.transaction(() => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}
