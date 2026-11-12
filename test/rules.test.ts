import { describe, expect, test } from "bun:test";
import { rankPlayers, seatName, validateScores } from "../src/lib/rules";

describe("rankPlayers", () => {
  test("点数の降順で順位を返す", () => {
    expect(rankPlayers([45_000, 30_000, 25_000, 0])).toEqual([1, 2, 3, 4]);
    expect(rankPlayers([10_000, 40_000, 30_000, 20_000])).toEqual([4, 1, 2, 3]);
  });

  test("同点は起家に近い席を上位にする", () => {
    expect(rankPlayers([30_000, 30_000, 20_000, 20_000])).toEqual([1, 2, 3, 4]);
    expect(rankPlayers([20_000, 20_000, 30_000, 30_000])).toEqual([3, 4, 1, 2]);
  });
});

describe("validateScores", () => {
  test("合計が100,000点なら通る", () => {
    expect(validateScores([45_000, 30_000, 25_000, 0])).toBeNull();
    expect(validateScores([25_000, 25_000, 25_000, 25_000])).toBeNull();
    expect(validateScores([-1_000, 51_000, 25_000, 25_000])).toBeNull();
  });

  test("合計が100,000点でなければエラー", () => {
    expect(validateScores([45_000, 30_000, 25_000, -1])).not.toBeNull();
    expect(validateScores([25_000, 25_000, 25_000, 25_000, 0])).not.toBeNull();
  });
});

describe("seatName", () => {
  test("席名を返す", () => {
    expect(seatName(0)).toBe("起家");
    expect(seatName(1)).toBe("南家");
    expect(seatName(2)).toBe("西家");
    expect(seatName(3)).toBe("北家");
    expect(seatName(4)).toBe("5席");
  });
});
