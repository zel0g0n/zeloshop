import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { shareProductAsPost } from "./shareProductAsPost";

/**
 * `shareProductAsPost`ning ASOSIY xavfsizlik/mantiq talablari:
 * (1) `navigator.share` UMUMAN MAVJUD bo'lmasa - Telegram'ning URL
 *     asosidagi zaxira oynasiga o'tadi (rasmsiz, chunki bu YO'L rasm
 *     biriktirishni qo'llamaydi).
 * (2) Rasm MUVAFFAQIYATLI fayl sifatida tayyorlansa (fetch+canShare
 *     ikkalasi ham OK) - `navigator.share` ANIQ BIR MARTA, `files`
 *     bilan chaqiriladi, matn ICHIDA havola bilan (ALOHIDA `url`
 *     maydonisiz).
 * (3) Rasmni fetch qilib bo'lmasa (masalan CORS) - JIM qolib,
 *     rasmsiz (matn+url) ulashishga o'tadi - funksiya XATO
 *     TASHLAMAYDI.
 * (4) `navigator.canShare({files})` false qaytarsa - rasmsiz
 *     ulashishga o'tadi.
 * (5) Foydalanuvchi ulashish oynasini BEKOR QILSA (`navigator.share`
 *     xato tashlasa) - IKKINCHI marta oyna QAYTA OCHILMAYDI
 *     (`navigator.share` faqat BIR MARTA chaqirilishi kerak).
 */

const product = { id: "p1", name: "Krem", price: 100_000, image: "https://example.com/krem.jpg" };

// MUHIM: Node'ning zamonaviy versiyalarida global `navigator` FAQAT
// getter sifatida mavjud (`globalThis.navigator = ...` xato beradi) -
// shuning uchun `Object.defineProperty` orqali qayta belgilanadi.
function setGlobalNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

function stubNavigator({ share, canShare } = {}) {
  const shareMock = share || vi.fn().mockResolvedValue(undefined);
  const canShareMock = canShare === undefined ? vi.fn().mockReturnValue(true) : canShare;
  const nav = { share: shareMock };
  if (canShareMock !== null) nav.canShare = canShareMock;
  setGlobalNavigator(nav);
  return { shareMock, canShareMock };
}

describe("shareProductAsPost", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.window = { open: vi.fn() };
  });

  afterEach(() => {
    setGlobalNavigator(originalNavigator);
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("`navigator.share` mavjud bo'lmasa, Telegram zaxira oynasini ochadi (rasmsiz)", async () => {
    setGlobalNavigator({});
    await shareProductAsPost(product, "seller1");
    expect(globalThis.window.open).toHaveBeenCalledTimes(1);
    const [url] = globalThis.window.open.mock.calls[0];
    expect(url).toContain("https://t.me/share/url?url=");
    expect(url).toContain("text=");
  });

  test("rasm muvaffaqiyatli tayyorlansa, `navigator.share` FAYL bilan, BIR MARTA chaqiriladi", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["fake-image-bytes"], { type: "image/jpeg" }),
    });
    const { shareMock } = stubNavigator();

    await shareProductAsPost(product, "seller1");

    expect(shareMock).toHaveBeenCalledTimes(1);
    const arg = shareMock.mock.calls[0][0];
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.url).toBeUndefined();
    expect(arg.text).toContain("Krem");
  });

  test("rasm fetch qilinmasa (tarmoq/CORS xatosi), JIM qolib matn+havola bilan ulashadi", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("CORS xatosi"));
    const { shareMock } = stubNavigator();

    await expect(shareProductAsPost(product, "seller1")).resolves.not.toThrow();

    expect(shareMock).toHaveBeenCalledTimes(1);
    const arg = shareMock.mock.calls[0][0];
    expect(arg.files).toBeUndefined();
    expect(arg.url).toBeTruthy();
  });

  test("`navigator.canShare({files})` false qaytarsa, rasmsiz (matn+url) ulashadi", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["fake-image-bytes"], { type: "image/jpeg" }),
    });
    const { shareMock } = stubNavigator({ canShare: vi.fn().mockReturnValue(false) });

    await shareProductAsPost(product, "seller1");

    expect(shareMock).toHaveBeenCalledTimes(1);
    const arg = shareMock.mock.calls[0][0];
    expect(arg.files).toBeUndefined();
    expect(arg.url).toBeTruthy();
  });

  test("`product.image` bo'lmasa, fetch UMUMAN chaqirilmaydi, to'g'ridan-to'g'ri matn+url bilan ulashadi", async () => {
    globalThis.fetch = vi.fn();
    const { shareMock } = stubNavigator();

    await shareProductAsPost({ ...product, image: null }, "seller1");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock.mock.calls[0][0].files).toBeUndefined();
  });

  test("foydalanuvchi ulashish oynasini bekor qilsa, IKKINCHI marta oyna qayta OCHILMAYDI", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["fake-image-bytes"], { type: "image/jpeg" }),
    });
    const shareMock = vi.fn().mockRejectedValue(new DOMException("Abort", "AbortError"));
    stubNavigator({ share: shareMock });

    await expect(shareProductAsPost(product, "seller1")).resolves.not.toThrow();
    expect(shareMock).toHaveBeenCalledTimes(1);
  });

  test("`navigator.canShare` umuman mavjud emas (eski qurilma) - rasmsiz ulashadi, fetch chaqirilmaydi", async () => {
    globalThis.fetch = vi.fn();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    setGlobalNavigator({ share: shareMock });

    await shareProductAsPost(product, "seller1");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock.mock.calls[0][0].url).toBeTruthy();
  });
});
