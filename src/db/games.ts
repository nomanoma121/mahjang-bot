import { db } from ".";
import { rankPlayers } from "../lib/rules";
import {
  aggregateStats,
  jstMonthStartIso,
  resolvePeriod,
  type AggregateStats,
  type Period,
} from "../lib/stats";

export interface PlayerInput {
  userId: string;
  displayName: string;
  score: number;
}

export interface RecordGameInput {
  guildId: string;
  channelId: string;
  reporterId: string;
  playedAt: string;
  players: readonly PlayerInput[];
}

export interface RecordedPlayer extends PlayerInput {
  seat: number;
  rank: number;
}

export interface RecordGameResult {
  gameId: number;
  players: RecordedPlayer[];
}

export function recordGame(input: RecordGameInput): RecordGameResult {
  const run = db.transaction((): RecordGameResult => {
    const now = new Date().toISOString();
    const ranks = rankPlayers(input.players.map((player) => player.score));

    const upsertPlayer = db.query(`
      INSERT INTO players (guild_id, user_id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `);
    for (const player of input.players) {
      upsertPlayer.run(input.guildId, player.userId, player.displayName, now, now);
    }

    const gameInfo = db
      .query(`
        INSERT INTO games (guild_id, channel_id, reporter_id, played_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(input.guildId, input.channelId, input.reporterId, input.playedAt, now);
    const gameId = Number(gameInfo.lastInsertRowid);

    const insertGamePlayer = db.query(`
      INSERT INTO game_players (game_id, user_id, seat, score, rank)
      VALUES (?, ?, ?, ?, ?)
    `);
    const players: RecordedPlayer[] = input.players.map((player, seat) => ({
      ...player,
      seat,
      rank: ranks[seat] ?? seat + 1,
    }));
    for (const player of players) {
      insertGamePlayer.run(gameId, player.userId, player.seat, player.score, player.rank);
    }

    return { gameId, players };
  });

  return run();
}

export interface GamePlayer {
  userId: string;
  displayName: string;
  seat: number;
  score: number;
  rank: number;
}

export interface GameDetails {
  id: number;
  guildId: string;
  channelId: string;
  reporterId: string;
  playedAt: string;
  players: GamePlayer[];
}

interface GameRow {
  game_id: number;
  user_id: string;
  display_name: string;
  seat: number;
  score: number;
  rank: number;
  guild_id: string;
  channel_id: string;
  reporter_id: string;
  played_at: string;
}

export function getGame(guildId: string, gameId: number): GameDetails | null {
  const rows = db
    .query<GameRow, [number, string]>(`
      SELECT
        gp.game_id,
        gp.user_id,
        COALESCE(p.display_name, '不明') AS display_name,
        gp.seat,
        gp.score,
        gp.rank,
        g.guild_id,
        g.channel_id,
        g.reporter_id,
        g.played_at
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      LEFT JOIN players p ON p.guild_id = g.guild_id AND p.user_id = gp.user_id
      WHERE gp.game_id = ? AND g.guild_id = ?
      ORDER BY gp.seat
    `)
    .all(gameId, guildId);

  const first = rows[0];
  if (!first) return null;

  return {
    id: first.game_id,
    guildId: first.guild_id,
    channelId: first.channel_id,
    reporterId: first.reporter_id,
    playedAt: first.played_at,
    players: rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      seat: row.seat,
      score: row.score,
      rank: row.rank,
    })),
  };
}

export function deleteGame(guildId: string, gameId: number): GameDetails | null {
  const run = db.transaction((): GameDetails | null => {
    const game = getGame(guildId, gameId);
    if (!game) return null;

    db.query("DELETE FROM games WHERE id = ? AND guild_id = ?").run(gameId, guildId);
    return game;
  });

  return run();
}

export interface PlayerStatsResult extends AggregateStats {
  userId: string;
  displayName: string | null;
}

export function getPlayerStats(guildId: string, userId: string, period: Period): PlayerStatsResult {
  const { startIso, limit } = resolvePeriod(period);

  const conditions = ["g.guild_id = ?", "gp.user_id = ?"];
  const params: (string | number)[] = [guildId, userId];
  if (startIso) {
    conditions.push("g.played_at >= ?");
    params.push(startIso);
  }

  let sql = `
    SELECT gp.rank, gp.score
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY g.played_at DESC, g.id DESC
  `;
  if (limit !== null) {
    sql += " LIMIT ?";
    params.push(limit);
  }

  const rows = db
    .query<{ rank: number; score: number }, (string | number)[]>(sql)
    .all(...params);

  const player = db
    .query<{ display_name: string }, [string, string]>(
      "SELECT display_name FROM players WHERE guild_id = ? AND user_id = ?",
    )
    .get(guildId, userId);

  return {
    userId,
    displayName: player?.display_name ?? null,
    ...aggregateStats(rows),
  };
}

export type RankingPeriod = "all" | "month";

export interface RankingEntry extends AggregateStats {
  userId: string;
  displayName: string;
}

interface RankingRow {
  user_id: string;
  display_name: string;
  games: number;
  avg_rank: number;
  total_score: number;
  avg_score: number;
  first_count: number;
  second_count: number;
  third_count: number;
  fourth_count: number;
}

export function getRanking(
  guildId: string,
  period: RankingPeriod,
  minGames: number,
): RankingEntry[] {
  const params: (string | number)[] = [guildId];
  let periodClause = "";
  if (period === "month") {
    periodClause = "AND g.played_at >= ?";
    params.push(jstMonthStartIso());
  }
  params.push(minGames);

  const rows = db
    .query<RankingRow, (string | number)[]>(`
      SELECT
        gp.user_id,
        p.display_name,
        COUNT(*) AS games,
        AVG(gp.rank) AS avg_rank,
        SUM(gp.score) AS total_score,
        AVG(gp.score) AS avg_score,
        SUM(CASE WHEN gp.rank = 1 THEN 1 ELSE 0 END) AS first_count,
        SUM(CASE WHEN gp.rank = 2 THEN 1 ELSE 0 END) AS second_count,
        SUM(CASE WHEN gp.rank = 3 THEN 1 ELSE 0 END) AS third_count,
        SUM(CASE WHEN gp.rank = 4 THEN 1 ELSE 0 END) AS fourth_count
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      JOIN players p ON p.guild_id = g.guild_id AND p.user_id = gp.user_id
      WHERE g.guild_id = ?
        ${periodClause}
      GROUP BY gp.user_id
      HAVING COUNT(*) >= ?
    `)
    .all(...params);

  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    games: row.games,
    avgRank: row.avg_rank,
    totalScore: row.total_score,
    avgScore: row.avg_score,
    rankCounts: [row.first_count, row.second_count, row.third_count, row.fourth_count],
  }));
}

export interface HistoryEntry {
  gameId: number;
  playedAt: string;
  rank: number;
  score: number;
  opponents: { userId: string; displayName: string; rank: number }[];
}

interface HistoryRow {
  game_id: number;
  played_at: string;
  rank: number;
  score: number;
}

interface OpponentRow {
  user_id: string;
  display_name: string;
  rank: number;
}

export function getPlayerHistory(
  guildId: string,
  userId: string,
  limit: number,
): HistoryEntry[] {
  const rows = db
    .query<HistoryRow, [string, string, number]>(`
      SELECT gp.game_id, g.played_at, gp.rank, gp.score
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE g.guild_id = ? AND gp.user_id = ?
      ORDER BY g.played_at DESC, g.id DESC
      LIMIT ?
    `)
    .all(guildId, userId, limit);

  const opponentStmt = db.query<OpponentRow, [number, string]>(`
    SELECT gp.user_id, COALESCE(p.display_name, '不明') AS display_name, gp.rank
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    LEFT JOIN players p ON p.guild_id = g.guild_id AND p.user_id = gp.user_id
    WHERE gp.game_id = ? AND gp.user_id != ?
    ORDER BY gp.seat
  `);

  return rows.map((row) => ({
    gameId: row.game_id,
    playedAt: row.played_at,
    rank: row.rank,
    score: row.score,
    opponents: opponentStmt.all(row.game_id, userId).map((opponent) => ({
      userId: opponent.user_id,
      displayName: opponent.display_name,
      rank: opponent.rank,
    })),
  }));
}
