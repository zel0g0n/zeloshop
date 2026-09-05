/**
 * `lib/safeFetch.js` uchun testlar — 2026-09 XAVFSIZLIK AUDITI (P1,
 * SSRF): AI'ga rasm yuborishdan oldin, mahsulot `image` maydonidagi
 * URL FAQAT Firebase Storage domenlariga tegishli ekanligini
 * tekshiruvchi himoya qatlami.
 */
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("fetchTrustedImage", () => {
  test("Firebase Storage (firebasestorage.googleapis.com) HTTPS manzilini RUXSAT beradi", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const { fetchTrustedImage } = require("../lib/safeFetch");

    const url = "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.jpg?alt=media";
    await fetchTrustedImage(url);

    expect(global.fetch).toHaveBeenCalledWith(url);
  });

  test("storage.googleapis.com HTTPS manzilini RUXSAT beradi", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const { fetchTrustedImage } = require("../lib/safeFetch");

    await fetchTrustedImage("https://storage.googleapis.com/commerce-zelo.appspot.com/products/img.jpg");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("GCP metadata serverini (SSRF, ichki tarmoq) RAD ETADI va tarmoqqa so'rov yubormaydi", async () => {
    global.fetch = jest.fn();
    const { fetchTrustedImage } = require("../lib/safeFetch");

    await expect(fetchTrustedImage("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("ichki tarmoq/localhost manzilini RAD ETADI", async () => {
    global.fetch = jest.fn();
    const { fetchTrustedImage } = require("../lib/safeFetch");

    await expect(fetchTrustedImage("http://localhost:8080/secret")).rejects.toThrow();
    await expect(fetchTrustedImage("http://127.0.0.1/admin")).rejects.toThrow();
    await expect(fetchTrustedImage("https://internal-service.local/data")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("HTTPS bo'lmagan protokollarni (http, file, gopher) RAD ETADI", async () => {
    global.fetch = jest.fn();
    const { fetchTrustedImage } = require("../lib/safeFetch");

    await expect(fetchTrustedImage("http://firebasestorage.googleapis.com/x")).rejects.toThrow();
    await expect(fetchTrustedImage("file:///etc/passwd")).rejects.toThrow();
    await expect(fetchTrustedImage("gopher://127.0.0.1:6379/_INFO")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("Firebase Storage domenini TAQLID QILUVCHI (lookalike) domenlarni RAD ETADI", async () => {
    global.fetch = jest.fn();
    const { fetchTrustedImage } = require("../lib/safeFetch");

    // Diqqat: bu "firebasestorage.googleapis.com.evil.com" kabi
    // hostname'lar — agar tekshiruv `.includes()`/`endsWith()` bilan
    // qilinganda edi, bular XATO ravishda o'tib ketardi.
    await expect(fetchTrustedImage("https://firebasestorage.googleapis.com.evil.com/x")).rejects.toThrow();
    await expect(fetchTrustedImage("https://evil.com/firebasestorage.googleapis.com")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("bo'sh yoki yaroqsiz URL'ni RAD ETADI", async () => {
    global.fetch = jest.fn();
    const { fetchTrustedImage } = require("../lib/safeFetch");

    await expect(fetchTrustedImage("")).rejects.toThrow();
    await expect(fetchTrustedImage(null)).rejects.toThrow();
    await expect(fetchTrustedImage("not-a-url")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
