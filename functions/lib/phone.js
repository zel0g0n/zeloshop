// Telefon raqamini xalqaro (E.164) ko'rinishga keltiradi: "+998901234567".
// Yandex Delivery kontakt telefonini aynan shu formatda kutadi —
// bizda esa raqam "+998 90 123 45 67", "90 123 45 67", "998901234567" kabi
// turli ko'rinishda saqlanishi mumkin. Yaroqsiz bo'lsa — null.
function normalizePhoneE164(raw) {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // 9 xonali mahalliy raqam (operator kodi + 7 xona) — O'zbekiston.
  if (digits.length === 9) return `+998${digits}`;
  // 0 bilan boshlangan mahalliy format: 0 90 123 45 67
  if (digits.length === 10 && digits.startsWith("0")) return `+998${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  // Boshqa mamlakat raqami (E.164: 8..15 xona).
  if (digits.length >= 10 && digits.length <= 15 && String(raw).trim().startsWith("+")) return `+${digits}`;
  return null;
}

module.exports = { normalizePhoneE164 };
