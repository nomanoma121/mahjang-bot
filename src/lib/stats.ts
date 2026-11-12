export type Period = "all" | "month" | "recent50" | "recent100";

export const PERIOD_LABELS: Record<Period, string> = {
  all: "全期間",
  month: "今月",
  recent50: "直近50半荘",
  recent100: "直近100半荘",
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間の今月1日 00:00 を UTC の ISO 文字列で返す */
export function jstMonthStartIso(now = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const startUtc = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1);
  return new Date(startUtc - JST_OFFSET_MS).toISOString();
}

export interface PeriodQuery {
  startIso: string | null;
  limit: number | null;
  label: string;
}

export function resolvePeriod(period: Period): PeriodQuery {
  switch (period) {
    case "month":
      return { startIso: jstMonthStartIso(), limit: null, label: PERIOD_LABELS.month };
    case "recent50":
      return { startIso: null, limit: 50, label: PERIOD_LABELS.recent50 };
    case "recent100":
      return { startIso: null, limit: 100, label: PERIOD_LABELS.recent100 };
    default:
      return { startIso: null, limit: null, label: PERIOD_LABELS.all };
  }
}

export interface StatsSourceRow {
  rank: number;
  score: number;
}

export interface AggregateStats {
  games: number;
  avgRank: number;
  totalScore: number;
  avgScore: number;
  rankCounts: readonly [number, number, number, number];
}

export function aggregateStats(rows: readonly StatsSourceRow[]): AggregateStats {
  const rankCounts: [number, number, number, number] = [0, 0, 0, 0];
  let totalScore = 0;

  for (const row of rows) {
    if (row.rank >= 1 && row.rank <= 4) {
      rankCounts[row.rank - 1] = (rankCounts[row.rank - 1] ?? 0) + 1;
    }
    totalScore += row.score;
  }

  const games = rows.length;
  return {
    games,
    avgRank: games > 0 ? rows.reduce((sum, row) => sum + row.rank, 0) / games : 0,
    totalScore,
    avgScore: games > 0 ? totalScore / games : 0,
    rankCounts,
  };
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
