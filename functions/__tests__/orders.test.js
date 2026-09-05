/**
 * `orders.js` (createOrder) uchun testlar.
 *
 * Bu — pul bilan bog'liq eng muhim funksiya: mijoz yuborgan narx/
 * chegirmaga ISHONMASDAN, HAQIQIY Firestore ma'lumotidan qayta
 * hisoblashini tekshiradi. Haqiqiy Firestore'ga ulanmaydi — Firestore
 * TRANSACTION'ning o'zi soddalashtirilgan holda taqlid qilinadi.
 */

// MUHIM: `lib/sentry.js`ni soxtalashtiramiz (batafsil izoh:
// `aiCeo.test.js`).
jest.mock("../lib/sentry", () => ({
  withSentry: (fn) => fn,
  SENTRY_DSN: { value: () => null },
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

/**
 * Yo'l (path) asosidagi soddalashtirilgan Firestore taqlidchisi.
 * `firestore.collection(a).doc(b).collection(c).doc(d)` kabi
 * zanjirlarni, va Transaction'ning get/set/update amallarini
 * qo'llab-quvvatlaydi.
 */
function buildMockFirestore({ products = {}, sellerData = null, coupons = {}, clientData = null, orderCounterValue = null, customerBotToken = null, customerRollupData = null, bundles = {} } = {}) {
  const setCalls = [];
  const updateCalls = [];
  const deleteCalls = [];
  let autoIdCounter = 0;

  function lookup(path) {
    // path masalan: ["products", "prod1"] yoki ["sellers", "s1", "coupons", "SALE10"]
    if (path[0] === "products" && path.length === 2) {
      const p = products[path[1]];
      return p ? { exists: true, id: path[1], data: () => p } : { exists: false, id: path[1] };
    }
    if (path[0] === "sellers" && path.length === 2) {
      return sellerData
        ? { exists: true, id: path[1], data: () => sellerData }
        : { exists: false, id: path[1] };
    }
    if (path[0] === "sellers" && path[2] === "coupons" && path.length === 4) {
      const c = coupons[path[3]];
      return c ? { exists: true, id: path[3], data: () => c } : { exists: false, id: path[3] };
    }
    if (path[0] === "sellers" && path[2] === "bundles" && path.length === 4) {
      const b = bundles[path[3]];
      return b ? { exists: true, id: path[3], data: () => b } : { exists: false, id: path[3] };
    }
    // Referal mukofoti xabarini yuborishda (v39.6, mijozga - aniqrog'i
    // TAKLIF QILUVCHIGA - ketadigan xabar) bot token'ini tanlash uchun
    // so'raladi. Standart holatda "custom bot yo'q" (umumiy BOT_TOKEN
    // ishlatiladi) taqlid qilinadi; `customerBotToken` berilsa, sotuvchi
    // shaxsiy bot ULAGAN holatni taqlid qiladi.
    if (path[0] === "sellers" && path[2] === "private" && path[3] === "customerBot") {
      return customerBotToken ? { exists: true, data: () => ({ botToken: customerBotToken }) } : { exists: false };
    }
    // Referal dasturi uchun - mijoz "kimdan taklif qilingan"ligini shu
    // yerdan bilib oladi.
    if (path[0] === "clients" && path.length === 2) {
      return clientData ? { exists: true, id: path[1], data: () => clientData } : { exists: false, id: path[1] };
    }
    // HAQIQIY, doimiy buyurtma tartib raqami uchun hisoblagich.
    if (path[0] === "sellers" && path[2] === "counters" && path[3] === "orders") {
      return orderCounterValue !== null
        ? { exists: true, data: () => ({ count: orderCounterValue }) }
        : { exists: false };
    }
    // Sodiqlik dasturi ("Bonus hisobi") - mijozning shu SOTUVCHIga
    // tegishli yig'ma hujjati, bonus balansi shu yerda.
    if (path[0] === "sellers" && path[2] === "customers" && path.length === 4) {
      return customerRollupData
        ? { exists: true, id: path[3], data: () => customerRollupData }
        : { exists: false };
    }
    return { exists: false };
  }

  function makeDocRef(path) {
    return {
      __path: path,
      id: path[path.length - 1],
      collection: (name) => makeCollectionRef([...path, name]),
      get: async () => lookup(path),
    };
  }
  function makeCollectionRef(path) {
    return {
      doc: (id) => makeDocRef([...path, id || `auto-id-${autoIdCounter++}`]),
      // MUHIM: `logNotification` (bildirishnoma jurnali) endi
      // `.add(...)` chaqiradi - bu metod avval bu yerda YO'Q edi.
      // Haqiqiy hujjat yaratish shart emas (testlar buni
      // tekshirmaydi), faqat kuzatuv uchun ro'yxatga qo'shamiz.
      add: async (data) => {
        const ref = makeDocRef([...path, `auto-id-${autoIdCounter++}`]);
        setCalls.push({ path: ref.__path, data });
        return ref;
      },
    };
  }

  const firestore = {
    collection: (name) => makeCollectionRef([name]),
    runTransaction: async (callback) => {
      const transaction = {
        get: async (ref) => lookup(ref.__path),
        set: (ref, data) => setCalls.push({ path: ref.__path, data }),
        update: (ref, data) => updateCalls.push({ path: ref.__path, data }),
        // MUHIM: `orders.js` endi buyurtma yaratilganda "tashlab
        // ketilgan savat" hujjatini `transaction.delete(...)` orqali
        // o'chiradi - bu metod avval bu yerda YO'Q edi, shuning
        // uchun HAR BIR test "transaction.delete is not a function"
        // xatosi bilan buzilardi. Haqiqiy Firestore'da mavjud
        // bo'lmagan hujjatni o'chirish xavfsiz (no-op) - bu yerda ham
        // xuddi shunday, faqat kuzatuv uchun ro'yxatga qo'shamiz.
        delete: (ref) => deleteCalls.push({ path: ref.__path }),
      };
      return callback(transaction);
    },
  };

  return { firestore, setCalls, updateCalls, deleteCalls };
}

function loadOrdersModule(firestore) {
  jest.resetModules();
  jest.doMock("../lib/admin", () => ({
    admin: {
      firestore: Object.assign(() => firestore, {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          increment: (n) => ({ __increment: n }),
          arrayUnion: (...values) => ({ __arrayUnion: values }),
        },
      }),
    },
    db: firestore,
    BOT_TOKEN: { value: () => "mock" },
    GEMINI_API_KEY: { value: () => "mock" },
  }));
  const sendTelegramMessage = jest.fn().mockResolvedValue(undefined);
  jest.doMock("../lib/helpers", () => ({ sendTelegramMessage }));
  const ordersModule = require("../orders");
  return { ...ordersModule, __mocks: { sendTelegramMessage } };
}

// YANGI (2026-09 punkt-royxati, 15-band): `createOrder` endi
// `customerData.deliveryTimeSlot`ni MAJBURIY tasdiqlaydi
// (`isValidDeliverySlot`, `lib/deliverySlots.js`) - testlar uchun
// standart (3 soatlik "oldindan buyurtma" - sotuvchi/mijoz hudud
// BERILMAGAN yoki BIR XIL bo'lgan holatlar uchun) va "boshqa hudud"
// (27 soat) YAROQLI oraliqlarni HAR SAFAR JORIY VAQTDAN hisoblab
// olamiz - qattiq belgilangan (statik) millisekund ishlatilmaydi,
// aks holda vaqt o'tishi bilan "eskirib" test buzilib qolardi.
const { generateDeliverySlots } = require("../lib/deliverySlots");
const [DEFAULT_SLOT] = generateDeliverySlots({ nowMs: Date.now(), minLeadHours: 3, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
const [OTHER_REGION_SLOT] = generateDeliverySlots({ nowMs: Date.now(), minLeadHours: 27, workingHoursOpen: "10:00", workingHoursClose: "19:00" });
const toDeliveryTimeSlot = (slot) => ({ start: slot.startMs, end: slot.endMs });

const baseCustomerData = { fullName: "Test Mijoz", phone: "+998901234567", deliveryTimeSlot: toDeliveryTimeSlot(DEFAULT_SLOT) };
const baseRequest = (overrides = {}) => ({
  auth: { uid: "client-1" },
  data: {
    sellerId: "seller-1",
    customerData: baseCustomerData,
    items: [{ productId: "prod-1", quantity: 2 }],
    ...overrides,
  },
});

describe("createOrder", () => {
  // YANGI (2026-09 punkt-royxati, 15-band): yetkazib berish vaqt
  // oralig'i endi MAJBURIY va SERVER tomonida yakuniy tasdiqlanadi -
  // mijoz (frontend) hisob-kitobiga ishonilmaydi.
  test("yetkazib berish vaqt oralig'i berilmasa - invalid-argument", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);
    await expect(
      _testables.handleCreateOrder(baseRequest({ customerData: { ...baseCustomerData, deliveryTimeSlot: null } }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("soxtalashtirilgan (juda erta, minimal 3 soatlik kutishga rioya qilmagan) vaqt oralig'i rad etiladi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);
    await expect(
      _testables.handleCreateOrder(baseRequest({
        customerData: { ...baseCustomerData, deliveryTimeSlot: { start: Date.now(), end: Date.now() + 3600000 } },
      }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("HAQIQIY mahsulot narxidan hisoblaydi — mijoz narx yubormaydi va yuborsa ham e'tiborga olinmaydi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    // 2 dona * 50,000 = 100,000 — mijoz boshqa narx "yuborgan" bo'lsa ham,
    // bu yerda HAQIQIY Firestore narxidan hisoblanadi (chunki mijoz
    // umuman narx yubormaydi — faqat ID va sonni).
    expect(result.totalAmount).toBe(100000);
    expect(result.subtotal).toBe(100000);
  });

  // REGRESSIYA TESTI (real P&L uchun yangi funksiya): har bir
  // buyurtma qatorining TANNARXI endi ALOHIDA, faqat sotuvchi o'qiy
  // oladigan `sellers/{id}/orderCosts/{orderId}` hujjatiga
  // yoziladi - `orders/{orderId}`ning O'ZIGA EMAS (xaridor buni
  // o'qiy olmasligi kerak, batafsil izoh: `orders.js`).
  test("tannarx (costPrice) suratini ALOHIDA, faqat sotuvchi o'qiydigan hujjatga yozadi - mijozga ko'rinadigan buyurtma qatoriga EMAS", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, costPrice: 20000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    const orderWrite = setCalls.find((c) => c.path.join("/") === `orders/${result.orderId}`);
    expect(orderWrite).toBeDefined();
    // Mijozga ham ko'rinadigan hujjatda costPrice UMUMAN bo'lmasligi kerak:
    expect(orderWrite.data.orders[0].costPrice).toBeUndefined();

    const costWrite = setCalls.find((c) => c.path.join("/") === `sellers/seller-1/orderCosts/${result.orderId}`);
    expect(costWrite).toBeDefined();
    expect(costWrite.data.items).toEqual([{ id: "prod-1", costPrice: 20000, quantity: 2 }]);
  });

  test("tasdiqlangan yetkazib berish vaqt oralig'i buyurtma hujjatiga saqlanadi (15-band)", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    const orderWrite = setCalls.find((c) => c.path.join("/") === `orders/${result.orderId}`);
    expect(orderWrite.data.deliveryTimeSlot).toEqual(toDeliveryTimeSlot(DEFAULT_SLOT));
  });

  test("hisoblagich hali mavjud bo'lmasa (birinchi buyurtma) - orderNumber 1 bo'ladi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
      orderCounterValue: null, // hisoblagich hali yaratilmagan
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.orderNumber).toBe(1);
  });

  test("hisoblagich mavjud bo'lsa (masalan 41 ta buyurtma bo'lgan) - keyingi buyurtma 42-raqamni oladi", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
      orderCounterValue: 41,
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.orderNumber).toBe(42);

    // MUHIM: hisoblagichning O'ZI ham 42ga YANGILANGANINI tasdiqlaymiz -
    // aks holda keyingi buyurtma xato raqam olardi.
    const counterUpdate = setCalls.find((c) => c.path.join("/") === "sellers/seller-1/counters/orders");
    expect(counterUpdate).toBeDefined();
    expect(counterUpdate.data.count).toBe(42);
  });

  test("orderNumber - 150 talik yuklash chegarasidan MUSTAQIL, sahifalashga bog'liq emas (haqiqiy, doimiy raqam)", async () => {
    // Bu test shuni tasdiqlaydi: hisoblagich 150dan HAM KATTA
    // qiymatdan boshlansa ham (masalan do'konda 500 ta buyurtma
    // bo'lsa), tizim to'g'ri ishlashda davom etadi - chunki raqam
    // HAR DOIM Firestore hujjatining o'zida saqlanadi, hech qanday
    // ro'yxat uzunligiga BOG'LIQ EMAS.
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
      orderCounterValue: 500,
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.orderNumber).toBe(501);
  });

  test("yetkazib berish: mijoz sotuvchi bilan BIR XIL hududda bo'lsa, 'sameCity' bosqichi narxi qo'llaniladi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {
        storeName: "Do'kon",
        region: "Xorazm",
        deliveryTiers: {
          sameCity: { price: 15000, days: "days1_2" },
          otherRegions: { price: 40000, days: "days3_5" },
        },
      },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({ customerRegion: "Xorazm" }));

    expect(result.deliveryZone.tier).toBe("sameCity");
    expect(result.deliveryZone.price).toBe(15000);
    expect(result.totalAmount).toBe(100000 + 15000);
  });

  test("yetkazib berish: mijoz BOSHQA viloyatda bo'lsa, 'otherRegions' bosqichi narxi qo'llaniladi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {
        storeName: "Do'kon",
        region: "Xorazm",
        deliveryTiers: {
          sameCity: { price: 15000, days: "days1_2" },
          otherRegions: { price: 40000, days: "days3_5" },
        },
      },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({
      customerRegion: "Andijon",
      // "Boshqa hudud" - minimal "oldindan buyurtma" vaqti 3 emas, 27
      // soat (15-band) - standart `baseCustomerData`dagi 3-soatlik
      // oraliq bu holatda ENDI YAROQSIZ, shuning uchun 27-soatlik
      // oraliq bilan ALMASHTIRILADI.
      customerData: { ...baseCustomerData, deliveryTimeSlot: toDeliveryTimeSlot(OTHER_REGION_SLOT) },
    }));

    expect(result.deliveryZone.tier).toBe("otherRegions");
    expect(result.deliveryZone.price).toBe(40000);
  });

  test("yetkazib berish: Toshkent shahri (sotuvchi) + Toshkent viloyati (mijoz) - 'sameRegionDistricts' bosqichi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {
        storeName: "Do'kon",
        region: "Toshkent shahri",
        deliveryTiers: {
          sameCity: { price: 10000, days: "days1_2" },
          sameRegionDistricts: { price: 20000, days: "days2_3" },
          otherRegions: { price: 40000, days: "days3_5" },
        },
      },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({ customerRegion: "Toshkent viloyati" }));

    expect(result.deliveryZone.tier).toBe("sameRegionDistricts");
    expect(result.deliveryZone.price).toBe(20000);
  });

  test("yetkazib berish: MIJOZ hech qanday narx yubormasa ham (faqat hudud), SERVER haqiqiy narxni O'ZI hisoblaydi - mijoz narx yubormaydi/yubora olmaydi", async () => {
    // Bu test - eng MUHIM xavfsizlik tekshiruvi: mijoz so'rovida
    // narx UMUMAN yo'q (faqat hudud nomi bor) - server buni HECH
    // QACHON ishonib qabul qilmaydi, har doim sotuvchining haqiqiy
    // sozlamasidan QAYTA hisoblaydi.
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {
        storeName: "Do'kon",
        region: "Xorazm",
        deliveryTiers: { sameCity: { price: 99999, days: "days1_2" } },
      },
    });
    const { _testables } = loadOrdersModule(firestore);
    const request = baseRequest({ customerRegion: "Xorazm" });
    // Mijoz so'rovida (haqiqiy ilovada bo'lmasligi kerak bo'lgan)
    // narx maydoni bo'lsa ham, SERVER buni E'TIBORGA OLMAYDI.
    request.data.deliveryFee = 1;

    const result = await _testables.handleCreateOrder(request);

    expect(result.deliveryZone.price).toBe(99999);
  });

  test("sotuvchi hech qanday hudud belgilamagan (region yo'q) bo'lsa, yetkazib berish narxi 0 bo'ladi, xato bermaydi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" }, // region yo'q
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({ customerRegion: "Xorazm" }));

    expect(result.deliveryZone).toBeNull();
    expect(result.totalAmount).toBe(100000);
  });

  test("ombor qoldig'ini KAMAYTIRADI va 'sotilganlar' sonini BIR VAQTDA oshiradi", async () => {
    const { firestore, updateCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest());

    // baseRequest() 2 dona buyurtma qiladi — ombor 10dan 8ga kamayishi,
    // "sotilganlar" esa 2ga OSHISHI kerak (avval bu SODIR BO'LMAS edi).
    const productUpdate = updateCalls.find((c) => c.path[0] === "products");
    expect(productUpdate.data.stock).toBe(8);
    expect(productUpdate.data.sold).toEqual({ __increment: 2 });
  });

  test("ZAXIRA HARAKATI AUDIT JURNALI (ombor nazorati): stock kamayishi 'order_sale' sababi VA buyurtma ID/raqami bilan belgilanadi", async () => {
    const { firestore, updateCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    // `functions/products.js`dagi `onProductWriteUpdateStockAudit`
    // trigger shu maydonlarni o'qib, `sellers/{id}/stockAuditLog`ga
    // avtomatik audit-yozuv qo'shadi (batafsil: `lib/stockAuditLog.js`).
    const productUpdate = updateCalls.find((c) => c.path[0] === "products");
    expect(productUpdate.data.lastStockChangeReason).toBe("order_sale");
    expect(typeof productUpdate.data.lastStockChangeOrderRef).toBe("string");
    expect(productUpdate.data.lastStockChangeOrderRef).toBeTruthy();
    expect(productUpdate.data.lastStockChangeOrderNumber).toBe(result.orderNumber);
  });

  test("'bugun sotildi' ijtimoiy isbot hisoblagichini (#119) TO'G'RI yangilaydi", async () => {
    const { firestore, updateCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10, soldTodayCount: 5, soldTodayDate: "2000-01-01" } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest());

    // Eski sana ("2000-01-01") bugungidan farqli - dangasa reset ishga
    // tushib, eski (5) e'tiborga olinmasdan, faqat shu buyurtmadagi
    // miqdor (2) bilan qayta boshlanishi kerak.
    const productUpdate = updateCalls.find((c) => c.path[0] === "products");
    expect(productUpdate.data.soldTodayCount).toBe(2);
    expect(productUpdate.data.soldTodayDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(productUpdate.data.soldTodayDate).not.toBe("2000-01-01");
  });

  test("buyurtma yaratilganda, mos savat hujjatini o'chirishga urinadi (tashlab ketilgan savat eslatmasi qayta ishga tushmasligi uchun)", async () => {
    const { firestore, deleteCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Do'kon" },
    });
    const { _testables } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest());

    // baseRequest() clientId="client-1", sellerId="seller-1" bilan
    // ishlaydi - savat hujjati ID'si shu ikkisidan tuziladi.
    const cartDelete = deleteCalls.find((c) => c.path.join("/") === "carts/seller-1_client-1");
    expect(cartDelete).toBeDefined();
  });

  test("chegirma narxi (discountPrice) mavjud bo'lsa, o'shani ishlatishi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, discountPrice: 40000, stock: 10 } },
      sellerData: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.totalAmount).toBe(80000); // 2 * 40,000
  });

  test("VAQTLI AKSIYA: chegirma muddati hali o'tmagan bo'lsa, chegirmali narxni ishlatishi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: {
        "prod-1": {
          sellerId: "seller-1", name: "Krem", price: 50000, discountPrice: 40000, stock: 10,
          discountExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 soatdan keyin tugaydi
        },
      },
      sellerData: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.totalAmount).toBe(80000); // 2 * 40,000
  });

  test("VAQTLI AKSIYA: chegirma muddati O'TGAN bo'lsa, TO'LIQ narxni ishlatishi kerak (eskirgan chegirma qo'llanmaydi)", async () => {
    const { firestore } = buildMockFirestore({
      products: {
        "prod-1": {
          sellerId: "seller-1", name: "Krem", price: 50000, discountPrice: 40000, stock: 10,
          discountExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 soat oldin tugagan
        },
      },
      sellerData: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest());

    expect(result.totalAmount).toBe(100000); // 2 * 50,000 (TO'LIQ narx)
  });

  test("ombor yetarli bo'lmasa, 'failed-precondition' xatosi bilan rad etishi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 1 } }, // faqat 1 ta bor
      sellerData: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    await expect(_testables.handleCreateOrder(baseRequest())).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  test("boshqa do'konning mahsuloti savatga tushib qolsa, rad etishi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "BOSHQA-DOKON", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    await expect(_testables.handleCreateOrder(baseRequest())).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  // 2026-09 punkt-royxati: to'lov turi endi MAHSULOT emas, SOTUVCHI
  // darajasida ("To'lovlar va Tariflar" sozlamasi, `sellers/{id}.
  // paymentTypes`) markazlashtirilgan. Quyidagi testlar mijoz
  // tanlagan `paymentMethod`ning albatta shu ro'yxatda bo'lishini,
  // aks holda serverning rad etishini tekshiradi (frontend UI'ni
  // chetlab, funksiyani to'g'ridan-to'g'ri chaqirishga qarshi himoya).
  describe("sotuvchining to'lov turi sozlamasi (paymentTypes)", () => {
    test("sotuvchi FAQAT 'cod' (naqd) yoqqan bo'lsa, 'karta orqali' (paymentMethod: card) urinishi rad etiladi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { paymentTypes: ["cod"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({
          customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "https://example.com/chek.jpg" },
        }))
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    test("sotuvchi FAQAT 'prepay' (karta) yoqqan bo'lsa, 'naqd' (paymentMethod: cash) urinishi rad etiladi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { paymentTypes: ["prepay"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({
          customerData: { ...baseCustomerData, paymentMethod: "cash" },
        }))
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    test("sotuvchi ikkalasini ham yoqqan bo'lsa, ikkala usul ham qabul qilinadi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { paymentTypes: ["cod", "prepay"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({ customerData: { ...baseCustomerData, paymentMethod: "cash" } }))
      ).resolves.toMatchObject({ orderId: expect.any(String) });

      await expect(
        _testables.handleCreateOrder(baseRequest({
          customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "https://example.com/chek.jpg" },
        }))
      ).resolves.toMatchObject({ orderId: expect.any(String) });
    });

    test("sotuvchi hali sozlamani tanlamagan bo'lsa (eski do'kon, `paymentTypes` yo'q) — standart FAQAT 'naqd' qabul qilinadi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: {}, // paymentTypes umuman yo'q
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({ customerData: { ...baseCustomerData, paymentMethod: "cash" } }))
      ).resolves.toMatchObject({ orderId: expect.any(String) });

      await expect(
        _testables.handleCreateOrder(baseRequest({
          customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "https://example.com/chek.jpg" },
        }))
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });
  });

  // SODIQLIK DASTURI ("Bonus hisobi"): mijoz oldingi buyurtmalaridan
  // yig'gan bonusini checkout'da ishlatishi mumkin - lekin
  // ko'rsatilgan miqdorga (`redeemBonusAmount`) ISHONILMAYDI, haqiqiy
  // balans/sotuvchi sozlamasi shu yerda, serverda qayta tekshiriladi.
  describe("sodiqlik dasturi (bonus) ishlatish", () => {
    test("sotuvchida YOQILGAN, mijozda YETARLI balans bo'lsa - bonus to'liq ishlatiladi va summa kamayadi", async () => {
      const { firestore, setCalls } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { loyaltyEnabled: true, loyaltyMaxRedeemPercent: 100 },
        customerRollupData: { bonusBalance: 20000 },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({ redeemBonusAmount: 15000 }));

      expect(result.bonusRedeemed).toBe(15000);
      expect(result.totalAmount).toBe(100000 - 15000); // 2 * 50,000 - 15,000

      const customerWrite = setCalls.find((c) => c.path.join("/") === "sellers/seller-1/customers/client-1");
      expect(customerWrite).toBeDefined();
      expect(customerWrite.data.bonusBalance).toEqual({ __increment: -15000 });

      const orderWrite = setCalls.find((c) => c.path.join("/") === `orders/${result.orderId}`);
      expect(orderWrite.data.loyaltyBonusRedeemed).toBe(15000);
      expect(orderWrite.data.loyaltyBonusEarnBase).toBe(100000 - 15000);
    });

    test("so'ralgan miqdor HAQIQIY balansdan katta bo'lsa - faqat mavjud balans miqdoricha ishlatiladi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { loyaltyEnabled: true, loyaltyMaxRedeemPercent: 100 },
        customerRollupData: { bonusBalance: 3000 },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({ redeemBonusAmount: 999999 }));

      expect(result.bonusRedeemed).toBe(3000); // balansdan oshmaydi
      expect(result.totalAmount).toBe(100000 - 3000);
    });

    test("sotuvchi belgilagan foiz chegarasidan (masalan 20%) oshib ketolmaydi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { loyaltyEnabled: true, loyaltyMaxRedeemPercent: 20 },
        customerRollupData: { bonusBalance: 100000 }, // balans yetarli, lekin chegara past
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({ redeemBonusAmount: 100000 }));

      // 100,000 (subtotal) ning 20% = 20,000
      expect(result.bonusRedeemed).toBe(20000);
      expect(result.totalAmount).toBe(100000 - 20000);
    });

    test("sotuvchida O'CHIRILGAN (`loyaltyEnabled` false/yo'q) bo'lsa - so'ralgan bonus HECH QACHON ishlatilmaydi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: {}, // loyaltyEnabled yo'q
        customerRollupData: { bonusBalance: 50000 },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({ redeemBonusAmount: 10000 }));

      expect(result.bonusRedeemed).toBe(0);
      expect(result.totalAmount).toBe(100000); // to'liq narx, chegirmasiz
    });

    test("bonus VA promokod BIRGA qo'llanishi mumkin (bir-birini istisno qilmaydi)", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { loyaltyEnabled: true, loyaltyMaxRedeemPercent: 100 },
        coupons: { SALE10: { isActive: true, discountType: "percent", discountValue: 10, usedCount: 0 } },
        customerRollupData: { bonusBalance: 10000 },
      });
      const { _testables } = loadOrdersModule(firestore);

      // subtotal 100,000 -> kupon 10% = -10,000 -> 90,000 -> bonus -10,000 -> 80,000
      const result = await _testables.handleCreateOrder(baseRequest({ couponCode: "SALE10", redeemBonusAmount: 10000 }));

      expect(result.discountAmount).toBe(10000);
      expect(result.bonusRedeemed).toBe(10000);
      expect(result.totalAmount).toBe(80000);
    });

    test("`redeemBonusAmount` berilmasa - hech narsa o'zgarmaydi (ixtiyoriy)", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { loyaltyEnabled: true },
        customerRollupData: { bonusBalance: 50000 },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest());

      expect(result.bonusRedeemed).toBe(0);
      expect(result.totalAmount).toBe(100000);
    });
  });

  // MAHSULOT BANDLLARI ("combo takliflar"): sotuvchi bir nechta
  // mahsulotni birlashtirib, maxsus jami narxda taklif qiladi.
  describe("mahsulot bandllari (combo takliflar)", () => {
    test("combo mahsulotlarining BARCHASI savatda bo'lsa - narx farqi to'g'ri chegirma sifatida qo'llanadi", async () => {
      const { firestore, setCalls } = buildMockFirestore({
        products: {
          "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 },
          "prod-2": { sellerId: "seller-1", name: "Sovun", price: 20000, stock: 10 },
        },
        sellerData: {},
        bundles: { "bundle-1": { productIds: ["prod-1", "prod-2"], bundlePrice: 60000, isActive: true, name: "Gigiyena to'plami" } },
      });
      const { _testables } = loadOrdersModule(firestore);

      // 2 dona prod-1 (2*50,000=100,000) + 1 dona prod-2 (20,000) = 120,000 subtotal
      // Combo: prod-1 (1 dona, 50,000) + prod-2 (1 dona, 20,000) = 70,000 alohida-alohida -> 60,000ga tushadi -> 10,000 chegirma
      const result = await _testables.handleCreateOrder(baseRequest({
        items: [{ productId: "prod-1", quantity: 2 }, { productId: "prod-2", quantity: 1 }],
        bundleId: "bundle-1",
      }));

      expect(result.bundleDiscountAmount).toBe(10000);
      expect(result.totalAmount).toBe(120000 - 10000);

      const orderWrite = setCalls.find((c) => c.path.join("/") === `orders/${result.orderId}`);
      expect(orderWrite.data.appliedBundle).toEqual({ bundleId: "bundle-1", name: "Gigiyena to'plami", discountAmount: 10000 });
    });

    test("combo mahsulotlaridan BIRI savatda yo'q bo'lsa - rad etiladi", async () => {
      const { firestore } = buildMockFirestore({
        products: {
          "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 },
          "prod-2": { sellerId: "seller-1", name: "Sovun", price: 20000, stock: 10 },
        },
        sellerData: {},
        bundles: { "bundle-1": { productIds: ["prod-1", "prod-2"], bundlePrice: 60000, isActive: true } },
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({
          items: [{ productId: "prod-1", quantity: 1 }], // prod-2 yo'q
          bundleId: "bundle-1",
        }))
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    test("combo O'CHIRILGAN (`isActive: false`) bo'lsa - rad etiladi", async () => {
      const { firestore } = buildMockFirestore({
        products: {
          "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 },
          "prod-2": { sellerId: "seller-1", name: "Sovun", price: 20000, stock: 10 },
        },
        sellerData: {},
        bundles: { "bundle-1": { productIds: ["prod-1", "prod-2"], bundlePrice: 60000, isActive: false } },
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({
          items: [{ productId: "prod-1", quantity: 1 }, { productId: "prod-2", quantity: 1 }],
          bundleId: "bundle-1",
        }))
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    test("mavjud bo'lmagan bundleId - 'not-found' beradi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: {},
        bundles: {},
      });
      const { _testables } = loadOrdersModule(firestore);

      await expect(
        _testables.handleCreateOrder(baseRequest({ bundleId: "yoq-bundle" }))
      ).rejects.toMatchObject({ code: "not-found" });
    });

    test("sotuvchi combo narxini INDIVIDUAL jamidan YUQORI qilib qo'ysa - chegirma 0 bo'ladi (manfiy chegirma YO'Q)", async () => {
      const { firestore } = buildMockFirestore({
        products: {
          "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 },
          "prod-2": { sellerId: "seller-1", name: "Sovun", price: 20000, stock: 10 },
        },
        sellerData: {},
        bundles: { "bundle-1": { productIds: ["prod-1", "prod-2"], bundlePrice: 999999, isActive: true } },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({
        items: [{ productId: "prod-1", quantity: 1 }, { productId: "prod-2", quantity: 1 }],
        bundleId: "bundle-1",
      }));
      expect(result.bundleDiscountAmount).toBe(0);
    });

    test("bandl VA promokod BIRGA qo'llanishi mumkin", async () => {
      const { firestore } = buildMockFirestore({
        products: {
          "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 },
          "prod-2": { sellerId: "seller-1", name: "Sovun", price: 20000, stock: 10 },
        },
        sellerData: {},
        coupons: { SALE10: { isActive: true, discountType: "percent", discountValue: 10, usedCount: 0 } },
        bundles: { "bundle-1": { productIds: ["prod-1", "prod-2"], bundlePrice: 60000, isActive: true } },
      });
      const { _testables } = loadOrdersModule(firestore);

      // subtotal 70,000 -> kupon 10% = -7,000 -> bandl chegirmasi -10,000 -> 53,000
      const result = await _testables.handleCreateOrder(baseRequest({
        items: [{ productId: "prod-1", quantity: 1 }, { productId: "prod-2", quantity: 1 }],
        bundleId: "bundle-1",
        couponCode: "SALE10",
      }));

      expect(result.discountAmount).toBe(7000);
      expect(result.bundleDiscountAmount).toBe(10000);
      expect(result.totalAmount).toBe(70000 - 7000 - 10000);
    });

    test("`bundleId` berilmasa - hech narsaga ta'sir qilmaydi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: {},
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest());
      expect(result.bundleDiscountAmount).toBe(0);
      expect(result.appliedBundle).toBeNull();
    });
  });

  describe("bo'lib to'lash (installment)", () => {
    test("sotuvchi yoqqan, mijoz sotuvchi belgilagan qismlar soniga so'ragan - rejani to'g'ri yaratadi", async () => {
      const { firestore, setCalls } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { installmentPaymentEnabled: true, installmentParts: 3, paymentTypes: ["prepay"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      // 2 dona * 50,000 = 100,000 -> 3 qismga: 33,333 + 33,333 + 33,334
      const result = await _testables.handleCreateOrder(baseRequest({
        customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "receipt-1.jpg", installments: 3 },
      }));

      expect(result.installmentPlan).toEqual({
        totalParts: 3,
        partsPaid: 1,
        totalAmount: 100000,
        amounts: [33333, 33333, 33334],
        payments: [{ index: 0, amount: 33333, receiptUrl: "receipt-1.jpg", submittedAtMs: expect.any(Number) }],
      });

      const orderWrite = setCalls.find((c) => c.path.join("/") === `orders/${result.orderId}`);
      expect(orderWrite.data.installmentPlan).toEqual(result.installmentPlan);
    });

    test("sotuvchi bu funksiyani YOQMAGAN bo'lsa - mijoz so'ragan bo'lsa ham reja YARATILMAYDI", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { installmentPaymentEnabled: false, installmentParts: 3, paymentTypes: ["prepay"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({
        customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "receipt-1.jpg", installments: 3 },
      }));

      expect(result.installmentPlan).toBeNull();
    });

    test("mijoz sotuvchi belgilagan sondan BOSHQA sonli qismga so'ragan bo'lsa - reja yaratilmaydi (oddiy to'lovga qaytiladi)", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { installmentPaymentEnabled: true, installmentParts: 3, paymentTypes: ["prepay"] },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({
        customerData: { ...baseCustomerData, paymentMethod: "card", paymentReceiptUrl: "receipt-1.jpg", installments: 2 },
      }));

      expect(result.installmentPlan).toBeNull();
    });

    test("naqd to'lovda (`paymentMethod: cash`) - installments so'ralgan bo'lsa ham e'tiborga olinmaydi", async () => {
      const { firestore } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: { installmentPaymentEnabled: true, installmentParts: 2 },
      });
      const { _testables } = loadOrdersModule(firestore);

      const result = await _testables.handleCreateOrder(baseRequest({
        customerData: { ...baseCustomerData, installments: 2 },
      }));

      expect(result.installmentPlan).toBeNull();
    });
  });

  describe("tug'ilgan kun chegirmasi uchun `linkedSellerIds` yozuvi", () => {
    test("buyurtma yaratilganda, mijozning global hujjatiga sotuvchi ID'si qo'shiladi", async () => {
      const { firestore, setCalls } = buildMockFirestore({
        products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
        sellerData: {},
      });
      const { _testables } = loadOrdersModule(firestore);

      await _testables.handleCreateOrder(baseRequest());

      const clientWrite = setCalls.find((c) => c.path.join("/") === "clients/client-1");
      expect(clientWrite).toBeDefined();
      expect(clientWrite.data.linkedSellerIds).toEqual({ __arrayUnion: ["seller-1"] });
    });
  });

  test("promokod HAQIQIY qoidalar bo'yicha tekshiriladi — noto'g'ri kod rad etilishi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
      coupons: {},
    });
    const { _testables } = loadOrdersModule(firestore);

    await expect(
      _testables.handleCreateOrder(baseRequest({ couponCode: "YOQKOD" }))
    ).rejects.toMatchObject({ code: "not-found" });
  });

  test("haqiqiy, faol promokod — to'g'ri chegirmani qo'llashi kerak", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
      coupons: { SALE10: { isActive: true, discountType: "percent", discountValue: 10, usedCount: 0 } },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({ couponCode: "sale10" })); // kichik harf bilan ham ishlashi kerak

    expect(result.discountAmount).toBe(10000); // 100,000ning 10%i
    expect(result.totalAmount).toBe(90000);
  });

  test("HAMKOR/BLOGGER kodi (#117): `partnerName`ga ega promokod ishlatilsa - hamkorning sotuv statistikasi (buyurtmalar soni + umumiy summa) oshiriladi", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
      coupons: { BLOG10: { isActive: true, discountType: "percent", discountValue: 10, usedCount: 0, partnerName: "Blogger Aziz" } },
    });
    const { _testables } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest({ couponCode: "BLOG10" }));

    const statsWrite = setCalls.find((c) => c.path.join("/") === "sellers/seller-1/partnerCodeStats/BLOG10");
    expect(statsWrite).toBeTruthy();
    expect(statsWrite.data).toMatchObject({
      code: "BLOG10",
      partnerName: "Blogger Aziz",
      orderCount: { __increment: 1 },
      totalRevenue: { __increment: result.totalAmount },
    });
  });

  test("HAMKOR/BLOGGER kodi: `partnerName`i YO'Q oddiy promokod ishlatilsa - hamkor statistikasi UMUMAN yozilmaydi", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
      coupons: { SALE10: { isActive: true, discountType: "percent", discountValue: 10, usedCount: 0 } },
    });
    const { _testables } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest({ couponCode: "SALE10" }));

    const statsWrite = setCalls.find((c) => c.path[2] === "partnerCodeStats");
    expect(statsWrite).toBeUndefined();
  });

  test("tizimga kirmagan foydalanuvchi rad etilishi kerak", async () => {
    const { firestore } = buildMockFirestore({});
    const { _testables } = loadOrdersModule(firestore);

    await expect(
      _testables.handleCreateOrder({ auth: null, data: {} })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  test("referal sharti bajarilganda - mukofot promokodi yaratiladi VA taklif qiluvchiga Telegram xabari yuboriladi", async () => {
    const { firestore, setCalls } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Zelo" }, // referralProgramEnabled ko'rsatilmagan -> standart bo'yicha YOQILGAN
      clientData: { referredBy: "referrer-1", referredForSellerId: "seller-1" },
    });
    const { _testables, __mocks } = loadOrdersModule(firestore);

    const result = await _testables.handleCreateOrder(baseRequest()); // couponCode YO'Q - referal chegirmasi qo'llanishi kerak

    expect(result.referralDiscount).toMatchObject({ referrerId: "referrer-1" });
    expect(result.referralRewardCouponCode).toMatch(/^REF-/);

    // ENG MUHIM TEKSHIRUV: xabar aynan TAKLIF QILUVCHIGA (referrer-1),
    // BUYURTMA BERGAN mijozga (client-1) EMAS, yuborilgan bo'lishi kerak.
    expect(__mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [, chatId, text] = __mocks.sendTelegramMessage.mock.calls[0];
    expect(chatId).toBe("referrer-1");
    expect(text).toContain(result.referralRewardCouponCode);

    // YANGI (referral leaderboard, #114): taklif qiluvchining DOIMIY
    // (all-time) va HAFTALIK hisoblagichlari HAM oshirilishi kerak -
    // birinchisi mijozga ko'rinadigan reytingni, ikkinchisi haftalik
    // "top-3" bonus mukofotini quvvatlaydi.
    const countWrite = setCalls.find(
      (c) => c.path.join("/") === `sellers/seller-1/referralCounts/referrer-1`
    );
    expect(countWrite).toBeTruthy();
    expect(countWrite.data).toMatchObject({ count: { __increment: 1 } });

    const weeklyWrite = setCalls.find(
      (c) => c.path[0] === "sellers" && c.path[1] === "seller-1" && c.path[2] === "referralWeeklyCounts"
    );
    expect(weeklyWrite).toBeTruthy();
    expect(weeklyWrite.data).toMatchObject({ counts: { "referrer-1": { __increment: 1 } } });
    expect(weeklyWrite.path[3]).toMatch(/^\d{4}-W\d{2}$/);
  });

  test("sotuvchida shaxsiy bot ULANGAN bo'lsa, referal mukofoti xabari BIRINCHI NAVBATDA o'sha bot orqali yuboriladi (v39.6)", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: { storeName: "Zelo" },
      clientData: { referredBy: "referrer-1", referredForSellerId: "seller-1" },
      customerBotToken: "sellers-own-bot-token",
    });
    const { _testables, __mocks } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest());

    expect(__mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [token, chatId] = __mocks.sendTelegramMessage.mock.calls[0];
    expect(token).toBe("sellers-own-bot-token");
    expect(chatId).toBe("referrer-1");
  });

  test("referal sharti bajarilmasa (referredBy yo'q) - hech qanday xabar yuborilmaydi", async () => {
    const { firestore } = buildMockFirestore({
      products: { "prod-1": { sellerId: "seller-1", name: "Krem", price: 50000, stock: 10 } },
      sellerData: {},
      clientData: null, // referal orqali kelmagan oddiy mijoz
    });
    const { _testables, __mocks } = loadOrdersModule(firestore);

    await _testables.handleCreateOrder(baseRequest());

    expect(__mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });
});
