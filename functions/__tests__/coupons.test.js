/**
 * `coupons.js` — promokod soni hisoblagichi (`sellers/{id}.couponCount`)
 * trigger'i uchun testlar. Bu hisoblagich `firestore.rules`dagi
 * Z-Tariflar promo kod limitini (Start: 0, Pro: 3, Biznes: cheksiz)
 * TEKSHIRISH uchun ishlatiladi - shuning uchun +1/-1 hisoblanishi
 * ANIQ to'g'ri bo'lishi SHART.
 */

function buildMockDb() {
  const setCalls = [];
  return {
    __setCalls: setCalls,
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: (id) => ({
          set: async (data, opts) => setCalls.push({ id, data, opts }),
        }),
      };
    },
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { increment: (n) => ({ __increment: n }) } } },
    db,
  }));
  return require("../coupons");
}

function buildEvent(sellerId, { before, after }) {
  return {
    params: { sellerId },
    data: {
      before: before === undefined ? undefined : { exists: before },
      after: after === undefined ? undefined : { exists: after },
    },
  };
}

describe("handleCouponWrite", () => {
  test("YANGI promokod yaratilganda - +1 qo'shadi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await _testables.handleCouponWrite(buildEvent("s1", { before: false, after: true }));

    expect(db.__setCalls).toHaveLength(1);
    expect(db.__setCalls[0]).toMatchObject({ id: "s1", data: { couponCount: { __increment: 1 } }, opts: { merge: true } });
  });

  test("promokod O'CHIRILGANDA - -1 qiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await _testables.handleCouponWrite(buildEvent("s1", { before: true, after: false }));

    expect(db.__setCalls[0].data.couponCount).toEqual({ __increment: -1 });
  });

  test("YANGILANISH (ikkalasi ham mavjud) - sonni O'ZGARTIRMAYDI", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await _testables.handleCouponWrite(buildEvent("s1", { before: true, after: true }));

    expect(db.__setCalls).toHaveLength(0);
  });
});
