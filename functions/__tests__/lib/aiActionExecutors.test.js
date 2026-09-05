/**
 * `lib/aiActionExecutors.js` uchun testlar — YANGI `adCampaign` harakat
 * turining haqiqiy ijrosi (promokod yaratish + CRM broadcast).
 */

function buildMockDb() {
  const coupons = {};
  return {
    collection(name) {
      if (name !== "sellers") throw new Error(`kutilmagan kolleksiya: ${name}`);
      return {
        doc(sellerId) {
          return {
            collection(subName) {
              if (subName === "coupons") {
                return {
                  doc(code) {
                    return { set: async (data) => { coupons[`${sellerId}/${code}`] = data; } };
                  },
                };
              }
              if (subName === "private") {
                return { doc: () => ({ get: async () => ({ exists: false }) }) }; // shaxsiy bot ulanmagan
              }
              throw new Error(`kutilmagan quyi kolleksiya: ${subName}`);
            },
          };
        },
      };
    },
    __coupons: coupons,
  };
}

function loadModule({ sendResults } = {}) {
  jest.resetModules();
  const db = buildMockDb();
  const admin = { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } };
  const sendTelegramMessageMock = jest.fn(async () => ({ ok: true }));
  if (sendResults) sendTelegramMessageMock.mockImplementation(async () => sendResults.shift() || { ok: true });
  const trackCrmMessageRecipientsMock = jest.fn(async () => undefined);
  const logNotificationMock = jest.fn(async () => undefined);

  jest.doMock("../../lib/admin", () => ({ admin, db, BOT_TOKEN: { value: () => "mock-bot-token" } }));
  jest.doMock("../../lib/helpers", () => ({ sendTelegramMessage: sendTelegramMessageMock }));
  jest.doMock("../../lib/dailyStats", () => ({
    trackCrmMessageRecipients: trackCrmMessageRecipientsMock,
    logNotification: logNotificationMock,
  }));

  const mod = require("../../lib/aiActionExecutors");
  return { ...mod, db, __sendTelegramMessageMock: sendTelegramMessageMock, __trackCrmMessageRecipientsMock: trackCrmMessageRecipientsMock, __logNotificationMock: logNotificationMock };
}

describe("executeAdCampaign", () => {
  test("haqiqiy promokod yaratadi va BARCHA maqsad mijozlarga yuboradi", async () => {
    const { executeAdCampaign, db, __trackCrmMessageRecipientsMock } = loadModule();
    const payload = {
      segment: "vip", tag: null, discountPercent: 12, title: "Aksiya",
      message: "Sizga maxsus taklif!", targetClientIds: ["c1", "c2"],
    };

    const result = await executeAdCampaign({ sellerId: "s1", payload });

    expect(result.sent).toBe(2);
    expect(result.total).toBe(2);
    expect(result.discountPercent).toBe(12);
    expect(result.couponCode).toMatch(/^AKSIYA-/);

    const couponKey = `s1/${result.couponCode}`;
    expect(db.__coupons[couponKey]).toMatchObject({
      code: result.couponCode,
      discountType: "percent",
      discountValue: 12,
      usageLimit: 2,
      usedCount: 0,
      isActive: true,
      isAiCeoAdCampaignReward: true,
    });
    expect(__trackCrmMessageRecipientsMock).toHaveBeenCalledWith("s1", ["c1", "c2"]);
  });

  test("xabar matniga ANIQ shu ijrodagi promokodni qo'shadi (AI taklifidagi matn emas)", async () => {
    const { executeAdCampaign, __sendTelegramMessageMock } = loadModule();
    const payload = {
      segment: "vip", tag: null, discountPercent: 15, title: "Aksiya",
      message: "Xabar matni", targetClientIds: ["c1"],
    };
    const result = await executeAdCampaign({ sellerId: "s1", payload });
    const sentText = __sendTelegramMessageMock.mock.calls[0][2];
    expect(sentText).toContain(result.couponCode);
    expect(sentText).toContain("-15%");
  });

  test("faqat MUVAFFAQIYATLI yetkazilgan mijozlarni hisoblaydi", async () => {
    const { executeAdCampaign } = loadModule({ sendResults: [{ ok: true }, { ok: false }] });
    const payload = {
      segment: "vip", tag: null, discountPercent: 10, title: "Aksiya",
      message: "Xabar", targetClientIds: ["c1", "c2"],
    };
    const result = await executeAdCampaign({ sellerId: "s1", payload });
    expect(result).toMatchObject({ sent: 1, total: 2 });
  });

  test("promokod yozishda xato bo'lsa - XATO TASHLAYDI (yashirilmaydi, chunki bu harakatning asosiy natijasi)", async () => {
    const { executeAdCampaign, db } = loadModule();
    const originalCollection = db.collection.bind(db);
    db.collection = (name) => {
      const orig = originalCollection(name);
      const origDoc = orig.doc.bind(orig);
      orig.doc = (sellerId) => {
        const sellerDoc = origDoc(sellerId);
        const origSubCollection = sellerDoc.collection.bind(sellerDoc);
        sellerDoc.collection = (subName) => {
          if (subName === "coupons") {
            return { doc: () => ({ set: async () => { throw new Error("Firestore yozish xatosi"); } }) };
          }
          return origSubCollection(subName);
        };
        return sellerDoc;
      };
      return orig;
    };

    await expect(executeAdCampaign({
      sellerId: "s1",
      payload: { segment: "vip", tag: null, discountPercent: 10, title: "Aksiya", message: "Xabar", targetClientIds: ["c1"] },
    })).rejects.toThrow("Firestore yozish xatosi");
  });
});
