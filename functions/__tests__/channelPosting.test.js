/**
 * `channelPosting.js` uchun testlar.
 *
 * ASOSIY MAQSAD: (1) faqat HAQIQATAN admin bo'lgan (va "Xabar
 * yuborish" huquqiga ega) bot ulanishini, (2) botsiz/kanalsiz
 * holatda "kanalga joylashtirish" so'ralsa tushunarli xato
 * berilishini tasdiqlash.
 */

function buildMockDb({ customBotData = null } = {}) {
  const setCalls = [];
  return {
    collection: () => ({
      doc: () => ({
        // Ommaviy hujjatga to'g'ridan-to'g'ri yozish uchun (2 daraja:
        // `sellers/{uid}`).
        set: async (data) => { setCalls.push(data); },
        // Maxfiy `private/customerBot` yo'liga yozish/o'qish uchun
        // (4 daraja: `sellers/{uid}/private/customerBot`).
        collection: () => ({
          doc: () => ({
            get: async () => (customBotData ? { exists: true, data: () => customBotData } : { exists: false }),
            set: async (data) => { setCalls.push(data); },
          }),
        }),
      }),
    }),
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
    __setCalls: setCalls,
  };
}

function loadModule(db, fetchMock) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  global.fetch = fetchMock;
  return require("../channelPosting");
}

const baseRequest = (overrides = {}) => ({ auth: { uid: "seller-1" }, data: { ...overrides } });

describe("connectChannel", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    await expect(_testables.handleConnectChannel({ auth: null, data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("bot hali ulanmagan bo'lsa, tushunarli xato beradi", async () => {
    const db = buildMockDb({ customBotData: null });
    const { _testables } = loadModule(db, jest.fn());
    await expect(_testables.handleConnectChannel(baseRequest({ channelUsername: "mychannel" })))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("bot admin EMAS bo'lsa (oddiy a'zo), ulanishni RAD ETADI", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123" } });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { id: 999, username: "mybot" } }) })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { status: "member" } }) });
    const { _testables } = loadModule(db, fetchMock);

    await expect(_testables.handleConnectChannel(baseRequest({ channelUsername: "mychannel" })))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("bot admin, lekin 'Xabar yuborish' huquqi YO'Q bo'lsa, RAD ETADI", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123" } });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { id: 999, username: "mybot" } }) })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { status: "administrator", can_post_messages: false } }) });
    const { _testables } = loadModule(db, fetchMock);

    await expect(_testables.handleConnectChannel(baseRequest({ channelUsername: "mychannel" })))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("bot admin VA 'Xabar yuborish' huquqiga ega bo'lsa - MUVAFFAQIYATLI ulanadi", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123" } });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { id: 999, username: "mybot" } }) })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, result: { status: "administrator", can_post_messages: true } }) });
    const { _testables } = loadModule(db, fetchMock);

    const result = await _testables.handleConnectChannel(baseRequest({ channelUsername: "mychannel" }));
    expect(result.channelUsername).toBe("@mychannel");
  });
});

describe("postToChannel", () => {
  test("bot yoki kanal ulanmagan bo'lsa, tushunarli xato beradi", async () => {
    const db = buildMockDb({ customBotData: null });
    const { _testables } = loadModule(db, jest.fn());
    await expect(_testables.handlePostToChannel(baseRequest({ caption: "Salom" })))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("rasm bo'lsa, sendPhoto chaqiradi", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123", connectedChannelUsername: "@mychannel" } });
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({ ok: true, result: { message_id: 42 } }) });
    const { _testables } = loadModule(db, fetchMock);

    const result = await _testables.handlePostToChannel(baseRequest({ caption: "Yangi mahsulot!", imageUrl: "https://example.com/img.jpg" }));

    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("sendPhoto");
  });

  test("rasm bo'lmasa, sendMessage chaqiradi", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123", connectedChannelUsername: "@mychannel" } });
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({ ok: true, result: { message_id: 42 } }) });
    const { _testables } = loadModule(db, fetchMock);

    await _testables.handlePostToChannel(baseRequest({ caption: "Faqat matn" }));

    expect(fetchMock.mock.calls[0][0]).toContain("sendMessage");
  });

  test("matn HAM, rasm HAM bo'lmasa, rad etiladi", async () => {
    const db = buildMockDb({ customBotData: { botToken: "tok:123", connectedChannelUsername: "@mychannel" } });
    const { _testables } = loadModule(db, jest.fn());
    await expect(_testables.handlePostToChannel(baseRequest({})))
      .rejects.toMatchObject({ code: "invalid-argument" });
  });
});
