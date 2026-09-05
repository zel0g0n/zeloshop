/**
 * `atmosProxyTest.js` — ATMOS uchun statik-IP proksi-VM'ni tekshiruvchi
 * VAQTINCHALIK diagnostika funksiyasi uchun testlar.
 */

function buildMockDb({ isAdmin = true } = {}) {
  return {
    collection: (name) => {
      if (name === "admins") {
        return { doc: () => ({ get: async () => ({ exists: isAdmin }) }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
}

function loadModule(db) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({ db }));
  return require("../atmosProxyTest");
}

describe("handleTestAtmosProxyIp", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("auth bo'lmasa - unauthenticated xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    await expect(_testables.handleTestAtmosProxyIp({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("admin bo'lmasa - permission-denied xatosi", async () => {
    const { _testables } = loadModule(buildMockDb({ isAdmin: false }));
    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "client-1" }, data: {} })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("VM kutilgan statik IP'ni qaytarsa - matches:true", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vmOutboundIp: _testables.EXPECTED_STATIC_IP }),
    });

    const result = await _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} });

    expect(result).toEqual({
      vmOutboundIp: _testables.EXPECTED_STATIC_IP,
      expectedStaticIp: _testables.EXPECTED_STATIC_IP,
      matches: true,
    });
  });

  test("VM boshqa IP qaytarsa - matches:false (lekin xato tashlamaydi)", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vmOutboundIp: "1.2.3.4" }),
    });

    const result = await _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} });
    expect(result.matches).toBe(false);
  });

  test("VM'ga ulanib bo'lmasa - unavailable xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} })
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  test("VM 500 status qaytarsa - internal xatosi", async () => {
    const { _testables } = loadModule(buildMockDb());
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      _testables.handleTestAtmosProxyIp({ auth: { uid: "admin-1" }, data: {} })
    ).rejects.toMatchObject({ code: "internal" });
  });
});
