const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO日時を日本時間の「YYYY/MM/DD HH:mm」で表示する */
export function formatDateTime(iso: string): string {
  const date = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

export function formatScore(score: number): string {
  return score.toLocaleString("ja-JP");
}

/** 合計スコアなど符号を出したい数値 */
export function formatSignedScore(score: number): string {
  const rounded = Math.round(score);
  if (rounded > 0) return `+${rounded.toLocaleString("ja-JP")}`;
  if (rounded < 0) return `${rounded.toLocaleString("ja-JP")}`;
  return "0";
}

export function formatAverageScore(score: number): string {
  return Math.round(score).toLocaleString("ja-JP");
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function percentBar(value: number, width = 10): string {
  const ratio = Math.max(0, Math.min(1, value));
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export function rankEmoji(rank: number): string {
  return MEDALS[rank - 1] ?? `${rank}位`;
}
