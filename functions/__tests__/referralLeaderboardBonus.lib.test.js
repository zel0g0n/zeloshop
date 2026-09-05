const { computeIsoWeekKey, pickTopReferrers, generateLeaderboardBonusCouponCode, RANK_BONUS_PERCENTS } = require("../lib/referralLeaderboardBonus");

describe("computeIsoWeekKey", () => {
  test("oddiy hafta ichidagi sanani to'g'ri hisoblaydi", () => {
    // 2026-yil 2-sentyabr, chorshanba - ISO hafta 36
    const nowMs = new Date("2026-09-02T10:00:00Z").getTime();
    expect(computeIsoWeekKey(nowMs)).toBe("2026-W36");
  });

  test("dushanba va yakshanba BIR XIL haftaga tegishli", () => {
    const monday = new Date("2026-08-31T00:00:00Z").getTime();
    const sunday = new Date("2026-09-06T23:00:00Z").getTime();
    expect(computeIsoWeekKey(monday)).toBe(computeIsoWeekKey(sunday));
  });

  test("yil chegarasidagi hafta to'g'ri hisoblanadi (2025-yil oxiri ISO bo'yicha 2026-yilning 1-haftasiga tegishli bo'lishi mumkin)", () => {
    // 2025-yil 29-dekabr, dushanba - ISO bo'yicha 2026-W01
    const nowMs = new Date("2025-12-29T00:00:00Z").getTime();
    expect(computeIsoWeekKey(nowMs)).toBe("2026-W01");
  });
});

describe("pickTopReferrers", () => {
  test("bo'sh yoki noto'g'ri kirishda - bo'sh massiv", () => {
    expect(pickTopReferrers(null)).toEqual([]);
    expect(pickTopReferrers({})).toEqual([]);
    expect(pickTopReferrers(undefined)).toEqual([]);
  });

  test("count bo'yicha kamayish tartibida TOP 3 ni tanlaydi, rank/bonusPercent bilan", () => {
    const counts = { A: 5, B: 8, C: 1, D: 3 };
    const result = pickTopReferrers(counts);
    expect(result).toEqual([
      { referrerId: "B", count: 8, rank: 1, bonusPercent: RANK_BONUS_PERCENTS[1] },
      { referrerId: "A", count: 5, rank: 2, bonusPercent: RANK_BONUS_PERCENTS[2] },
      { referrerId: "D", count: 3, rank: 3, bonusPercent: RANK_BONUS_PERCENTS[3] },
    ]);
  });

  test("3 tadan kam ishtirokchi bo'lsa - faqat mavjudlarini qaytaradi", () => {
    const result = pickTopReferrers({ A: 2 });
    expect(result).toEqual([{ referrerId: "A", count: 2, rank: 1, bonusPercent: RANK_BONUS_PERCENTS[1] }]);
  });

  test("count=0 bo'lgan yozuvlarni chiqarib tashlaydi", () => {
    const result = pickTopReferrers({ A: 0, B: 5 });
    expect(result).toEqual([{ referrerId: "B", count: 5, rank: 1, bonusPercent: RANK_BONUS_PERCENTS[1] }]);
  });
});

describe("generateLeaderboardBonusCouponCode", () => {
  test("'TOPREF-' prefiksi bilan boshlanadigan kod yaratadi", () => {
    expect(generateLeaderboardBonusCouponCode()).toMatch(/^TOPREF-[A-Z0-9]{6}$/);
  });
});
