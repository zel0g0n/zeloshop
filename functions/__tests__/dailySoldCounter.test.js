const { computeDailySoldCountUpdate } = require("../lib/dailySoldCounter");

describe("computeDailySoldCountUpdate", () => {
  test("mahsulot hali umuman sotilmagan bo'lsa (maydonlar yo'q) - yangi kun sifatida boshlaydi", () => {
    const result = computeDailySoldCountUpdate({}, "2026-09-02", 3);
    expect(result).toEqual({ soldTodayCount: 3, soldTodayDate: "2026-09-02" });
  });

  test("undefined mahsulot uchun ham xato bermaydi", () => {
    const result = computeDailySoldCountUpdate(undefined, "2026-09-02", 2);
    expect(result).toEqual({ soldTodayCount: 2, soldTodayDate: "2026-09-02" });
  });

  test("BIR XIL kunda ikkinchi buyurtma - hisoblagichni QO'SHIB oshiradi", () => {
    const product = { soldTodayCount: 5, soldTodayDate: "2026-09-02" };
    const result = computeDailySoldCountUpdate(product, "2026-09-02", 2);
    expect(result).toEqual({ soldTodayCount: 7, soldTodayDate: "2026-09-02" });
  });

  test("YANGI kun boshlansa - eski hisoblagich E'TIBORGA OLINMAYDI, noldan boshlanadi (dangasa reset)", () => {
    const product = { soldTodayCount: 50, soldTodayDate: "2026-09-01" };
    const result = computeDailySoldCountUpdate(product, "2026-09-02", 4);
    expect(result).toEqual({ soldTodayCount: 4, soldTodayDate: "2026-09-02" });
  });

  test("miqdor (quantity) noto'g'ri/yo'q bo'lsa - 0 sifatida qo'shiladi, xato bermaydi", () => {
    const product = { soldTodayCount: 1, soldTodayDate: "2026-09-02" };
    const result = computeDailySoldCountUpdate(product, "2026-09-02", undefined);
    expect(result).toEqual({ soldTodayCount: 1, soldTodayDate: "2026-09-02" });
  });
});
