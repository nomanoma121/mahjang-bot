/** 麻雀の順位計算・入力バリデーション */

export const PLAYER_COUNT = 4;
export const TOTAL_SCORE = 100_000;

/** 点数から順位を決める。同点の場合は起家に近い席を上位とする */
export function rankPlayers(scores: readonly number[]): number[] {
  const order = scores
    .map((score, seat) => ({ score, seat }))
    .sort((a, b) => b.score - a.score || a.seat - b.seat);

  const ranks = new Array<number>(scores.length).fill(0);
  order.forEach((entry, index) => {
    ranks[entry.seat] = index + 1;
  });
  return ranks;
}

/** 4人分の点数を検証し、問題があればエラーメッセージを返す */
export function validateScores(scores: readonly number[]): string | null {
  if (scores.length !== PLAYER_COUNT) {
    return `プレイヤーは${PLAYER_COUNT}人分入力してください`;
  }

  const total = scores.reduce((sum, score) => sum + score, 0);
  if (total !== TOTAL_SCORE) {
    return `点数の合計が ${total.toLocaleString("ja-JP")}点 です。4人合計を ${TOTAL_SCORE.toLocaleString("ja-JP")}点 にしてください。`;
  }

  return null;
}

const SEAT_NAMES = ["起家", "南家", "西家", "北家"] as const;

export function seatName(seat: number): string {
  return SEAT_NAMES[seat] ?? `${seat + 1}席`;
}
