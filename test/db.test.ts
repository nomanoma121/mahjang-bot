process.env.DB_PATH = ":memory:";

const { db, migrate } = await import("../src/db");
const {
  deleteGame,
  getGame,
  getPlayerHistory,
  getPlayerStats,
  getRanking,
  recordGame,
} = await import("../src/db/games");

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const guildId = "guild-1";
const names = ["Alice", "Bob", "Carol", "Dave"];

type RecordResult = Awaited<ReturnType<typeof recordGame>>;
let firstGame: RecordResult;
let secondGame: RecordResult;

function record(
  playedAt: string,
  scores: [number, number, number, number],
  reporterId = "u1",
): RecordResult {
  return recordGame({
    guildId,
    channelId: "channel-1",
    reporterId,
    playedAt,
    players: scores.map((score, index) => ({
      userId: `u${index + 1}`,
      displayName: names[index] ?? `User${index + 1}`,
      score,
    })),
  });
}

beforeAll(() => {
  migrate();
  firstGame = record("2026-11-12T10:00:00.000Z", [45_000, 30_000, 20_000, 5_000]);
  secondGame = record("2026-11-12T11:00:00.000Z", [10_000, 40_000, 30_000, 20_000]);
});

afterAll(() => {
  db.close();
});

describe("recordGame", () => {
  test("半荘を記録して順位を返す", () => {
    expect(firstGame.gameId).toBe(1);
    expect(firstGame.players.map((player) => player.rank)).toEqual([1, 2, 3, 4]);
    expect(firstGame.players.map((player) => player.seat)).toEqual([0, 1, 2, 3]);
  });

  test("2件目以降も連番で記録される", () => {
    expect(secondGame.gameId).toBe(2);
    expect(secondGame.players.map((player) => player.rank)).toEqual([4, 1, 2, 3]);
  });
});

describe("getPlayerStats", () => {
  test("対戦成績を集計する", () => {
    const stats = getPlayerStats(guildId, "u1", "all");

    expect(stats.displayName).toBe("Alice");
    expect(stats.games).toBe(2);
    expect(stats.totalScore).toBe(55_000);
    expect(stats.avgScore).toBe(27_500);
    expect(stats.avgRank).toBe(2.5);
    expect(stats.rankCounts).toEqual([1, 0, 0, 1]);
  });
});

describe("getRanking", () => {
  test("平均順位でランキング対象を返す", () => {
    const ranking = getRanking(guildId, "all", 1);

    expect(ranking).toHaveLength(4);
    expect(ranking.find((entry) => entry.userId === "u1")?.avgRank).toBe(2.5);
    expect(ranking.find((entry) => entry.userId === "u2")?.avgRank).toBe(1.5);
  });

  test("最低対戦数で絞り込める", () => {
    expect(getRanking(guildId, "all", 3)).toHaveLength(0);
  });
});

describe("getPlayerHistory", () => {
  test("新しい順に対戦履歴と対戦相手を返す", () => {
    const history = getPlayerHistory(guildId, "u1", 10);

    expect(history).toHaveLength(2);
    expect(history[0]?.gameId).toBe(2);
    expect(history[0]?.opponents).toHaveLength(3);
    expect(history[0]?.opponents.map((opponent) => opponent.displayName)).toEqual([
      "Bob",
      "Carol",
      "Dave",
    ]);
  });
});

describe("deleteGame", () => {
  test("ゲームを削除すると集計からも消える", () => {
    const deleted = deleteGame(guildId, 2);

    expect(deleted?.id).toBe(2);
    expect(getGame(guildId, 2)).toBeNull();
    expect(getPlayerStats(guildId, "u1", "all").games).toBe(1);
    expect(getRanking(guildId, "all", 1)).toHaveLength(4);
  });

  test("存在しないゲームはnull", () => {
    expect(deleteGame(guildId, 999)).toBeNull();
  });
});
