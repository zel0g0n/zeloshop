const { normalizePhoneE164 } = require("../lib/phone");

describe("normalizePhoneE164", () => {
  test.each([
    ["+998 90 123 45 67", "+998901234567"],
    ["90 123 45 67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["0901234567", "+998901234567"],
    ["+7 912 345 67 89", "+79123456789"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhoneE164(input)).toBe(expected);
  });

  test.each([[""], [null], [undefined], ["abc"], ["123"], ["+998 90"]])("yaroqsiz: %p", (input) => {
    expect(normalizePhoneE164(input)).toBeNull();
  });
});
