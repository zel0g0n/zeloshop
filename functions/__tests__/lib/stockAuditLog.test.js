/**
 * `lib/stockAuditLog.js` uchun testlar — "ombor nazorati, haqiqiy
 * muammoni yechish" bo'limi: zaxira harakati audit jurnali.
 */

const {
  CLIENT_STOCK_CHANGE_REASONS,
  ALL_STOCK_CHANGE_REASONS,
  buildStockAuditEntryFromChange,
  writeStockAuditEntry,
} = require("../../lib/stockAuditLog");

describe("buildStockAuditEntryFromChange", () => {
  test("stock o'zgarmagan bo'lsa - null qaytaradi (boshqa maydon o'zgargan bo'lsa ham)", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10, price: 50000 };
    const after = { sellerId: "seller-1", name: "Krem", stock: 10, price: 60000 };
    expect(buildStockAuditEntryFromChange({ productId: "p1", before, after })).toBeNull();
  });

  test("mahsulot YANGI yaratilgan bo'lsa (before yo'q) - null qaytaradi (yaratish bu jurnalga kirmaydi)", () => {
    const after = { sellerId: "seller-1", name: "Krem", stock: 20 };
    expect(buildStockAuditEntryFromChange({ productId: "p1", before: null, after })).toBeNull();
  });

  test("mahsulot O'CHIRILGAN bo'lsa (after yo'q) - null qaytaradi", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 20 };
    expect(buildStockAuditEntryFromChange({ productId: "p1", before, after: null })).toBeNull();
  });

  test("qo'lda tuzatish (owner, xodim EMAS) - to'g'ri yozuv quradi, actorUid = sellerId", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const after = {
      sellerId: "seller-1", name: "Krem", stock: 15,
      lastStockChangeReason: "restock", lastStockChangeNote: "  Yangi partiya keldi  ",
    };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry).toEqual({
      productId: "p1",
      productName: "Krem",
      oldStock: 10,
      newStock: 15,
      deltaQty: 5,
      reason: "restock",
      note: "Yangi partiya keldi",
      actorUid: "seller-1",
      actorName: null,
      orderRef: null,
      orderNumber: null,
    });
  });

  test("XODIM tuzatgan bo'lsa - actorUid/actorName xodimniki bo'ladi (owner EMAS)", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 15 };
    const after = {
      sellerId: "seller-1", name: "Krem", stock: 12,
      lastStockChangeReason: "damaged_lost",
      lastStockChangeByStaffId: "staff-uid-1",
      lastStockChangeByStaffName: "Aziz (Ombor)",
    };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.actorUid).toBe("staff-uid-1");
    expect(entry.actorName).toBe("Aziz (Ombor)");
    expect(entry.deltaQty).toBe(-3);
    expect(entry.reason).toBe("damaged_lost");
  });

  test("BUYURTMA orqali (order_sale) kamayish - actorUid/actorName null (Tizim), orderRef/orderNumber saqlanadi", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const after = {
      sellerId: "seller-1", name: "Krem", stock: 8,
      lastStockChangeReason: "order_sale",
      lastStockChangeOrderRef: "order-abc",
      lastStockChangeOrderNumber: 42,
    };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.actorUid).toBeNull();
    expect(entry.actorName).toBeNull();
    expect(entry.reason).toBe("order_sale");
    expect(entry.orderRef).toBe("order-abc");
    expect(entry.orderNumber).toBe(42);
  });

  test("XAVFSIZLIK: ro'yxatda YO'Q/soxta sabab yuborilsa - 'unspecified'ga tushadi (hech qachon o'ylab topilmaydi)", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const after = { sellerId: "seller-1", name: "Krem", stock: 12, lastStockChangeReason: "backdoor_hack" };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.reason).toBe("unspecified");
  });

  test("sabab UMUMAN berilmagan bo'lsa (masalan eski/kutilmagan yozuv yo'li) - 'unspecified'", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const after = { sellerId: "seller-1", name: "Krem", stock: 9 };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.reason).toBe("unspecified");
    expect(entry.actorUid).toBe("seller-1"); // "unspecified" - order_sale EMAS, shuning uchun owner'ga bog'lanadi
  });

  test("note bo'sh/faqat probel bo'lsa - null (Firestore'ni keraksiz bo'sh satr bilan shishirmaydi)", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const after = { sellerId: "seller-1", name: "Krem", stock: 12, lastStockChangeReason: "other", lastStockChangeNote: "   " };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.note).toBeNull();
  });

  test("juda uzun note - 500 belgigacha qisqartiriladi", () => {
    const before = { sellerId: "seller-1", name: "Krem", stock: 10 };
    const longNote = "a".repeat(600);
    const after = { sellerId: "seller-1", name: "Krem", stock: 12, lastStockChangeReason: "other", lastStockChangeNote: longNote };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.note.length).toBe(500);
  });

  test("nom o'zgargan bo'lsa - YANGI (after) nomi ishlatiladi, eski nom faqat zaxira sifatida", () => {
    const before = { sellerId: "seller-1", name: "Eski nom", stock: 10 };
    const after = { sellerId: "seller-1", name: "Yangi nom", stock: 12, lastStockChangeReason: "other" };
    const entry = buildStockAuditEntryFromChange({ productId: "p1", before, after });
    expect(entry.productName).toBe("Yangi nom");
  });
});

describe("CLIENT_STOCK_CHANGE_REASONS / ALL_STOCK_CHANGE_REASONS", () => {
  test("XAVFSIZLIK: 'order_sale' mijoz tanlashi mumkin bo'lgan ro'yxatda YO'Q (faqat server yoza oladi)", () => {
    expect(CLIENT_STOCK_CHANGE_REASONS).not.toContain("order_sale");
    expect(ALL_STOCK_CHANGE_REASONS).toContain("order_sale");
  });

  test("ALL_STOCK_CHANGE_REASONS = CLIENT ro'yxati + 'order_sale'", () => {
    expect(ALL_STOCK_CHANGE_REASONS).toEqual([...CLIENT_STOCK_CHANGE_REASONS, "order_sale"]);
  });
});

describe("writeStockAuditEntry", () => {
  function buildMockDb() {
    const added = [];
    return {
      collection(name) {
        if (name !== "sellers") throw new Error(`kutilmagan kolleksiya: ${name}`);
        return {
          doc(sellerId) {
            return {
              collection(subName) {
                if (subName !== "stockAuditLog") throw new Error(`kutilmagan quyi kolleksiya: ${subName}`);
                return { add: async (data) => { added.push({ sellerId, data }); } };
              },
            };
          },
        };
      },
      __added: added,
    };
  }

  const admin = { firestore: { FieldValue: { serverTimestamp: () => "MOCK_TS" } } };

  test("to'g'ri kolleksiyaga, timestamp bilan yozadi", async () => {
    const db = buildMockDb();
    await writeStockAuditEntry(db, admin, {
      sellerId: "seller-1", productId: "p1", productName: "Krem", oldStock: 10, newStock: 15,
      deltaQty: 5, reason: "restock", note: null, actorUid: "seller-1", actorName: null,
      orderRef: null, orderNumber: null,
    });
    expect(db.__added).toHaveLength(1);
    expect(db.__added[0].sellerId).toBe("seller-1");
    expect(db.__added[0].data).toMatchObject({ productId: "p1", deltaQty: 5, reason: "restock", createdAt: "MOCK_TS" });
    expect(typeof db.__added[0].data.createdAtMs).toBe("number");
  });

  test("BEST-EFFORT: Firestore yozuvi XATO bersa - xato TASHLAMAYDI (asosiy oqim buzilmasligi kerak)", async () => {
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({ add: async () => { throw new Error("Firestore vaqtincha ishlamayapti"); } }) }) }),
    };
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      writeStockAuditEntry(db, admin, { sellerId: "seller-1", productId: "p1", reason: "other" })
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
