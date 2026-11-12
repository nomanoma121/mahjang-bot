import { describe, expect, test } from "bun:test";
import {
  aggregateStats,
  jstMonthStartIso,
  rate,
  resolvePeriod,
} from "../src/lib/stats";

describe("aggregateStats", () => {
  test("対戦数・平均順位・スコア・順位率を集計する", () => {
    const stats = aggregateStats([
      { rank: 1, score: 45_000 },
      { rank: 2, score: 30_000 },
      { rank: 4, score: 10_000 },
      { rank: 1, score: 40_000 },
    ]);

    expect(stats.games).toBe(4);
    expect(stats.avgRank).toBe(2);
    expect(stats.totalScore).toBe(125_000);
    expect(stats.avgScore).toBe(31_250);
    expect(stats.rankCounts).toEqual([2, 1, 0, 1]);
  });

  test("0件でも安全に集計できる", () => {
    const stats = aggregateStats([]);
    expect(stats.games).toBe(0);
    expect(stats.avgRank).toBe(0);
    expect(stats.totalScore).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.rankCounts).toEqual([0, 0, 0, 0]);
  });
});

describe("jstMonthStartIso", () => {
  test("日本時間の月初をUTCで返す", () => {
    expect(jstMonthStartIso(new Date("2026-11-12T13:15:00.000Z"))).toBe(
      "2026-10-31T15:00:00.000Z",
    );
    expect(jstMonthStartIso(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2025-12-31T15:00:00.000Z",
    );
  });
});

describe("resolvePeriod", () => {
  test("期間ごとのラベルとクエリを返す", () => {
    expect(resolvePeriod("all")).toEqual({ startIso: null, limit: null, label: "全期間" });
    expect(resolvePeriod("recent50")).toEqual({
      startIso: null,
      limit: 50,
      label: "直近50半荘",
    });
    expect(resolvePeriod("recent100")).toEqual({
      startIso: null,
      limit: 100,
      label: "直近100半荘",
    });
    expect(resolvePeriod("month").limit).toBeNull();
    expect(resolvePeriod("month").label).toBe("今月");
  });
});

describe("rate", () => {
  test("分母が0ならnull", () => {
    expect(rate(1, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
  });
});
