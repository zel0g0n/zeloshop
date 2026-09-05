/**
 * `lib/sentry.js` uchun to'g'ridan-to'g'ri testlar.
 *
 * NEGA BU FAYL KERAK EDI: `withSentry`/`initSentry` hozircha 35+
 * backend faylda (`onCall`/`onSchedule`/`onRequest` eksportlarini
 * o'rab) ishlatiladi, LEKIN har bir chaqiruvchi faylning o'z testida
 * `jest.mock("../lib/sentry", () => ({ withSentry: (fn) => fn, ... }))`
 * orqali modul TO'LIQ soxta bilan almashtirilgan (chunki haqiqiy
 * `@sentry/google-cloud-serverless` paketini yuklash va DSN sekretini
 * talab qilishi kerak emas edi) - natijada `lib/sentry.js`ning HAQIQIY
 * mantig'i (xato Sentry'ga yuborilishi, DSN bo'lmasa jim qolish,
 * `onRequest`ning ikkinchi argumenti - `res` - yo'qolib qolmasligi)
 * hech qayerda bevosita sinalmagan edi. Bu fayl aynan shu bo'shliqni
 * yopadi - `@sentry/google-cloud-serverless`ning faqat `init`/
 * `captureException` metodlari soxtalashtiriladi (haqiqiy tarmoq
 * so'rovi yubormaslik uchun), qolgan hamma narsa - `lib/sentry.js`ning
 * o'zi - HAQIQIY, o'ralmagan holda ishlaydi.
 */

describe("lib/sentry", () => {
  let sentryLib;
  let RealSentry;
  let initSpy;
  let captureSpy;

  beforeEach(() => {
    // Har bir testda modulni "toza holatda" qayta yuklaymiz - aks
    // holda `initialized` modul darajasidagi o'zgaruvchi testlar
    // orasida "sizib o'tib", keyingi testga noto'g'ri boshlang'ich
    // holat bilan ta'sir qilardi.
    jest.resetModules();
    sentryLib = require("../lib/sentry");
    RealSentry = require("@sentry/google-cloud-serverless");
    initSpy = jest.spyOn(RealSentry, "init").mockImplementation(() => {});
    captureSpy = jest.spyOn(RealSentry, "captureException").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("initSentry", () => {
    test("DSN sekret sozlanmagan (bo'sh) bo'lsa, Sentry.init umuman chaqirilmaydi", () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("");
      sentryLib.initSentry();
      expect(initSpy).not.toHaveBeenCalled();
    });

    test("DSN sozlangan bo'lsa, Sentry.init bir marta chaqiriladi", () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("https://fake@example.ingest.sentry.io/1");
      sentryLib.initSentry();
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ dsn: "https://fake@example.ingest.sentry.io/1" }));
    });

    test("ketma-ket bir necha marta chaqirilsa ham, Sentry.init faqat BIR marta ishga tushadi", () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("https://fake@example.ingest.sentry.io/1");
      sentryLib.initSentry();
      sentryLib.initSentry();
      sentryLib.initSentry();
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("withSentry", () => {
    test("muvaffaqiyatli holatda ichki handler natijasini o'zgarishsiz qaytaradi", async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true });
      const wrapped = sentryLib.withSentry(handler);
      await expect(wrapped({ auth: { uid: "seller1" } })).resolves.toEqual({ ok: true });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(captureSpy).not.toHaveBeenCalled();
    });

    test("`onRequest` kabi IKKITA argument (req, res) bilan chaqirilsa, ikkalasi ham handler'ga yetib boradi", async () => {
      // Bu, shu faylning yaratilish sababi bo'lgan haqiqiy xato -
      // eski (bitta argumentli) wrapper `res`ni yo'qotib qo'yardi.
      const handler = jest.fn().mockResolvedValue(undefined);
      const wrapped = sentryLib.withSentry(handler);
      const req = { body: { update_id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await wrapped(req, res);
      expect(handler).toHaveBeenCalledWith(req, res);
    });

    test("DSN sozlanmagan bo'lsa: xato qayta tashlanadi, lekin Sentry'ga yuborilmaydi", async () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("");
      const err = new Error("kutilmagan xato");
      const handler = jest.fn().mockRejectedValue(err);
      const wrapped = sentryLib.withSentry(handler);
      await expect(wrapped({})).rejects.toThrow("kutilmagan xato");
      expect(captureSpy).not.toHaveBeenCalled();
    });

    test("DSN sozlangan bo'lsa: xato Sentry'ga yuboriladi VA baribir qayta tashlanadi (asl xatti-harakat o'zgarmaydi)", async () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("https://fake@example.ingest.sentry.io/1");
      const err = new Error("onCall xatosi");
      const handler = jest.fn().mockRejectedValue(err);
      const wrapped = sentryLib.withSentry(handler);
      await expect(wrapped({ auth: { uid: "seller42" } })).rejects.toThrow("onCall xatosi");
      expect(captureSpy).toHaveBeenCalledWith(err, { extra: { uid: "seller42" } });
    });

    test("`auth` bo'lmagan chaqiruvda (onSchedule/onRequest kabi) uid `null` sifatida yuboriladi", async () => {
      jest.spyOn(sentryLib.SENTRY_DSN, "value").mockReturnValue("https://fake@example.ingest.sentry.io/1");
      const err = new Error("cron xatosi");
      const handler = jest.fn().mockRejectedValue(err);
      const wrapped = sentryLib.withSentry(handler);
      await expect(wrapped()).rejects.toThrow("cron xatosi");
      expect(captureSpy).toHaveBeenCalledWith(err, { extra: { uid: null } });
    });
  });
});
