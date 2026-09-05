/**
 * `clientReferrals.js` (`getReferralLeaderboard`) uchun testlar -
 * mijozlarning "do'st taklif qilish" reytingi.
 *
 * TARIX (#114): AVVAL bu funksiya `referrals` quyi kolleksiyasini
 * `limit(500)`gacha o'qib, xotirada hisoblardi (`REFERRAL_SCAN_LIMIT`
 * testlari shu yerda edi). ENDI esa `orders.js` tomonidan doim
 * yangilanib turadigan TAYYOR `referralCounts` hisoblagich
 * kolleksiyasidan `orderBy`/`limit`/`.count()` AGREGATSIYA so'rovlari
 * bilan o'qiydi - shuning uchun testlar ham o'sha yangi so'rov
 * shaklini taqlid qiladi. Haqiqiy Firestore'ga ULANMAYDI.
 */

function makeCountsCollectionRef(counts) {
  return {
    orderBy: (field, dir) => ({
      limit: (n) => ({
        get: async () => {
          const sorted = Object.entries(counts)
            .sort((a, b) => (dir === "desc" ? b[1] - a[1] : a[1] - b[1]))
            .slice(0, n);
          return {
            forEach: (cb) => sorted.forEach(([id, count]) => cb({ id, data: () => ({ count }) })),
          };
        },
      }),
    }),
    doc: (id) => ({
      get: async () => {
        const count = counts[id];
        return count != null ? { exists: true, id, data: () => ({ count }) } : { exists: false, id };
      },
    }),
    where: (field, op, value) => {
      if (field !== "count" || op !== ">") throw new Error(`Kutilmagan where: ${field} ${op}`);
      return {
        count: () => ({
          get: async () => {
            const n = Object.values(counts).filter((c) => c > value).length;
            return { data: () => ({ count: n }) };
          },
        }),
      };
    },
  };
}

function buildMockDb(counts = {}) {
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: () => ({
          collection: (sub) => {
            if (sub !== "referralCounts") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
            return makeCountsCollectionRef(counts);
          },
        }),
      };
    },
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => undefined) }));
  return require("../clientReferrals");
}

describe("handleGetReferralLeaderboard", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb({}));
    await expect(
      _testables.handleGetReferralLeaderboard({ auth: null, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("sellerId berilmasa rad etadi", async () => {
    const { _testables } = loadModule(buildMockDb({}));
    await expect(
      _testables.handleGetReferralLeaderboard({ auth: { uid: "c1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("hisoblagich yozuvi umuman yo'q bo'lsa - bo'sh reyting, `myRank: null` qaytaradi", async () => {
    const { _testables } = loadModule(buildMockDb({}));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "c1" }, data: { sellerId: "s1" } });
    expect(result).toEqual({ leaderboard: [], myRank: null, myCount: 0 });
  });

  test("referrerId bo'yicha TO'G'RI hisoblab, KO'PDAN-KAMGA saralaydi", async () => {
    const counts = { A: 3, B: 2, C: 1 };
    const { _testables } = loadModule(buildMockDb(counts));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "someone-else" }, data: { sellerId: "s1" } });

    expect(result.leaderboard).toEqual([
      { rank: 1, count: 3, isYou: false },
      { rank: 2, count: 2, isYou: false },
      { rank: 3, count: 1, isYou: false },
    ]);
  });

  test("so'rovchi TOP ro'yxatda bo'lsa - `isYou: true` belgilanadi (ism/ID ko'rsatilmaydi)", async () => {
    const counts = { me: 2, other: 1 };
    const { _testables } = loadModule(buildMockDb(counts));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "me" }, data: { sellerId: "s1" } });

    expect(result.leaderboard[0]).toEqual({ rank: 1, count: 2, isYou: true });
    expect(result.myRank).toBe(1);
    expect(result.myCount).toBe(2);
    // MAXFIYLIK: hech qanday entryda referrerId/ism/telefon YO'Q.
    result.leaderboard.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual(["count", "isYou", "rank"]);
    });
  });

  test("so'rovchi TOP 10dan tashqarida bo'lsa ham, `.count()` agregatsiyasi orqali o'z o'rnini/sonini to'g'ri biladi", async () => {
    // 10 ta har xil referrer, HAR BIRI "me"dan KO'PROQ (2 dan 11 tagacha,
    // teng qiymat YO'Q - noaniqlikning oldini olish uchun), "me" esa
    // ulardan ANIQ KAMROQ (1 ta) - shuning uchun har doim 11-o'rinda.
    const counts = {};
    for (let i = 0; i < 10; i++) counts[`user-${i}`] = i + 2; // 2, 3, ..., 11
    counts.me = 1; // hammadan kam
    const { _testables } = loadModule(buildMockDb(counts));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "me" }, data: { sellerId: "s1" } });

    expect(result.leaderboard).toHaveLength(10);
    expect(result.leaderboard.some((e) => e.isYou)).toBe(false); // TOP 10da yo'q
    expect(result.myCount).toBe(1);
    expect(result.myRank).toBe(11);
  });

  test("hali birorta ham muvaffaqiyatli taklifi yo'q mijoz uchun - `myRank: null` (0-o'rin ko'rsatilmaydi)", async () => {
    const counts = { A: 5, B: 2 };
    const { _testables } = loadModule(buildMockDb(counts));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "me" }, data: { sellerId: "s1" } });
    expect(result.myRank).toBeNull();
    expect(result.myCount).toBe(0);
  });

  test("do'konda MINGLAB hisoblagich yozuvi bo'lsa ham, o'rinni bilish uchun TO'LIQ jadval o'qilmaydi (faqat `.count()` agregatsiyasi)", async () => {
    const counts = {};
    for (let i = 0; i < 5000; i++) counts[`user-${i}`] = 5000 - i; // eng kattasi user-0=5000
    counts.me = 3; // deyarli hammadan kam - lekin ANIQ 4997-o'rin
    const { _testables } = loadModule(buildMockDb(counts));
    const result = await _testables.handleGetReferralLeaderboard({ auth: { uid: "me" }, data: { sellerId: "s1" } });

    expect(result.myCount).toBe(3);
    // 3 dan katta bo'lganlar soni = 4997 ta (user-0..user-4996), demak o'rin 4998.
    expect(result.myRank).toBe(4998);
    expect(result.leaderboard).toHaveLength(10); // faqat TOP-10 qaytariladi, minglab emas
  });
});
