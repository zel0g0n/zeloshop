function loadModule() {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
    db: {},
  }));
  return require("../nicheMigration");
}

describe("resolveNicheBackfill (15-niche migratsiya)", () => {
  test("category maydoni UMUMAN yo'q bo'lsa - standart 'Kosmetika'ga tuzatiladi", () => {
    const { _testables } = loadModule();
    expect(_testables.resolveNicheBackfill({})).toBe(_testables.DEFAULT_NICHE);
    expect(_testables.resolveNicheBackfill(undefined)).toBe(_testables.DEFAULT_NICHE);
  });

  test("category bo'sh satr bo'lsa - tuzatiladi", () => {
    const { _testables } = loadModule();
    expect(_testables.resolveNicheBackfill({ category: "" })).toBe(_testables.DEFAULT_NICHE);
  });

  test("category 15 ta niche'dan biri bo'lsa - HECH NARSA qilinmaydi (null)", () => {
    const { _testables } = loadModule();
    expect(_testables.resolveNicheBackfill({ category: "Kosmetika" })).toBeNull();
    expect(_testables.resolveNicheBackfill({ category: "Elektronika" })).toBeNull();
    expect(_testables.resolveNicheBackfill({ category: "Avto ehtiyot qismlari" })).toBeNull();
  });

  test("category xavfsiz zaxira 'Boshqa' bo'lsa - HECH NARSA qilinmaydi", () => {
    const { _testables } = loadModule();
    expect(_testables.resolveNicheBackfill({ category: "Boshqa" })).toBeNull();
  });

  test("category ENDI olib tashlangan eski qiymat bo'lsa (masalan 'Gullar') - standartga tuzatiladi", () => {
    const { _testables } = loadModule();
    expect(_testables.resolveNicheBackfill({ category: "Gullar" })).toBe(_testables.DEFAULT_NICHE);
    expect(_testables.resolveNicheBackfill({ category: "Intim tovarlar" })).toBe(_testables.DEFAULT_NICHE);
  });

  test("IDEMPOTENTLIK: bir marta tuzatilgandan keyin, qayta chaqirilsa endi HECH NARSA qilinmaydi", () => {
    const { _testables } = loadModule();
    const fixed = _testables.resolveNicheBackfill({ category: "noto'g'ri" });
    expect(fixed).toBe(_testables.DEFAULT_NICHE);
    expect(_testables.resolveNicheBackfill({ category: fixed })).toBeNull();
  });
});

describe("handleBackfillSellerNiches", () => {
  function buildMockDb({ isAdmin = true, sellers = [] } = {}) {
    const setCalls = [];
    const db = {
      collection: (name) => {
        if (name === "admins") {
          return { doc: () => ({ get: async () => ({ exists: isAdmin }) }) };
        }
        if (name === "sellers") {
          return {
            get: async () => ({
              size: sellers.length,
              forEach: (fn) => sellers.forEach((s) =>
                fn({ ref: { set: async (data) => setCalls.push({ id: s.id, data }) }, data: () => s })
              ),
            }),
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      },
    };
    db.__setCalls = setCalls;
    return db;
  }

  function loadWithDb(mockDb) {
    jest.resetModules();
    jest.doMock("../lib/admin", () => ({
      admin: { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } },
      db: mockDb,
    }));
    return require("../nicheMigration");
  }

  test("admin bo'lmagan chaqiruvchini rad etadi", async () => {
    const db = buildMockDb({ isAdmin: false });
    const { _testables } = loadWithDb(db);
    await expect(
      _testables.handleBackfillSellerNiches({ auth: { uid: "not-admin" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("faqat NOTO'G'RI/yo'q category'ga ega sotuvchilarni tuzatadi, to'g'rilarini tegmaydi", async () => {
    const db = buildMockDb({
      sellers: [
        { id: "s1", category: "Kosmetika" }, // to'g'ri - tegilmaydi
        { id: "s2", category: undefined }, // yo'q - tuzatiladi
        { id: "s3", category: "Gullar" }, // eski/noto'g'ri - tuzatiladi
        { id: "s4", category: "Elektronika" }, // to'g'ri - tegilmaydi
      ],
    });
    const { _testables } = loadWithDb(db);
    const result = await _testables.handleBackfillSellerNiches({ auth: { uid: "admin-1" } });

    expect(result.totalSellers).toBe(4);
    expect(result.fixedCount).toBe(2);
    expect(db.__setCalls.map((c) => c.id).sort()).toEqual(["s2", "s3"]);
    db.__setCalls.forEach((c) => expect(c.data.category).toBe("Kosmetika"));
  });
});
