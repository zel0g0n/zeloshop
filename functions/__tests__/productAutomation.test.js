const { _testables } = require("../productAutomation");
const { buildProductChannelPost, buildCouponChannelPost, categoryToHashtag, escapeHtml } = _testables;

/**
 * `postToConnectedChannel` Firestore (`db`) va tarmoq (`fetch`) bilan
 * ishlaydi - shuning uchun uni sinash uchun ALOHIDA, mocklangan modul
 * nusxasi kerak (`heroImage.test.js`dagi bilan bir xil naqsh) - yuqoridagi,
 * sof funksiyalarni sinovdan o'tkazuvchi oddiy `require` bilan
 * ARALASHTIRILMAYDI.
 */
function loadModuleWithMocks({ sellerData = { aiCeoEnabled: true }, customBotData = { botToken: "tok123", connectedChannelUsername: "@mychannel" }, fetchMock } = {}) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    db: {
      collection: (name) => {
        if (name === "sellers") {
          return {
            doc: () => ({
              get: async () => ({ exists: sellerData !== null, data: () => sellerData || {} }),
              collection: (sub) => {
                if (sub === "private") {
                  return {
                    doc: () => ({
                      get: async () => ({ exists: customBotData !== null, data: () => customBotData || {} }),
                    }),
                  };
                }
                throw new Error(`Kutilmagan sub-kolleksiya: ${sub}`);
              },
            }),
          };
        }
        throw new Error(`Kutilmagan kolleksiya: ${name}`);
      },
    },
    BOT_TOKEN: { value: () => "mock-bot-token" },
  }));
  jest.doMock("../lib/helpers", () => ({
    buildDeepLink: () => "https://t.me/mock/app?startapp=mock",
    // Standart holatda `null` qaytaradi (sotuvchi shaxsiy bot
    // ulamagan holatni simulyatsiya qiladi) - shunda `postToConnectedChannel`
    // `buildDeepLink` zaxirasiga o'tishi kerak. Sellerning shaxsiy
    // boti ulangan holatni sinash uchun `customBotUsername`li
    // `sellerData` bilan alohida test bor (pastga qarang).
    buildSellerBotDeepLink: (botUsername) => (botUsername ? `https://t.me/${botUsername}?start=pmock` : null),
  }));
  jest.doMock("../lib/sentry", () => ({
    withSentry: (fn) => fn,
    SENTRY_DSN: { value: () => "mock-dsn" },
    initSentry: jest.fn(),
    Sentry: { captureException: jest.fn() },
  }));
  global.fetch = fetchMock || jest.fn();
  return require("../productAutomation");
}

describe("categoryToHashtag", () => {
  test("oddiy bir so'zli kategoriyani to'g'ri hashtag'ga aylantiradi", () => {
    expect(categoryToHashtag("Skincare")).toBe("#Skincare");
  });

  test("bo'sh joyli kategoriyadan bo'sh joyni olib tashlaydi", () => {
    expect(categoryToHashtag("Erkaklar kiyimi")).toBe("#Erkaklarkiyimi");
  });

  test("bo'sh/null kategoriya uchun bo'sh qator qaytaradi", () => {
    expect(categoryToHashtag(null)).toBe("");
    expect(categoryToHashtag("")).toBe("");
  });

  test("juda uzun kategoriya nomini qisqartiradi", () => {
    const long = "a".repeat(50);
    const result = categoryToHashtag(long);
    expect(result.length).toBeLessThanOrEqual(31); // "#" + 30 belgi
  });
});

describe("buildProductChannelPost", () => {
  test("chegirmasiz mahsulot uchun to'g'ri post quradi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, category: "Skincare" });
    expect(post).toContain("Krem");
    expect(post).toContain("100,000 so'm");
    expect(post).toContain("#Skincare");
    expect(post).not.toContain("avvalgi narx");
  });

  test("chegirmali mahsulot uchun ESKI va YANGI narxni ko'rsatadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, discountPrice: 70_000, category: "Skincare" });
    expect(post).toContain("70,000 so'm");
    expect(post).toContain("100,000 so'm");
    expect(post).toContain("avvalgi narx");
  });

  // 2026-09 (foydalanuvchi savoli: "nega tavsif to'liq ko'rinmayabdi"):
  // ILGARI bu yerda tavsif o'zboshimcha 150 belgiga qisqartirilardi -
  // bu Telegram'ning haqiqiy cheklovi EMAS edi (haqiqiy limit -
  // `postToConnectedChannel`dagi 1024 belgi, pastdagi alohida testga
  // qarang). Endi `buildProductChannelPost`ning o'zi tavsifni HECH
  // QACHON kesmaydi - shuning uchun bu test ENDI "kesmaydi"ni tekshiradi,
  // ilgarigi "kesadi"ning teskarisi.
  test("tavsif uzun bo'lsa ham, buildProductChannelPost o'zi KESMAYDI (haqiqiy limit faqat Telegram'ga yuborishdan oldin qo'llanadi)", () => {
    const longDesc = "a".repeat(300);
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, description: longDesc });
    expect(post).toContain(longDesc);
    expect(post).not.toContain("...");
  });

  test("kategoriya bo'lmasa, hashtag qo'shmaydi (xato bermaydi)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).toBeTruthy();
    expect(post).not.toContain("#");
  });

  // YANGI (foydalanuvchi so'ragan): zaxira soni ("nechta dona bor").
  test("`stock` berilgan bo'lsa, zaxira sonini qatorga qo'shadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 12 });
    expect(post).toContain("Zaxirada: 12 dona");
  });

  test("`stock` 0 bo'lsa HAM ko'rsatadi (0 - HAQIQIY qiymat, 'falsy' deb o'tkazib yubormaslik kerak)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 0 });
    expect(post).toContain("Zaxirada: 0 dona");
  });

  test("`stock` berilmagan/noto'g'ri bo'lsa, zaxira qatorini QO'SHMAYDI", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).not.toContain("Zaxirada");
    const post2 = buildProductChannelPost({ name: "Krem", price: 100_000, stock: "noto'g'ri" });
    expect(post2).not.toContain("Zaxirada");
  });
});

/**
 * 2026-09, foydalanuvchi yubordagi "sotuvga qaratilgan post" andozasi
 * asosida qo'shildi — LEKIN faqat MAHSULOT MA'LUMOTIDAN HAQIQATAN
 * hisoblab chiqarsa bo'ladigan qismlar (foydalanuvchi ANIQ shunday
 * tanladi: "Faqat stil/uslub — HAMMA mahsulotga"). "Bepul yetkazib
 * berish", "qaytarish kafolati" kabi HAR doim to'g'ri bo'lishi
 * kafolatlanmaydigan da'volar ATAYLAB QO'SHILMAGAN.
 */
describe("buildProductChannelPost - sotuvga qaratilgan uslub (haqiqiy ma'lumotdan hisoblangan)", () => {
  test("chegirma bo'lsa, tejalgan summani ANIQ hisoblab ko'rsatadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, discountPrice: 70_000 });
    expect(post).toContain("Siz <b>30,000 so'm</b> tejaysiz!");
  });

  test("chegirma bo'lmasa, 'tejaysiz' qatori UMUMAN chiqmaydi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).not.toContain("tejaysiz");
  });

  test("chegirma bo'lsa, sarlavha emojisi 🔥 (aksiya hissi)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, discountPrice: 70_000 });
    expect(post.startsWith("🔥")).toBe(true);
  });

  test("chegirma bo'lmasa, sarlavha emojisi oddiy 🆕", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post.startsWith("🆕")).toBe(true);
  });

  test("zaxira 10 tadan kam/teng bo'lsa - urgentlik uslubi ('Faqat N ta qoldi!')", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 5 });
    expect(post).toContain("⏰ Omborda: Faqat <b>5</b> ta qoldi!");
    expect(post).not.toContain("Zaxirada");
  });

  test("zaxira 10 tadan ko'p bo'lsa - ODDIY uslub (yolg'on urgentlik YO'Q)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 50 });
    expect(post).toContain("📦 Zaxirada: 50 dona");
    expect(post).not.toContain("Faqat");
  });

  test("zaxira 0 bo'lsa - urgentlik uslubi EMAS (tugagan narsani 'faqat qoldi' deyish noto'g'ri)", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, stock: 0 });
    expect(post).toContain("📦 Zaxirada: 0 dona");
    expect(post).not.toContain("Faqat");
  });

  test("brend to'ldirilgan bo'lsa, kategoriya hashtagiga QO'SHIMCHA brend hashtagi ham chiqadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, category: "Kosmetika", attributes: { brand: "Xolio Cosmetics" } });
    expect(post).toContain("#Kosmetika #XolioCosmetics");
  });

  test("brend to'ldirilmagan bo'lsa, faqat kategoriya hashtagi chiqadi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, category: "Kosmetika" });
    expect(post).toContain("#Kosmetika");
    expect(post.match(/#/g).length).toBe(1);
  });
});

describe("buildCouponChannelPost", () => {
  test("foizli kuponni to'g'ri formatlaydi", () => {
    const post = buildCouponChannelPost({ code: "SALE20", discountType: "percent", discountValue: 20 });
    expect(post).toContain("SALE20");
    expect(post).toContain("20%");
  });

  test("belgilangan summali kuponni to'g'ri formatlaydi", () => {
    const post = buildCouponChannelPost({ code: "SAVE50K", discountType: "fixed", discountValue: 50_000 });
    expect(post).toContain("50,000 so'm chegirma");
  });

  test("muddat berilmasa, muddat qatorini qo'shmaydi", () => {
    const post = buildCouponChannelPost({ code: "SALE20", discountType: "percent", discountValue: 20 });
    expect(post).not.toContain("muddati");
  });
});

describe("escapeHtml", () => {
  test("HTML maxsus belgilarini (&, <, >) xavfsiz entity'larga aylantiradi", () => {
    expect(escapeHtml("5 < 10 & \"Q&A\" > 2")).toBe("5 &lt; 10 &amp; \"Q&amp;A\" &gt; 2");
  });

  test("null/undefined uchun bo'sh qator qaytaradi, xato bermaydi", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("buildProductChannelPost - HTML formatlash", () => {
  test("nom <b> teglari bilan o'ralgan va foydalanuvchi matni xavfsizlashtirilgan", () => {
    const post = buildProductChannelPost({ name: "Krem <script>", price: 100_000 });
    expect(post).toContain("<b>Krem &lt;script&gt;</b>");
    expect(post).not.toContain("<script>");
  });

  test("narx <b> teglari bilan o'ralgan", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).toContain("<b>100,000 so'm</b>");
  });
});

/**
 * 2026-09, foydalanuvchi savoli: "sotuvchi qo'shimcha xususiyatlarni
 * (brend, teri turi, hajm va h.k.) to'ldirgan bo'lsa-chi, shuni
 * hisobga oldingmi?" — bu javob: ILGARI YO'Q edi, endi qo'shildi.
 */
describe("buildProductChannelPost - attributes va variants", () => {
  test("to'ldirilgan attributes bo'lsa, o'zbekcha yorliqlar bilan BITTA qatorga jamlanadi", () => {
    const post = buildProductChannelPost({
      name: "Krem",
      price: 100_000,
      attributes: { brand: "Xolio Cosmetics", gender: "women", volume: "120gr" },
    });
    expect(post).toContain("📋 Brend: Xolio Cosmetics · Jins: Ayol · Hajm: 120gr");
  });

  test("attributes bo'sh/berilmagan bo'lsa, mos qator UMUMAN qo'shilmaydi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post).not.toContain("📋");
  });

  test("variants bo'lsa, vergul bilan ajratilgan holda ko'rsatiladi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, variants: ["Qizil rang", "Qora rang"] });
    expect(post).toContain("🎨 Variantlar: Qizil rang, Qora rang");
  });

  test("variants bo'sh massiv/berilmagan bo'lsa, mos qator UMUMAN qo'shilmaydi", () => {
    const post1 = buildProductChannelPost({ name: "Krem", price: 100_000, variants: [] });
    const post2 = buildProductChannelPost({ name: "Krem", price: 100_000 });
    expect(post1).not.toContain("Variantlar");
    expect(post2).not.toContain("Variantlar");
  });

  test("attributes qiymatlaridagi HTML maxsus belgilar xavfsizlashtiriladi", () => {
    const post = buildProductChannelPost({ name: "Krem", price: 100_000, attributes: { brand: "A&B <Co>" } });
    expect(post).toContain("Brend: A&amp;B &lt;Co&gt;");
    expect(post).not.toContain("<Co>");
  });
});

/**
 * 2026-09, foydalanuvchi so'rovi: mahsulot qo'shilganda kanalga
 * yuborilgan postda mahsulotning BARCHA rasmlari (faqat bitta asosiy
 * rasm emas) BITTA postda ko'rinishi kerak. ASOSIY E'TIBOR: (1) 2+
 * rasm bo'lsa Telegram albom (`sendMediaGroup`) ishlatiladi, izoh
 * FAQAT birinchi elementda, (2) Telegram albomga tugma (`reply_markup`)
 * qo'sha OLMAYDI - shuning uchun tugma ALOHIDA, qisqa xabar sifatida
 * albomdan KEYIN yuboriladi, (3) bitta rasm bo'lsa ESKI, oddiy
 * `sendPhoto` (bitta so'rov, tugma bilan birga) ishlatilishda qoladi,
 * (4) kanal ulanmagan/aiCeoEnabled=false bo'lsa - fetch UMUMAN
 * chaqirilmaydi.
 */
describe("postToConnectedChannel", () => {
  test("aiCeoEnabled=false sotuvchi uchun - fetch chaqirmaydi", async () => {
    const fetchMock = jest.fn();
    const { _testables: t } = loadModuleWithMocks({ sellerData: { aiCeoEnabled: false }, fetchMock });
    await t.postToConnectedChannel("s1", { caption: "test" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("kanal ulanmagan bo'lsa - fetch chaqirmaydi", async () => {
    const fetchMock = jest.fn();
    const { _testables: t } = loadModuleWithMocks({ customBotData: null, fetchMock });
    await t.postToConnectedChannel("s1", { caption: "test" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("2+ rasm bo'lsa - sendMediaGroup (barcha rasm, izoh FAQAT birinchisida) va keyin tugma xabari yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });

    await t.postToConnectedChannel("s1", {
      caption: "<b>Krem</b>",
      images: ["https://img.com/1.jpg", "https://img.com/2.jpg", "https://img.com/3.jpg"],
      productPath: "/product/1",
      parseMode: "HTML",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [albumUrl, albumOpts] = fetchMock.mock.calls[0];
    expect(albumUrl).toContain("/sendMediaGroup");
    const albumBody = JSON.parse(albumOpts.body);
    expect(albumBody.media.length).toBe(3);
    expect(albumBody.media[0]).toMatchObject({ type: "photo", media: "https://img.com/1.jpg", caption: "<b>Krem</b>", parse_mode: "HTML" });
    expect(albumBody.media[1]).toEqual({ type: "photo", media: "https://img.com/2.jpg" });
    expect(albumBody.media[2]).toEqual({ type: "photo", media: "https://img.com/3.jpg" });
    expect(albumBody.reply_markup).toBeUndefined();

    const [btnUrl, btnOpts] = fetchMock.mock.calls[1];
    expect(btnUrl).toContain("/sendMessage");
    const btnBody = JSON.parse(btnOpts.body);
    // MUHIM: sotuvchi shaxsiy bot ulamagan (standart mock) - shuning
    // uchun ZeloShop'ning umumiy boti (`buildDeepLink` zaxirasi)
    // ishlatiladi. Matn ENDI bo'sh "👆" belgi EMAS - haqiqiy, mazmunli
    // chaqiruv matni (foydalanuvchi buni "keraksiz stiker" deb
    // ta'riflagan edi).
    expect(btnBody.text).toBe("🛒 Sotib olish uchun pastdagi tugmani bosing:");
    expect(btnBody.reply_markup).toEqual({ inline_keyboard: [[{ text: "🛒 Sotib olish", url: "https://t.me/mock/app?startapp=mock" }]] });
  });

  test("sotuvchi shaxsiy botini ulagan bo'lsa - tugma ZeloShop umumiy boti EMAS, sotuvchining O'Z boti orqali ochiladi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({
      sellerData: { aiCeoEnabled: true, customBotUsername: "mening_shopim_bot" },
      fetchMock,
    });

    await t.postToConnectedChannel("s1", {
      caption: "matn",
      images: ["https://img.com/1.jpg"],
      productPath: "/product/1",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe("https://t.me/mening_shopim_bot?start=pmock");
  });

  test("2+ rasm, lekin productPath berilmagan bo'lsa - FAQAT albom yuboradi, ikkinchi (tugma) xabar YO'Q", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });

    await t.postToConnectedChannel("s1", { caption: "matn", images: ["https://img.com/1.jpg", "https://img.com/2.jpg"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/sendMediaGroup");
  });

  test("bitta rasm bo'lsa - ESKI xatti-harakat: bitta sendPhoto so'rovi, tugma bilan birga", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });

    await t.postToConnectedChannel("s1", {
      caption: "matn",
      images: ["https://img.com/1.jpg"],
      productPath: "/product/1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/sendPhoto");
    const body = JSON.parse(opts.body);
    expect(body.photo).toBe("https://img.com/1.jpg");
    expect(body.reply_markup).toBeTruthy();
  });

  test("rasm umuman bo'lmasa - matnli sendMessage yuboradi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });

    await t.postToConnectedChannel("s1", { caption: "faqat matn" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/sendMessage");
    const body = JSON.parse(opts.body);
    expect(body.text).toBe("faqat matn");
  });

  test("10 tadan ortiq rasm berilsa, faqat birinchi 10 tasi albomga kiradi (Telegram cheklovi)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });
    const images = Array.from({ length: 14 }, (_, i) => `https://img.com/${i}.jpg`);

    await t.postToConnectedChannel("s1", { caption: "matn", images });

    const albumBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(albumBody.media.length).toBe(10);
  });

  // Telegram'ning HAQIQIY, o'zgarmas cheklovi (rasm/albom izohi uchun
  // maksimal 1024 belgi) - `buildProductChannelPost` endi tavsifni
  // o'zi kesmagani uchun (yuqoridagi testga qarang), bu chegara ENDI
  // FAQAT shu yerda, haqiqatan Telegram'ga yuborilayotganda qo'llanadi.
  test("izoh 1024 belgidan uzun bo'lsa, Telegram'ga yuborishdan oldin ANIQ 1024 belgiga qisqartiriladi", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const { _testables: t } = loadModuleWithMocks({ fetchMock });
    const longCaption = "a".repeat(1500);

    await t.postToConnectedChannel("s1", { caption: longCaption, images: ["https://img.com/1.jpg", "https://img.com/2.jpg"] });

    const albumBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(albumBody.media[0].caption.length).toBe(1024);
  });
});
