/**
 * `notificationRetryWorker.js`dagi `processDueRetry` uchun testlar —
 * navbatdagi ikkala tur ("customerNotification"/"sellerMessage")
 * to'g'ri qayta ishlanishini va yakuniy muvaffaqiyatsizlik to'g'ri
 * qayd etilishini tekshiradi.
 */
function loadModule({ sendCustomerNotificationMock, sendTelegramMessageMock, recordAttemptResultMock, logNotificationMock } = {}) {
  jest.resetModules();

  jest.doMock("../lib/admin", () => ({ BOT_TOKEN: { value: () => "platform-token" } }));
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage: sendTelegramMessageMock || jest.fn(async () => ({ ok: true })) }));
  jest.doMock("../lib/customerNotify", () => ({
    getSellerCustomBotToken: jest.fn(async () => "custom-token"),
    sendCustomerNotification: sendCustomerNotificationMock || jest.fn(async () => ({ ok: true })),
  }));
  jest.doMock("../lib/dailyStats", () => ({ logNotification: logNotificationMock || jest.fn(async () => undefined) }));
  jest.doMock("../lib/notificationRetryQueue", () => ({
    fetchDueRetries: jest.fn(async () => []),
    recordAttemptResult: recordAttemptResultMock || jest.fn(async () => ({ finalFailure: false })),
  }));

  return require("../notificationRetryWorker");
}

function buildDoc(id, data) {
  return { id, ref: { delete: jest.fn(async () => undefined) }, data: () => data };
}

describe("processDueRetry", () => {
  test("\"customerNotification\" turini seller'ning JORIY botini qayta o'qib qayta uradi", async () => {
    const sendCustomerNotificationMock = jest.fn(async () => ({ ok: true }));
    const recordAttemptResultMock = jest.fn(async () => ({ finalFailure: false }));
    const worker = loadModule({ sendCustomerNotificationMock, recordAttemptResultMock });

    const doc = buildDoc("d1", { kind: "customerNotification", payload: { sellerId: "s1", clientId: "c1", text: "Salom" } });
    await worker._testables.processDueRetry(doc, "platform-token");

    expect(sendCustomerNotificationMock).toHaveBeenCalledWith("custom-token", "c1", "Salom", undefined);
    expect(recordAttemptResultMock).toHaveBeenCalledWith(doc, true, undefined);
  });

  test("\"sellerMessage\" turini platforma boti orqali qayta uradi", async () => {
    const sendTelegramMessageMock = jest.fn(async () => ({ ok: false, description: "vaqtinchalik xato" }));
    const recordAttemptResultMock = jest.fn(async () => ({ finalFailure: false }));
    const worker = loadModule({ sendTelegramMessageMock, recordAttemptResultMock });

    const doc = buildDoc("d2", { kind: "sellerMessage", payload: { chatId: "seller1", text: "Yangi buyurtma", options: {} } });
    await worker._testables.processDueRetry(doc, "platform-token");

    expect(sendTelegramMessageMock).toHaveBeenCalledWith("platform-token", "seller1", "Yangi buyurtma", {});
    expect(recordAttemptResultMock).toHaveBeenCalledWith(doc, false, "vaqtinchalik xato");
  });

  test("yakuniy muvaffaqiyatsizlikda (\"finalFailure: true\") mijozga \"logNotification\" orqali qayd etiladi", async () => {
    const recordAttemptResultMock = jest.fn(async () => ({ finalFailure: true }));
    const logNotificationMock = jest.fn(async () => undefined);
    const sendCustomerNotificationMock = jest.fn(async () => ({ ok: false, description: "chat not found" }));
    const worker = loadModule({ sendCustomerNotificationMock, recordAttemptResultMock, logNotificationMock });

    const doc = buildDoc("d3", { kind: "customerNotification", payload: { sellerId: "s1", clientId: "c1", text: "Salom" } });
    await worker._testables.processDueRetry(doc, "platform-token");

    expect(logNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      sellerId: "s1", clientId: "c1", type: "retryExhausted", delivered: false,
    }));
  });

  test("noma'lum \"kind\" bo'lsa, hujjatni o'chiradi va xato tashlamaydi", async () => {
    const worker = loadModule();
    const doc = buildDoc("d4", { kind: "unknown", payload: {} });

    await expect(worker._testables.processDueRetry(doc, "platform-token")).resolves.toBeUndefined();
    expect(doc.ref.delete).toHaveBeenCalledTimes(1);
  });
});
