/**
 * Foydalanuvchi kiritayotgan raqamni pul formatiga (ming ajratuvchi
 * vergul bilan) o'giradi. Faqat raqamlarni saqlab qoladi, boshqa
 * hamma narsani tozalaydi.
 */
export const formatMoneyInput = (rawValue) => {
  const digitsOnly = String(rawValue).replace(/\D/g, "");
  if (!digitsOnly) return "";
  return Number(digitsOnly).toLocaleString("en-US");
};

/** Formatlangan pul matnidan (masalan "25,000") sof raqamni qaytaradi. */
export const parseMoneyInput = (formattedValue) => {
  const digitsOnly = String(formattedValue).replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
};
