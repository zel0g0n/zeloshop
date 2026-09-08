/**
 * `products.js`dagi `generateSocialPost` uchun testlar.
 *
 * ASOSIY MAQSAD: bu — PREMIUM (AI CEO) funksiya, shuning uchun
 * `aiCeoEnabled !== true` bo'lgan sotuvchilar uchun Gemini so'rovi
 * HECH QACHON yuborilmasligini (xarajat nazorati) tasdiqlash - bu,
 * server tomonidagi eng muhim xavfsizlik/xarajat chegarasi.
 */

function buildMockDb({ sellerData = null } = {}) {
  return {
    collection: (name) => {
      if (name === "sellers") {
        return {
          doc: () => ({
            get: async () => (sellerData ? { exists: true, data: () => sellerData } : { exists: false }),
          }),
        };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
    // `checkRateLimit` ichkarida shu orqali ishlaydi - testlarda
    // hech qachon chegaraga tegmasligi uchun har doim "yangi oyna"
    // sifatida ishlov beramiz.
    runTransaction: async (callback) => callback({ get: async () => ({ exists: false }), set: () => {} }),
  };
}

function loadModule(db, generateContentMock, checkRateLimitMock) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: { firestore: { FieldValue: { increment: (n) => ({ __increment: n }) } } },
    db,
    GEMINI_API_KEY: { value: () => "mock-gemini-key" },
  }));
  jest.doMock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock },
    })),
  }));
  if (checkRateLimitMock) {
    jest.doMock("../lib/rateLimit", () => ({ checkRateLimit: checkRateLimitMock }));
  }
  return require("../products");
}

const baseRequest = (overrides = {}) => ({
  auth: { uid: "seller-1" },
  data: { productName: "Test krem", platform: "instagram", ...overrides },
});

describe("generateSocialPost", () => {
  test("tizimga kirmagan foydalanuvchi rad etiladi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadModule(buildMockDb(), genContent);
    await expect(_testables.handleGenerateSocialPost({ auth: null, data: {} })).rejects.toThrow();
    expect(genContent).not.toHaveBeenCalled();
  });

  test("aiCeoEnabled=false bo'lgan sotuvchi rad etiladi, Gemini UMUMAN chaqirilmaydi", async () => {
    const genContent = jest.fn();
    const db = buildMockDb({ sellerData: { aiCeoEnabled: false } });
    const { _testables } = loadModule(db, genContent);

    await expect(_testables.handleGenerateSocialPost(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("aiCeoEnabled maydoni umuman yo'q (aniqlanmagan) sotuvchi ham rad etiladi", async () => {
    const genContent = jest.fn();
    const db = buildMockDb({ sellerData: { storeName: "Do'kon" } }); // aiCeoEnabled yo'q
    const { _testables } = loadModule(db, genContent);

    await expect(_testables.handleGenerateSocialPost(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("sotuvchi hujjati umuman topilmasa ham rad etiladi", async () => {
    const genContent = jest.fn();
    const db = buildMockDb({ sellerData: null });
    const { _testables } = loadModule(db, genContent);

    await expect(_testables.handleGenerateSocialPost(baseRequest())).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("aiCeoEnabled=true bo'lgan sotuvchi uchun Gemini chaqiriladi va post matni qaytariladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Ajoyib krem! #toshkent #onlayndokon" });
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadModule(db, genContent);

    const result = await _testables.handleGenerateSocialPost(baseRequest());

    expect(genContent).toHaveBeenCalledTimes(1);
    expect(result.postText).toBe("Ajoyib krem! #toshkent #onlayndokon");
  });

  // "AVTO-TO'LDIRISH ISHLAMAYABDI / Failed to fetch" TUZATISHI
  // (2026-09): mijoz endi rasm URL'ini (`imageUrl`) yuboradi (rasm
  // ALLAQACHON Storage'da bo'lganda - CORS'ga bog'liq client-side
  // `fetch()` o'rniga), backend esa `resolveImageBase64` orqali uni
  // SERVERDAN yuklab, Gemini'ga rasm bilan birga yuboradi.
  test("imageUrl berilsa (imageBase64 EMAS) - backend rasmni o'zi yuklab, Gemini'ga rasm bilan birga yuboradi", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("fake-image-bytes"),
      headers: { get: () => "image/png" },
    });
    try {
      const genContent = jest.fn().mockResolvedValue({ text: "Ajoyib krem! #toshkent" });
      const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
      const { _testables } = loadModule(db, genContent);

      const result = await _testables.handleGenerateSocialPost(
        baseRequest({ imageUrl: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.png?alt=media" })
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.postText).toBe("Ajoyib krem! #toshkent");
      const sentParts = genContent.mock.calls[0][0].contents[0].parts;
      expect(sentParts[1].inlineData).toEqual({ mimeType: "image/png", data: Buffer.from("fake-image-bytes").toString("base64") });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("imageUrl ishonchsiz (Storage bo'lmagan) domendan bo'lsa - rasm e'tiborsiz qoldiriladi, lekin post baribir yaratiladi", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    try {
      const genContent = jest.fn().mockResolvedValue({ text: "Post matni (rasmsiz)" });
      const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
      const { _testables } = loadModule(db, genContent);

      const result = await _testables.handleGenerateSocialPost(baseRequest({ imageUrl: "https://evil.com/x.png" }));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.postText).toBe("Post matni (rasmsiz)");
      expect(genContent.mock.calls[0][0].contents).not.toEqual(expect.any(Array));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("mahsulot nomi bo'lmasa, premium bo'lsa ham rad etiladi", async () => {
    const genContent = jest.fn();
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true } });
    const { _testables } = loadModule(db, genContent);

    await expect(_testables.handleGenerateSocialPost(baseRequest({ productName: "" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("15-NICHE: sotuvchining O'Z Firestore hujjatidagi (category) niche kontekstisi promptga qo'shiladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Post matni" });
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, category: "Avto ehtiyot qismlari" } });
    const { _testables } = loadModule(db, genContent);

    await _testables.handleGenerateSocialPost(baseRequest());

    const sentPrompt = genContent.mock.calls[0][0].contents;
    expect(sentPrompt).toContain("avto ehtiyot qismlari");
  });

  test("MUHIM (xavfsizlik): client so'rovida yuborilgan nicheId E'TIBORGA OLINMAYDI - faqat sotuvchining O'Z hujjatidan olinadi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Post matni" });
    const db = buildMockDb({ sellerData: { aiCeoEnabled: true, category: "Kosmetika" } });
    const { _testables } = loadModule(db, genContent);

    // Client "Elektronika" deb yuborishga urinadi - lekin bu e'tiborsiz qoldirilishi kerak.
    await _testables.handleGenerateSocialPost(baseRequest({ nicheId: "Elektronika" }));

    const sentPrompt = genContent.mock.calls[0][0].contents;
    expect(sentPrompt).toContain("go'zallik va kosmetika");
    expect(sentPrompt).not.toContain("elektronika va gadjetlar");
  });
});

describe("buildDescriptionPrompt (15-NICHE: har qanday sohaga mos, hech qachon o'ylab topmaslik qoidasi)", () => {
  test("nom va kategoriyani promptga to'g'ri kiritadi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("Qora krem, 50ml", "Yuz parvarishi", false);
    expect(prompt).toContain("Qora krem, 50ml");
    expect(prompt).toContain("Yuz parvarishi");
  });

  test("kategoriya berilmasa, xato bermaydi va 'Kategoriya:' qatorini qo'shmaydi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("iPhone 15", null, false);
    expect(prompt).not.toContain("Kategoriya:");
  });

  test("MUHIM: tarkib/texnik xususiyat/moslik/kafolat/sog'liq da'vosini o'ylab topmaslik qoidasi HAR DOIM (niche'dan qat'i nazar) promptda bo'ladi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("Smartfon X", "Smartfonlar", false);
    expect(prompt).toContain("HECH QACHON o'ylab topma");
    expect(prompt.toLowerCase()).toContain("moslik");
    expect(prompt.toLowerCase()).toContain("kafolat");
  });

  test("rasm mavjud bo'lsa, rasmga tayanish ko'rsatmasi qo'shiladi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("Krem", "Kosmetika", true);
    expect(prompt).toContain("RASMga qarab");
    expect(prompt).toContain("Rasmda haqiqatan ko'rinib turgan");
  });

  test("15-NICHE: nicheId berilsa, o'sha niche'ning aiContext'i promptga qo'shiladi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("Tormoz kolodkasi", "Tormozlar", false, "Avto ehtiyot qismlari");
    expect(prompt).toContain("avto ehtiyot qismlari");
  });

  test("15-NICHE: nicheId berilmasa ham xato bermaydi (xavfsiz 'Boshqa' zaxirasi ishlatiladi)", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildDescriptionPrompt("Noma'lum mahsulot", null, false, undefined);
    expect(prompt).toContain("onlayn do'kon");
  });
});

describe("buildSocialPostPrompt (15-NICHE: sotuvchi sohasiga mos SMM konteksti)", () => {
  test("nicheId berilsa, o'sha niche'ning aiContext'i promptga qo'shiladi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildSocialPostPrompt("Krem", "Yumshoq krem", 50000, "Instagram uchun", "Kosmetika");
    expect(prompt).toContain("go'zallik va kosmetika");
  });

  test("boshqa niche uchun boshqa kontekst qo'shiladi (umumiy 'kichik onlayn do'kon' emas)", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const promptAuto = _testables.buildSocialPostPrompt("Tormoz kolodkasi", null, null, "Instagram uchun", "Avto ehtiyot qismlari");
    const promptToys = _testables.buildSocialPostPrompt("Konstruktor", null, null, "Instagram uchun", "O'yinchoqlar va xobbi");
    expect(promptAuto).not.toBe(promptToys);
    expect(promptAuto).toContain("avto ehtiyot qismlari");
    expect(promptToys).toContain("o'yinchoqlar va xobbi");
  });

  test("nicheId noma'lum/berilmagan bo'lsa ham, xato bermaydi (xavfsiz zaxira kontekst ishlatiladi)", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildSocialPostPrompt("Mahsulot", null, null, "Instagram uchun", undefined);
    expect(prompt).toContain("onlayn do'kon");
  });

  test("narx va tavsif berilsa, promptga kiritiladi", () => {
    const { _testables } = loadModule(buildMockDb(), jest.fn());
    const prompt = _testables.buildSocialPostPrompt("Krem", "Ajoyib tavsif", 75000, "TikTok uchun", "Kosmetika");
    expect(prompt).toContain("Ajoyib tavsif");
    expect(prompt).toContain("75");
  });
});

describe("handleGenerateProductDescription", () => {
  test("tizimga kirmagan foydalanuvchini rad etadi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadModule(buildMockDb(), genContent);
    await expect(_testables.handleGenerateProductDescription({ auth: null, data: {} })).rejects.toThrow();
    expect(genContent).not.toHaveBeenCalled();
  });

  test("mahsulot nomi bo'lmasa rad etadi, Gemini chaqirilmaydi", async () => {
    const genContent = jest.fn();
    const { _testables } = loadModule(buildMockDb(), genContent);
    await expect(
      _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "" } })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("muvaffaqiyatli holatda, tavsif matnini qaytaradi (PREMIUM TALAB QILINMAYDI - barcha sotuvchilar uchun)", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Yumshoq va nam beruvchi krem." });
    const { _testables } = loadModule(buildMockDb(), genContent);
    const result = await _testables.handleGenerateProductDescription({
      auth: { uid: "seller-1" },
      data: { productName: "Qora krem", category: "Yuz parvarishi" },
    });
    expect(result.description).toBe("Yumshoq va nam beruvchi krem.");
    expect(genContent).toHaveBeenCalledTimes(1);
  });

  test("Gemini bo'sh javob bersa, xato tashlaydi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "" });
    const { _testables } = loadModule(buildMockDb(), genContent);
    await expect(
      _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "Krem" } })
    ).rejects.toMatchObject({ code: "internal" });
  });

  // XAVFSIZLIK (P2 fix, 2026-09 audit): bu funksiyada `aiCeoEnabled`
  // premium darvozasi ATAYLAB yo'q (barcha sotuvchilar uchun bepul) —
  // shuning uchun ENG YOMON xarajat holatini chegaralash uchun,
  // soatlik chegaradan TASHQARI, alohida KUNLIK chegara ham qo'shildi.
  test("SOATLIK va KUNLIK ikkala chegara HAM tekshiriladi (ikkalasi ham alohida kalit bilan)", async () => {
    const checkRateLimitMock = jest.fn().mockResolvedValue(undefined);
    const genContent = jest.fn().mockResolvedValue({ text: "Tavsif matni." });
    const { _testables } = loadModule(buildMockDb(), genContent, checkRateLimitMock);

    await _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "Krem" } });

    expect(checkRateLimitMock).toHaveBeenCalledWith("generateProductDescription:seller-1", 20, 3600);
    expect(checkRateLimitMock).toHaveBeenCalledWith("generateProductDescriptionDaily:seller-1", expect.any(Number), 86400);
  });

  test("KUNLIK chegaradan oshgan bo'lsa (soatlik hali to'lmagan bo'lsa ham) — Gemini chaqirilmasdan rad etiladi", async () => {
    const checkRateLimitMock = jest.fn()
      .mockResolvedValueOnce(undefined) // soatlik — hali o'tadi
      .mockRejectedValueOnce(Object.assign(new Error("kunlik chegaradan oshdi"), { code: "resource-exhausted" })); // kunlik — oshgan
    const genContent = jest.fn();
    const { _testables } = loadModule(buildMockDb(), genContent, checkRateLimitMock);

    await expect(
      _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "Krem" } })
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(genContent).not.toHaveBeenCalled();
  });

  test("15-NICHE: sotuvchining O'Z Firestore hujjatidagi (category) niche kontekstisi promptga qo'shiladi", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Tormoz uchun ishonchli tavsif." });
    const db = buildMockDb({ sellerData: { category: "Avto ehtiyot qismlari" } });
    const { _testables } = loadModule(db, genContent);

    await _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "Tormoz kolodkasi" } });

    const sentPrompt = genContent.mock.calls[0][0].contents;
    expect(sentPrompt).toContain("avto ehtiyot qismlari");
  });

  // "AVTO-TO'LDIRISH ISHLAMAYABDI / Failed to fetch" TUZATISHI
  // (2026-09) - `generateSocialPost`dagi bilan bir xil tuzatish, bu
  // yerda ham (mahsulotni TAHRIRLASH sahifasida "Avto-to'ldirish"
  // tugmasi aynan shu funksiyani chaqiradi).
  test("imageUrl berilsa (imageBase64 EMAS) - backend rasmni o'zi yuklab, Gemini'ga rasm bilan birga yuboradi", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: async () => Buffer.from("fake-image-bytes"),
      headers: { get: () => "image/png" },
    });
    try {
      const genContent = jest.fn().mockResolvedValue({ text: "Yumshoq krem." });
      const { _testables } = loadModule(buildMockDb(), genContent);

      const result = await _testables.handleGenerateProductDescription({
        auth: { uid: "seller-1" },
        data: { productName: "Krem", imageUrl: "https://firebasestorage.googleapis.com/v0/b/commerce-zelo.appspot.com/o/products%2Fimg.png?alt=media" },
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.description).toBe("Yumshoq krem.");
      const sentParts = genContent.mock.calls[0][0].contents[0].parts;
      expect(sentParts[1].inlineData).toEqual({ mimeType: "image/png", data: Buffer.from("fake-image-bytes").toString("base64") });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("15-NICHE: sotuvchi hujjati topilmasa ham, xatosiz ishlaydi ('Boshqa' zaxirasi bilan)", async () => {
    const genContent = jest.fn().mockResolvedValue({ text: "Oddiy tavsif." });
    const { _testables } = loadModule(buildMockDb({ sellerData: null }), genContent);

    const result = await _testables.handleGenerateProductDescription({ auth: { uid: "seller-1" }, data: { productName: "Mahsulot" } });

    expect(result.description).toBe("Oddiy tavsif.");
  });
});

describe("handleProductDiscountCounterWrite (Z-Tariflar 'aksiya' hisoblagichi)", () => {
  function buildCounterMockDb() {
    const setCalls = [];
    return {
      __setCalls: setCalls,
      collection: (name) => {
        if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
        return { doc: (id) => ({ set: async (data, opts) => setCalls.push({ id, data, opts }) }) };
      },
    };
  }

  function buildEvent({ before, after }) {
    return {
      data: {
        before: before === undefined ? undefined : { exists: before !== null, data: () => before },
        after: after === undefined ? undefined : { exists: after !== null, data: () => after },
      },
    };
  }

  test("YANGI mahsulot FAOL chegirma bilan yaratilsa - +1 qiladi", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(buildEvent({ before: null, after: { sellerId: "s1", discountPrice: 5000 } }));

    expect(db.__setCalls).toEqual([{ id: "s1", data: { activeDiscountCount: { __increment: 1 } }, opts: { merge: true } }]);
  });

  test("YANGI mahsulot chegirmasiz yaratilsa - hech narsa qilmaydi", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(buildEvent({ before: null, after: { sellerId: "s1", discountPrice: null } }));

    expect(db.__setCalls).toHaveLength(0);
  });

  test("mavjud mahsulotga YANGI chegirma qo'shilsa (null -> qiymat) - +1 qiladi", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(
      buildEvent({ before: { sellerId: "s1", discountPrice: null }, after: { sellerId: "s1", discountPrice: 3000 } })
    );

    expect(db.__setCalls[0].data.activeDiscountCount).toEqual({ __increment: 1 });
  });

  test("chegirma OLIB TASHLANSA (qiymat -> null) - -1 qiladi", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(
      buildEvent({ before: { sellerId: "s1", discountPrice: 3000 }, after: { sellerId: "s1", discountPrice: null } })
    );

    expect(db.__setCalls[0].data.activeDiscountCount).toEqual({ __increment: -1 });
  });

  test("FAOL chegirma NARXI o'zgarsa (ikkalasi ham mavjud) - sonni O'ZGARTIRMAYDI", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(
      buildEvent({ before: { sellerId: "s1", discountPrice: 5000 }, after: { sellerId: "s1", discountPrice: 4000 } })
    );

    expect(db.__setCalls).toHaveLength(0);
  });

  test("FAOL chegirmali mahsulot O'CHIRILSA - -1 qiladi", async () => {
    const db = buildCounterMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleProductDiscountCounterWrite(buildEvent({ before: { sellerId: "s1", discountPrice: 5000 }, after: null }));

    expect(db.__setCalls[0].data.activeDiscountCount).toEqual({ __increment: -1 });
  });
});

describe("handleStockAuditLogWrite (ombor nazorati - zaxira harakati audit jurnali, 2026-09)", () => {
  function buildStockAuditMockDb() {
    const addCalls = [];
    return {
      __addCalls: addCalls,
      collection: (name) => {
        if (name !== "sellers") throw new Error(`Kutilmagan kolleksiya: ${name}`);
        return {
          doc: (sellerId) => ({
            collection: (subName) => {
              if (subName !== "stockAuditLog") throw new Error(`Kutilmagan quyi kolleksiya: ${subName}`);
              return { add: async (data) => addCalls.push({ sellerId, data }) };
            },
          }),
        };
      },
    };
  }

  function buildEvent({ before, after, productId = "p1" }) {
    return {
      params: { productId },
      data: {
        before: before === undefined ? undefined : { exists: before !== null, data: () => before },
        after: after === undefined ? undefined : { exists: after !== null, data: () => after },
      },
    };
  }

  test("QO'LDA tuzatish (sabab bilan) - to'g'ri sellerId ostiga, to'g'ri ma'lumot bilan yozadi", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleStockAuditLogWrite(buildEvent({
      before: { sellerId: "s1", name: "Krem", stock: 10 },
      after: { sellerId: "s1", name: "Krem", stock: 15, lastStockChangeReason: "restock" },
    }));

    expect(db.__addCalls).toHaveLength(1);
    expect(db.__addCalls[0].sellerId).toBe("s1");
    expect(db.__addCalls[0].data).toMatchObject({
      productId: "p1", productName: "Krem", oldStock: 10, newStock: 15, deltaQty: 5, reason: "restock",
    });
  });

  test("stock O'ZGARMAGAN yozuvda (masalan faqat narx o'zgargan) - jurnalga HECH NARSA yozmaydi", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleStockAuditLogWrite(buildEvent({
      before: { sellerId: "s1", name: "Krem", stock: 10, price: 50000 },
      after: { sellerId: "s1", name: "Krem", stock: 10, price: 60000 },
    }));

    expect(db.__addCalls).toHaveLength(0);
  });

  test("YANGI mahsulot yaratilganda (before yo'q) - jurnalga yozmaydi (yaratish bu jurnalning maqsadi emas)", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleStockAuditLogWrite(buildEvent({ before: null, after: { sellerId: "s1", name: "Krem", stock: 20 } }));

    expect(db.__addCalls).toHaveLength(0);
  });

  test("mahsulot O'CHIRILGANDA (after yo'q) - jurnalga yozmaydi", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleStockAuditLogWrite(buildEvent({ before: { sellerId: "s1", name: "Krem", stock: 20 }, after: null }));

    expect(db.__addCalls).toHaveLength(0);
  });

  test("BUYURTMA orqali (order_sale, orders.js'dan) - to'g'ri yoziladi", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await _testables.handleStockAuditLogWrite(buildEvent({
      before: { sellerId: "s1", name: "Krem", stock: 10 },
      after: {
        sellerId: "s1", name: "Krem", stock: 8,
        lastStockChangeReason: "order_sale", lastStockChangeOrderRef: "order-1", lastStockChangeOrderNumber: 7,
      },
    }));

    expect(db.__addCalls[0].data).toMatchObject({
      reason: "order_sale", orderRef: "order-1", orderNumber: 7, actorUid: null, deltaQty: -2,
    });
  });

  test("sellerId topilmasa (kutilmagan holat) - jurnalga yozmaydi (xato tashlamaydi)", async () => {
    const db = buildStockAuditMockDb();
    const { _testables } = loadModule(db, jest.fn());
    await expect(
      _testables.handleStockAuditLogWrite(buildEvent({ before: { stock: 10 }, after: { stock: 5 } }))
    ).resolves.toBeUndefined();

    expect(db.__addCalls).toHaveLength(0);
  });
});
