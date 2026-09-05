/**
 * `paymentCardInfo.js` uchun testlar — checkout paytida mijozga
 * sotuvchining shaxsiy karta ma'lumotini (raqam + F.I.SH) qaytaruvchi
 * TOR doiradagi onCall funksiya (2026-09 punkt-royxati, 14-band — ATMOS
 * hali ulanmagani uchun, mijoz "Karta orqali" tanlaganda sotuvchining
 * shaxsiy kartasiga qo'lda o'tkazma qilishi kerak).
 *
 * MUHIM E'TIBOR: bu funksiya `sellers/{id}/private/paymentConfig`
 * hujjatining FAQAT ikkita maydonini (`individualCardNumber`,
 * `individualCardHolderName`) qaytarishi shart — shu hujjatda saqlangan
 * Click/Payme SECRET kalitlari hech qachon chiqib ketmasligi kerak.
 *
 * Haqiqiy Firestore'ga ULANMAYDI — barchasi taqlid qilingan (mock).
 */

function buildMockDb({ paymentConfig } = {}) {
  return {
    collection: (name) => {
      if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
      return {
        doc: () => ({
          collection: (sub) => {
            if (sub !== "private") throw new Error(`Kutilmagan quyi kolleksiya: ${sub}`);
            return {
              doc: (docId) => {
                if (docId !== "paymentConfig") throw new Error(`Kutilmagan hujjat: ${docId}`);
                return {
                  get: async () =>
                    paymentConfig ? { exists: true, data: () => paymentConfig } : { exists: false },
                };
              },
            };
          },
        }),
      };
    },
  };
}

function loadModule({ db, checkRateLimitMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  jest.doMock("../lib/rateLimit", () => ({
    checkRateLimit: checkRateLimitMock || jest.fn().mockResolvedValue(undefined),
  }));
  return require("../paymentCardInfo");
}

describe("handleGetSellerPaymentCardInfo", () => {
  test("autentifikatsiyasiz chaqiruvni rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: null, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  // XAVFSIZLIK (P1 fix, 2026-09 audit): `sellers/{id}` ommaviy o'qiladi,
  // shuning uchun sellerId'lar oson sanaladi — rate-limit bo'lmasa,
  // istalgan tizimga kirgan foydalanuvchi BARCHA sotuvchilarning shaxsiy
  // karta ma'lumotini (raqam + F.I.SH) ommaviy yig'ib olishi mumkin edi.
  test("chaqiruvchi FOYDALANUVCHI bo'yicha rate-limit tekshiradi (aniq sellerId bo'yicha EMAS)", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const db = buildMockDb({
      paymentConfig: {
        individualPaymentEnabled: true,
        individualCardNumber: "8600123456789012",
        individualCardHolderName: "Aziz Azizov",
      },
    });
    const { _testables } = loadModule({ db, checkRateLimitMock });

    await _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: { sellerId: "s1" } });

    expect(checkRateLimitMock).toHaveBeenCalledWith("getSellerPaymentCardInfo:c1", expect.any(Number), expect.any(Number));
    // Kalitda ANIQ sellerId ISHTIROK ETMASLIGI kerak — aks holda hujumchi
    // har safar BOSHQA sellerId yuborib, chegarani aylanib o'tishi mumkin.
    expect(checkRateLimitMock.mock.calls[0][0]).not.toContain("s1");
  });

  test("rate-limit oshib ketgan bo'lsa, 'resource-exhausted' bilan rad etadi (sotuvchi mavjud bo'lsa ham)", async () => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const checkRateLimitMock = jest.fn().mockRejectedValue(new HttpsError("resource-exhausted", "Juda ko'p so'rov."));
    const db = buildMockDb({
      paymentConfig: {
        individualPaymentEnabled: true,
        individualCardNumber: "8600123456789012",
        individualCardHolderName: "Aziz Azizov",
      },
    });
    const { _testables } = loadModule({ db, checkRateLimitMock });

    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  test("sellerId berilmasa rad etadi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: {} })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("paymentConfig hujjati mavjud bo'lmasa 'not-found' beradi", async () => {
    const { _testables } = loadModule({ db: buildMockDb({}) });
    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("individualPaymentEnabled=false bo'lsa 'not-found' beradi (karta raqami saqlangan bo'lsa ham)", async () => {
    const db = buildMockDb({
      paymentConfig: {
        individualPaymentEnabled: false,
        individualCardNumber: "8600123456789012",
        individualCardHolderName: "Aziz Azizov",
      },
    });
    const { _testables } = loadModule({ db });
    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("karta raqami yoki F.I.SH yo'q bo'lsa, enabled=true bo'lsa ham 'not-found' beradi", async () => {
    const db = buildMockDb({
      paymentConfig: {
        individualPaymentEnabled: true,
        individualCardNumber: "8600123456789012",
        individualCardHolderName: null,
      },
    });
    const { _testables } = loadModule({ db });
    await expect(
      _testables.handleGetSellerPaymentCardInfo({ auth: { uid: "c1" }, data: { sellerId: "s1" } })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("to'g'ri sozlangan bo'lsa, FAQAT karta raqami va F.I.SH'ini qaytaradi — SECRET kalitlar hech qachon chiqmaydi", async () => {
    const db = buildMockDb({
      paymentConfig: {
        individualPaymentEnabled: true,
        individualCardNumber: "8600123456789012",
        individualCardHolderName: "Aziz Azizov",
        clickSecretKey: "SUPER-MAXFIY-KALIT",
        paymeKey: "YANA-BIR-MAXFIY-KALIT",
      },
    });
    const { _testables } = loadModule({ db });
    const result = await _testables.handleGetSellerPaymentCardInfo({
      auth: { uid: "c1" },
      data: { sellerId: "s1" },
    });
    expect(result).toEqual({ cardNumber: "8600123456789012", cardHolderName: "Aziz Azizov" });
    expect(result.clickSecretKey).toBeUndefined();
    expect(result.paymeKey).toBeUndefined();
  });
});
