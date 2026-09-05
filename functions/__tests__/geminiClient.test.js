/**
 * `lib/geminiClient.js` — barcha Gemini mijozlarini yaratish uchun
 * yagona joy (2026-09 audit, "AI: Gemini retry/backoff qo'shish").
 * Bu test shunchaki `createGeminiClient`ning `GoogleGenAI`ni to'g'ri
 * `apiKey` bilan chaqirishini tekshiradi — haqiqiy retry/backoff
 * mantig'i SDK ICHIDA (`@google/genai`) yotadi va bu loyihada QAYTA
 * yozilmagan (batafsil izoh: `geminiClient.js`ning o'zida).
 */
function loadModule() {
  jest.resetModules();
  const GoogleGenAI = jest.fn(function (options) {
    this.options = options;
  });
  jest.doMock("@google/genai", () => ({ GoogleGenAI }));
  const mod = require("../lib/geminiClient");
  return { ...mod, __GoogleGenAI: GoogleGenAI };
}

describe("createGeminiClient", () => {
  test("`GoogleGenAI`ni berilgan apiKey bilan chaqiradi", () => {
    const { createGeminiClient, __GoogleGenAI } = loadModule();
    createGeminiClient("test-api-key-123");
    expect(__GoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-api-key-123" });
  });

  test("har chaqiruvda YANGI instansiya qaytaradi (umumiy holat ulashilmaydi)", () => {
    const { createGeminiClient } = loadModule();
    const a = createGeminiClient("key-a");
    const b = createGeminiClient("key-b");
    expect(a).not.toBe(b);
    expect(a.options).toEqual({ apiKey: "key-a" });
    expect(b.options).toEqual({ apiKey: "key-b" });
  });
});
