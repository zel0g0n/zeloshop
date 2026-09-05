import { describe, test, expect } from "vitest";
import { buildInboxFeed } from "./inboxFeed";

const ts = (ms) => ({ toMillis: () => ms });

describe("buildInboxFeed", () => {
  test("ikkala manba ham bo'sh bo'lsa - bo'sh massiv qaytaradi", () => {
    expect(buildInboxFeed({ pendingActions: [], notifications: [] })).toEqual([]);
    expect(buildInboxFeed({})).toEqual([]);
    expect(buildInboxFeed()).toEqual([]);
  });

  test("ikkala manbadan kelgan yozuvlarni BIR XIL ro'yxatga birlashtiradi", () => {
    const result = buildInboxFeed({
      pendingActions: [{ id: "a1", createdAt: ts(1000), title: "Kampaniya" }],
      notifications: [{ id: "n1", sentAt: ts(2000), title: "Eslatma" }],
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.kind).sort()).toEqual(["aiCeoAction", "notification"]);
  });

  test("VAQT bo'yicha, ENG YANGISI birinchi bo'lib tartiblanadi (manbadan qat'i nazar)", () => {
    const result = buildInboxFeed({
      pendingActions: [{ id: "a1", createdAt: ts(1000) }],
      notifications: [{ id: "n1", sentAt: ts(3000) }, { id: "n2", sentAt: ts(2000) }],
    });
    expect(result.map((r) => r.id)).toEqual(["notif_n1", "notif_n2", "action_a1"]);
  });

  test("har bir element o'zining asl ma'lumotini (`data`) saqlab qoladi", () => {
    const action = { id: "a1", createdAt: ts(1000), title: "Kampaniya", status: "pending" };
    const result = buildInboxFeed({ pendingActions: [action], notifications: [] });
    expect(result[0].data).toEqual(action);
  });

  test("vaqt maydoni yo'q/noto'g'ri bo'lsa - xato TASHLAMAYDI, 0 sifatida ishlaydi (eng oxiriga tushadi)", () => {
    const result = buildInboxFeed({
      pendingActions: [{ id: "a1", createdAt: null }],
      notifications: [{ id: "n1", sentAt: ts(500) }],
    });
    expect(result.map((r) => r.id)).toEqual(["notif_n1", "action_a1"]);
  });

  test("Date obyekti va oddiy timestamp qiymatlarini ham to'g'ri qo'llab-quvvatlaydi", () => {
    const result = buildInboxFeed({
      pendingActions: [{ id: "a1", createdAt: new Date(2000) }],
      notifications: [{ id: "n1", sentAt: new Date(1000).toISOString() }],
    });
    expect(result.map((r) => r.id)).toEqual(["action_a1", "notif_n1"]);
  });
});
