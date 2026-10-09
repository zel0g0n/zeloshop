/**
 * `adminSellerManagement.js` uchun testlar — do'konni BUTUNLAY,
 * QAYTARIB BO'LMAYDIGAN tarzda o'chiruvchi `deleteSellerPermanently`
 * (`handleDeleteSellerPermanently`).
 *
 * 2026-09 audit ("o'rtacha darajadagi kamchiliklar"): bu — platformadagi
 * ENG XAVFLI (qaytarib bo'lmaydigan) amal, shuning uchun eng ko'p
 * testga muhtoj joy edi. Quyida tekshiriladi:
 *   1) Ruxsat nazorati (auth yo'q / admin emas).
 *   2) Kirish ma'lumotlarini tekshirish (sellerId yo'q, do'kon topilmadi).
 *   3) Do'kon nomini QAYTA yozib tasdiqlash (aniq mos kelishi, katta-kichik
 *      harf va bo'sh joylarga sezgir emas).
 *   4) HAQIQIY o'chirish mantig'i: FAQAT shu `sellerId`ga tegishli
 *      hujjatlar o'chiriladi (boshqa sotuvchining ma'lumotlariga
 *      TEGILMAYDI), mahsulotlar `recursiveDelete` bilan (sharhlari
 *      bilan birga), "yassi" kolleksiyalar to'plamli (batched) o'chirish
 *      bilan, 400ta chegarasidan katta hajmlarda TO'G'RI bo'laklarga
 *      bo'linadi, va oxirida sotuvchining o'zi (barcha subkolleksiyalari
 *      bilan) `recursiveDelete` qilinadi.
 *
 * Haqiqiy Firestore'ga ULANMAYDI — barchasi taqlid qilingan (mock).
 */

function buildMockDb({ sellers = {}, admins = {} } = {}) {
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: (id) => ({
            get: async () => (sellers[id] ? { exists: true, data: () => sellers[id] } : { exists: false }),
          }),
        };
      }
      if (name === "admins") {
        return { doc: (id) => ({ get: async () => ({ exists: Boolean(admins[id]) }) }) };
      }
      throw new Error(`Kutilmagan kolleksiya (db): ${name}`);
    },
  };
}

/**
 * `admin.firestore()` — HAQIQIY o'chirish amallari shu orqali sodir
 * bo'ladi (`where(...).get()`, `recursiveDelete(ref)`, `batch()`).
 *
 * @param {Record<string, Array<{id: string, sellerId: string}>>} data -
 *   kolleksiya nomi -> hujjatlar ro'yxati (har biri kamida `id` va
 *   `sellerId`ga ega).
 */
function buildMockFirestore(data = {}) {
  const recursiveDeleteCalls = [];
  const commits = []; // har bir commit — o'sha commit'da o'chirilgan ref'lar ro'yxati

  const firestore = {
    collection: (name) => ({
      where: (field, op, value) => ({
        get: async () => {
          if (op !== "==") throw new Error(`Kutilmagan operator: ${op}`);
          const docs = (data[name] || [])
            .filter((doc) => doc[field] === value)
            .map((doc) => ({ id: doc.id, ref: { __collection: name, __id: doc.id } }));
          return { docs, size: docs.length };
        },
      }),
    }),
    recursiveDelete: jest.fn(async (ref) => {
      recursiveDeleteCalls.push(ref);
    }),
    batch: () => {
      const deletes = [];
      return {
        delete: (ref) => { deletes.push(ref); },
        commit: async () => { commits.push(deletes.slice()); },
      };
    },
    __recursiveDeleteCalls: recursiveDeleteCalls,
    __commits: commits,
  };
  return firestore;
}

function loadModule({ db, firestore } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: () => firestore },
    db,
  }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    initSentry: jest.fn(),
    Sentry: { captureException: jest.fn() },
    SENTRY_DSN: { value: () => null },
  }));
  return require("../adminSellerManagement");
}

describe("handleDeleteSellerPermanently — ruxsat nazorati", () => {
  test("auth yo'q bo'lsa — unauthenticated", async () => {
    const mod = loadModule({ db: buildMockDb({}), firestore: buildMockFirestore({}) });
    await expect(mod._testables.handleDeleteSellerPermanently({})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("admin bo'lmagan foydalanuvchi — permission-denied", async () => {
    const mod = loadModule({ db: buildMockDb({ admins: {} }), firestore: buildMockFirestore({}) });
    await expect(
      mod._testables.handleDeleteSellerPermanently({ auth: { uid: "not-admin-1" }, data: { sellerId: "s1", confirmStoreName: "x" } })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("handleDeleteSellerPermanently — parol (veb) sessiyasi admin bo'la olmaydi", () => {
  test("admin ID'li, lekin loginMethod=password tokenli foydalanuvchi — permission-denied", async () => {
    const mod = loadModule({ db: buildMockDb({ admins: { "admin-1": true } }), firestore: buildMockFirestore({}) });
    await expect(
      mod._testables.handleDeleteSellerPermanently({
        auth: { uid: "admin-1", token: { loginMethod: "password" } },
        data: { sellerId: "s1", confirmStoreName: "x" },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("handleDeleteSellerPermanently — kirish ma'lumotlarini tekshirish", () => {
  test("sellerId berilmagan — invalid-argument", async () => {
    const mod = loadModule({ db: buildMockDb({ admins: { u1: true } }), firestore: buildMockFirestore({}) });
    await expect(
      mod._testables.handleDeleteSellerPermanently({ auth: { uid: "u1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("bunday do'kon topilmasa — not-found", async () => {
    const mod = loadModule({ db: buildMockDb({ admins: { u1: true }, sellers: {} }), firestore: buildMockFirestore({}) });
    await expect(
      mod._testables.handleDeleteSellerPermanently({ auth: { uid: "u1" }, data: { sellerId: "yoq-seller", confirmStoreName: "x" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("handleDeleteSellerPermanently — do'kon nomini qayta tasdiqlash", () => {
  test("confirmStoreName berilmagan (bo'sh) — failed-precondition, HECH NARSA o'chirilmaydi", async () => {
    const firestore = buildMockFirestore({});
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Zelo Do'koni" } } }),
      firestore,
    });
    await expect(
      mod._testables.handleDeleteSellerPermanently({ auth: { uid: "u1" }, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(firestore.recursiveDelete).not.toHaveBeenCalled();
  });

  test("noto'g'ri nom kiritilsa — failed-precondition, HECH NARSA o'chirilmaydi", async () => {
    const firestore = buildMockFirestore({});
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Zelo Do'koni" } } }),
      firestore,
    });
    await expect(
      mod._testables.handleDeleteSellerPermanently({ auth: { uid: "u1" }, data: { sellerId: "s1", confirmStoreName: "Boshqa Nom" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(firestore.recursiveDelete).not.toHaveBeenCalled();
  });

  test("katta-kichik harf va bosh joylarga SEZGIR EMAS — to'g'ri nom (turli registr/probel bilan) qabul qilinadi", async () => {
    const firestore = buildMockFirestore({});
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Zelo Do'koni" } } }),
      firestore,
    });
    const result = await mod._testables.handleDeleteSellerPermanently({
      auth: { uid: "u1" },
      data: { sellerId: "s1", confirmStoreName: "  zelo do'koni  " },
    });
    expect(result.success).toBe(true);
  });
});

describe("handleDeleteSellerPermanently — HAQIQIY o'chirish mantig'i", () => {
  test("FAQAT shu sellerId'ga tegishli hujjatlar o'chiriladi — boshqa sotuvchining ma'lumotlariga TEGILMAYDI", async () => {
    const data = {
      products: [
        { id: "p1", sellerId: "s1" },
        { id: "p2", sellerId: "s1" },
        { id: "p-other", sellerId: "s2" }, // BOSHQA sotuvchi — tegilmasligi kerak
      ],
      orders: [
        { id: "o1", sellerId: "s1" },
        { id: "o-other", sellerId: "s2" },
      ],
      staff: [{ id: "st1", sellerId: "s1" }],
      couriers: [{ id: "c1", sellerId: "s1" }],
      carts: [{ id: "cart1", sellerId: "s1" }],
    };
    const firestore = buildMockFirestore(data);
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Zelo Do'koni" } } }),
      firestore,
    });

    const result = await mod._testables.handleDeleteSellerPermanently({
      auth: { uid: "u1" },
      data: { sellerId: "s1", confirmStoreName: "Zelo Do'koni" },
    });

    expect(result).toEqual({
      success: true,
      deletedCounts: { products: 2, orders: 1, staff: 1, couriers: 1, carts: 1 },
    });

    // Mahsulotlar - HAR BIRI alohida `recursiveDelete` bilan (sharhlari
    // bilan birga o'chishi uchun), FAQAT s1'ga tegishli 2 tasi (p-other
    // EMAS).
    const productDeleteIds = firestore.__recursiveDeleteCalls
      .filter((ref) => ref.__collection === "products")
      .map((ref) => ref.__id);
    expect(productDeleteIds.sort()).toEqual(["p1", "p2"]);

    // "Yassi" kolleksiyalar - to'plamli (batch) o'chirish orqali, FAQAT
    // s1'ga tegishli hujjatlar (o-other EMAS).
    const allBatchedRefs = firestore.__commits.flat();
    const batchedIds = allBatchedRefs.map((ref) => ref.__id).sort();
    expect(batchedIds).toEqual(["c1", "cart1", "o1", "st1"]);
    expect(batchedIds).not.toContain("o-other");

    // Eng oxirida - sotuvchining O'ZI (barcha subkolleksiyalari bilan)
    // `recursiveDelete` qilinishi SHART. `db.collection("sellers").doc(id)`dan
    // kelgan `sellerRef` bizning mock `db`imizda oddiy `{get}` obyekti
    // (mahsulot ref'laridan farqli, `__collection` YO'Q) - shuning uchun
    // YAKUNIY chaqiruv mahsulot ref'i EMASLIGINI tekshiramiz, va jami
    // `recursiveDelete` chaqiruvlari soni aynan (2 mahsulot + 1 do'kon) = 3.
    expect(firestore.recursiveDelete).toHaveBeenCalledTimes(3);
    const lastCall = firestore.__recursiveDeleteCalls[firestore.__recursiveDeleteCalls.length - 1];
    expect(lastCall.__collection).not.toBe("products");
  });

  test("mahsulot yo'q (0 ta) bo'lsa ham — xatosiz ishlaydi, deletedCounts.products = 0", async () => {
    const firestore = buildMockFirestore({});
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Bo'sh Do'kon" } } }),
      firestore,
    });
    const result = await mod._testables.handleDeleteSellerPermanently({
      auth: { uid: "u1" },
      data: { sellerId: "s1", confirmStoreName: "Bo'sh Do'kon" },
    });
    expect(result.deletedCounts).toEqual({ products: 0, orders: 0, staff: 0, couriers: 0, carts: 0 });
    // Sotuvchining o'zi baribir o'chirilishi kerak (bo'sh do'kon ham
    // haqiqiy o'chirishga loyiq).
    expect(firestore.recursiveDelete).toHaveBeenCalledTimes(1);
  });

  test("401 ta buyurtma (400 chegarasidan KATTA) — TO'G'RI ikkita bo'lakka (400 + 1) bo'lib o'chiriladi", async () => {
    const orders = Array.from({ length: 401 }, (_, i) => ({ id: `o${i}`, sellerId: "s1" }));
    const firestore = buildMockFirestore({ orders });
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Katta Do'kon" } } }),
      firestore,
    });
    const result = await mod._testables.handleDeleteSellerPermanently({
      auth: { uid: "u1" },
      data: { sellerId: "s1", confirmStoreName: "Katta Do'kon" },
    });
    expect(result.deletedCounts.orders).toBe(401);
    // `orders` uchun aynan 2 marta `batch.commit()` chaqirilgan bo'lishi
    // kerak (400 + 1) - butun ro'yxat esa jami 401 ta hujjatni qamrab
    // olishi kerak.
    const orderCommits = firestore.__commits.filter((batchRefs) => batchRefs.some((ref) => ref.__collection === "orders"));
    expect(orderCommits.length).toBe(2);
    expect(orderCommits[0].length).toBe(400);
    expect(orderCommits[1].length).toBe(1);
  });

  test("noto'g'ri tasdiqlashdan KEYIN hech qanday Firestore o'chirish operatsiyasi chaqirilmaydi (products/orders so'rovlari ham)", async () => {
    const data = { products: [{ id: "p1", sellerId: "s1" }] };
    const firestore = buildMockFirestore(data);
    const collectionSpy = jest.spyOn(firestore, "collection");
    const mod = loadModule({
      db: buildMockDb({ admins: { u1: true }, sellers: { s1: { storeName: "Zelo Do'koni" } } }),
      firestore,
    });
    await expect(
      mod._testables.handleDeleteSellerPermanently({
        auth: { uid: "u1" }, data: { sellerId: "s1", confirmStoreName: "noto'g'ri" },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(collectionSpy).not.toHaveBeenCalled();
  });
});
