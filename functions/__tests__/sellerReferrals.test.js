/**
 * `sellerReferrals.js` (sotuvchidan-sotuvchiga taklif dasturi) uchun
 * testlar.
 *
 * ASOSIY MAQSAD: (1) `recordSellerReferral` faqat to'g'ri, xavfsiz
 * holatlarda yozadi (o'z-o'zini taklif qilish rad etiladi, ikki marta
 * chaqirilsa qayta yozilmaydi); (2) `handleSellerAiCeoAccessChanged`
 * FAQAT admin ADMIN PANEL orqali (referal-sinov EMAS) haqiqiy Pro
 * obunani yoqqanda ishlaydi, taklif qiluvchiga FAQAT har 3-chi
 * tasdiqlangan taklifda mukofot beradi, va mukofot chegarasidan
 * (`MAX_REWARDED_REFERRALS_PER_SELLER`) oshib ketmaydi.
 */

function buildMockDb({ sellers = {}, referralDocs = {} } = {}) {
  const updateCalls = [];
  const referralSetCalls = [];

  function sellerDocRef(id) {
    return {
      id,
      get: async () => (sellers[id] ? { exists: true, id, data: () => sellers[id] } : { exists: false, id }),
      update: async (data) => {
        updateCalls.push({ id, data });
        // MUHIM: `FieldValue.increment(...)`ni haqiqiy songa ayirmaymiz -
        // bu testlarda hech kim yangilangan sonni O'QIMAYDI, faqat
        // `update()` chaqiruvining o'zi (qanday maydonlar bilan) tekshiriladi.
        sellers[id] = { ...(sellers[id] || {}), ...data };
      },
      collection: (subName) => {
        if (subName !== "sellerReferrals") return { doc: () => ({ get: async () => ({ exists: false }) }) };
        return {
          doc: (refId) => ({
            set: async (data, opts) => {
              referralSetCalls.push({ sellerId: id, refId, data, opts });
              const key = `${id}/${refId}`;
              referralDocs[key] = opts?.merge ? { ...(referralDocs[key] || {}), ...data } : data;
            },
          }),
        };
      },
    };
  }

  return {
    __updateCalls: updateCalls,
    __referralSetCalls: referralSetCalls,
    __sellers: sellers,
    __referralDocs: referralDocs,
    collection: (name) => {
      if (name === "sellers") return { doc: sellerDocRef };
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          increment: (n) => ({ __increment: n }),
        },
        Timestamp: {
          now: () => ({ toMillis: () => Date.now() }),
          fromMillis: (ms) => ({ toMillis: () => ms }),
        },
      },
    },
    db,
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    sendTelegramMessage: jest.fn().mockResolvedValue({ ok: true }),
  }));
  return require("../sellerReferrals");
}

describe("recordSellerReferral", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(_testables.handleRecordSellerReferral({ auth: null, data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("o'zini-o'zi taklif qilish rad etiladi", async () => {
    const db = buildMockDb();
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleRecordSellerReferral({ auth: { uid: "seller-1" }, data: { referrerSellerId: "seller-1" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("o'z do'koni hali yo'q bo'lsa rad etiladi", async () => {
    const db = buildMockDb({ sellers: { "referrer-1": { storeName: "A" } } });
    const { _testables } = loadModule(db);
    await expect(
      _testables.handleRecordSellerReferral({ auth: { uid: "new-seller" }, data: { referrerSellerId: "referrer-1" } })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("taklif qiluvchi topilmasa, xatosiz, `recorded:false` qaytaradi", async () => {
    const db = buildMockDb({ sellers: { "new-seller": { storeName: "B" } } });
    const { _testables } = loadModule(db);
    const result = await _testables.handleRecordSellerReferral({ auth: { uid: "new-seller" }, data: { referrerSellerId: "ghost" } });
    expect(result).toEqual({ recorded: false });
  });

  test("to'g'ri holatda ikkala yozuvni ham amalga oshiradi", async () => {
    const db = buildMockDb({ sellers: { "new-seller": { storeName: "B" }, "referrer-1": { storeName: "A" } } });
    const { _testables } = loadModule(db);
    const result = await _testables.handleRecordSellerReferral({ auth: { uid: "new-seller" }, data: { referrerSellerId: "referrer-1" } });

    expect(result).toEqual({ recorded: true });
    expect(db.__sellers["new-seller"].referredBySellerId).toBe("referrer-1");
    expect(db.__referralDocs["referrer-1/new-seller"]).toMatchObject({ referredSellerId: "new-seller", status: "signed_up" });
  });

  test("allaqachon referal bilan belgilangan bo'lsa, qayta yozmaydi (idempotent)", async () => {
    const db = buildMockDb({
      sellers: { "new-seller": { storeName: "B", referredBySellerId: "someone-else" }, "referrer-1": { storeName: "A" } },
    });
    const { _testables } = loadModule(db);
    const result = await _testables.handleRecordSellerReferral({ auth: { uid: "new-seller" }, data: { referrerSellerId: "referrer-1" } });

    expect(result).toEqual({ recorded: false, alreadyRecorded: true });
    expect(db.__sellers["new-seller"].referredBySellerId).toBe("someone-else"); // o'zgarmagan
  });
});

function buildEvent(sellerId, beforeData, afterData) {
  return {
    params: { sellerId },
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
  };
}

describe("handleSellerAiCeoAccessChanged (Pro obuna tasdiqlanishi)", () => {
  test("referal orqali kelmagan sotuvchi uchun hech narsa qilinmaydi", async () => {
    const db = buildMockDb({ sellers: { "seller-1": { storeName: "A" } } });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent("seller-1", { aiCeoEnabled: false }, { aiCeoEnabled: true })
    );
    expect(db.__updateCalls).toEqual([]);
  });

  test("aiCeoEnabled false->true o'tishi bo'lmasa (masalan boshqa maydon o'zgargan), hech narsa qilinmaydi", async () => {
    const db = buildMockDb({ sellers: { "seller-1": { referredBySellerId: "referrer-1" } } });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent(
        "seller-1",
        { referredBySellerId: "referrer-1", aiCeoEnabled: true, storeName: "Eski" },
        { referredBySellerId: "referrer-1", aiCeoEnabled: true, storeName: "Yangi" }
      )
    );
    expect(db.__updateCalls).toEqual([]);
  });

  test("referal-sinov orqali yoqilgan bo'lsa (aiCeoGrantedViaReferral:true), e'tiborga olinmaydi", async () => {
    const db = buildMockDb({ sellers: { "seller-1": { referredBySellerId: "referrer-1" } } });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent(
        "seller-1",
        { referredBySellerId: "referrer-1", aiCeoEnabled: false },
        { referredBySellerId: "referrer-1", aiCeoEnabled: true, aiCeoGrantedViaReferral: true }
      )
    );
    expect(db.__updateCalls).toEqual([]);
  });

  test("allaqachon tasdiqlangan bo'lsa (referralPaidConfirmed:true), qayta ishlanmaydi (idempotent)", async () => {
    const db = buildMockDb({ sellers: { "seller-1": { referredBySellerId: "referrer-1" } } });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent(
        "seller-1",
        { referredBySellerId: "referrer-1", aiCeoEnabled: false },
        { referredBySellerId: "referrer-1", aiCeoEnabled: true, referralPaidConfirmed: true }
      )
    );
    expect(db.__updateCalls).toEqual([]);
  });

  test("taklif qiluvchi topilmasa, xatosiz chiqib ketadi", async () => {
    const db = buildMockDb({ sellers: { "seller-1": { referredBySellerId: "ghost" } } });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent("seller-1", { referredBySellerId: "ghost", aiCeoEnabled: false }, { referredBySellerId: "ghost", aiCeoEnabled: true })
    );
    expect(db.__updateCalls).toEqual([]);
  });

  test("1-chi tasdiqlangan taklif - faqat hisoblanadi, mukofot berilmaydi", async () => {
    const db = buildMockDb({
      sellers: {
        "seller-1": { referredBySellerId: "referrer-1" },
        "referrer-1": { storeName: "A", sellerReferralPaidCount: 0, sellerReferralRewardsCount: 0 },
      },
    });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent("seller-1", { referredBySellerId: "referrer-1", aiCeoEnabled: false }, { referredBySellerId: "referrer-1", aiCeoEnabled: true })
    );

    const referredUpdate = db.__updateCalls.find((c) => c.id === "seller-1");
    expect(referredUpdate.data.referralPaidConfirmed).toBe(true);

    const referrerUpdate = db.__updateCalls.find((c) => c.id === "referrer-1");
    expect(referrerUpdate.data.sellerReferralPaidCount).toEqual({ __increment: 1 });
    expect(referrerUpdate.data.aiCeoEnabled).toBeUndefined();

    expect(db.__referralDocs["referrer-1/seller-1"]).toMatchObject({ status: "subscribed" });
  });

  test("3-chi tasdiqlangan taklifda, referrer'ga aiCeoEnabled va muddat beriladi", async () => {
    const db = buildMockDb({
      sellers: {
        "seller-3": { referredBySellerId: "referrer-1" },
        "referrer-1": { storeName: "A", sellerReferralPaidCount: 2, sellerReferralRewardsCount: 0 },
      },
    });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent("seller-3", { referredBySellerId: "referrer-1", aiCeoEnabled: false }, { referredBySellerId: "referrer-1", aiCeoEnabled: true })
    );

    const referrerUpdate = db.__updateCalls.find((c) => c.id === "referrer-1");
    expect(referrerUpdate.data.aiCeoEnabled).toBe(true);
    expect(referrerUpdate.data.aiCeoGrantedViaReferral).toBe(true);
    expect(referrerUpdate.data.aiCeoTrialExpiresAt).toBeTruthy();
    expect(referrerUpdate.data.sellerReferralRewardsCount).toEqual({ __increment: 1 });

    expect(db.__referralDocs["referrer-1/seller-3"]).toMatchObject({ status: "subscribed" });
  });

  test("mukofot chegarasidan (MAX_REWARDED_REFERRALS_PER_SELLER) oshgan bo'lsa, 3-chida ham aiCeoEnabled YANGILANMAYDI", async () => {
    const db = buildMockDb({
      sellers: {
        "seller-x": { referredBySellerId: "referrer-1" },
        "referrer-1": { storeName: "A", sellerReferralPaidCount: 59, sellerReferralRewardsCount: 20 },
      },
    });
    const { _testables } = loadModule(db);
    await _testables.handleSellerAiCeoAccessChanged(
      buildEvent("seller-x", { referredBySellerId: "referrer-1", aiCeoEnabled: false }, { referredBySellerId: "referrer-1", aiCeoEnabled: true })
    );

    const referrerUpdate = db.__updateCalls.find((c) => c.id === "referrer-1");
    expect(referrerUpdate.data.aiCeoEnabled).toBeUndefined();
    expect(referrerUpdate.data.sellerReferralPaidCount).toEqual({ __increment: 1 });
  });
});
