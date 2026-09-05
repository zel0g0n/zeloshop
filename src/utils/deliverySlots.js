/**
 * YETKAZIB BERISH VAQT ORALIG'INI TANLASH — sof funksiyalar.
 *
 * 2026-09 punkt-royxati, 15-band: xaridor checkout paytida, do'kon
 * ish vaqti ichida, 1 soatlik oraliqlardan birini tanlaydi. Eng erta
 * tanlash mumkin bo'lgan vaqt — HOZIRDAN kamida 3 soat keyin (agar
 * xaridor sotuvchi bilan BIR XIL hududda bo'lsa), yoki kamida 27 soat
 * keyin (agar BOSHQA hududda bo'lsa — masofaviy yetkazib berish
 * ko'proq vaqt talab qiladi).
 *
 * MUHIM (soat mintaqasi): barcha hisob-kitoblar O'ZBEKISTON (Toshkent,
 * UTC+5, 2016-yildan beri qishki/yozgi vaqtga o'TMAYDI — barqaror
 * ofset) VAQTIGA nisbatan olib boriladi, QURILMANING/BROWSERNING
 * mahalliy soat mintaqasidan QAT'IY NAZAR. Aks holda, agar xaridorning
 * qurilmasi boshqa soat mintaqasiga sozlangan bo'lsa (yoki server —
 * Cloud Function — odatda UTC'da ishlaydi), mijoz frontendda ko'rgan
 * oraliqlar bilan backend tasdiqlagan oraliqlar MOS KELMAY QOLARDI.
 * `functions/lib/deliverySlots.js` — AYNAN BIR XIL mantiq (loyihada
 * allaqachon o'rnatilgan "frontend+backend duplikatsiyasi" naqshi,
 * `constants/deliveryTiers.js`/`functions/lib/deliveryTiers.js` bilan
 * bir xil).
 */

// UTC+5, DST YO'Q (barqaror) — shuning uchun oddiy son sifatida
// ishlatish xavfsiz (Intl/soat mintaqasi ma'lumot bazasiga bog'liq
// emas, testlarda ham barqaror natija beradi).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "HH:mm" satrni {h,m} obyektiga aylantiradi, noto'g'ri bo'lsa `null`. */
export function parseHHmm(str) {
  if (typeof str !== "string") return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Xaridor/sotuvchi hududiy solishtiruv natijasidan (`resolveDeliveryTier`
 * qaytargan qiymat: "sameCity"|"sameRegionDistricts"|"otherRegions"|null)
 * minimal "oldindan buyurtma berish" soatini aniqlaydi.
 */
export function getMinLeadHours(deliveryTier) {
  return deliveryTier === "otherRegions" ? 27 : 3;
}

/**
 * Berilgan epoch millisekundni "Toshkent vaqtiga siljitilgan soxta
 * UTC" ga o'tkazadi — shu koordinatada oddiy `Date.UTC*`/`getUTC*`
 * metodlaridan xavfsiz foydalanish mumkin (chunki haqiqiy UTC bilan
 * ishlaganda qurilmaning mahalliy soat mintaqasi umuman ARALASHMAYDI).
 */
const toTashkentShifted = (ms) => new Date(ms + TASHKENT_OFFSET_MS);
const fromTashkentShifted = (shiftedMs) => shiftedMs - TASHKENT_OFFSET_MS;

/**
 * Do'kon ish vaqti (`workingHoursOpen`/`workingHoursClose`, "HH:mm",
 * daqiqalar E'TIBORGA OLINMAYDI — barcha oraliqlar to'liq soat
 * chegarasida, masalan har doim "14:00–15:00", HECH QACHON "14:30–...")
 * ichida, `nowMs`dan kamida `minLeadHours` soat keyin boshlanadigan,
 * bo'sh 1 soatlik oraliqlar RO'YXATINI qaytaradi.
 *
 * @returns {Array<{startMs:number, endMs:number}>}
 */
export function generateDeliverySlots({
  nowMs = Date.now(),
  minLeadHours = 3,
  workingHoursOpen = "10:00",
  workingHoursClose = "19:00",
  daysAhead = 4,
} = {}) {
  const open = parseHHmm(workingHoursOpen) || { h: 10, m: 0 };
  const close = parseHHmm(workingHoursClose) || { h: 19, m: 0 };
  if (open.h >= close.h) return [];

  const earliestMs = nowMs + minLeadHours * HOUR_MS;
  const shiftedNow = toTashkentShifted(nowMs);
  const dayStartShifted = Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), shiftedNow.getUTCDate());

  const slots = [];
  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    for (let h = open.h; h < close.h; h++) {
      const slotStartMs = fromTashkentShifted(dayStartShifted + dayOffset * DAY_MS + h * HOUR_MS);
      if (slotStartMs < earliestMs) continue;
      slots.push({ startMs: slotStartMs, endMs: slotStartMs + HOUR_MS });
    }
  }
  return slots;
}

/**
 * Xaridor tanlagan oraliq HAQIQATAN ham (hozirgi vaqt/hudud/ish vaqti
 * bo'yicha) YARAROQLAR RO'YXATIDA bormi — backend'da (`functions/orders.js`)
 * yakuniy tasdiqlash uchun, frontend esa faqat ko'rsatish (UX) uchun
 * `generateDeliverySlots`ni ishlatadi.
 */
export function isValidDeliverySlot(slot, opts) {
  if (!slot || typeof slot.startMs !== "number" || typeof slot.endMs !== "number") return false;
  if (slot.endMs - slot.startMs !== HOUR_MS) return false;
  return generateDeliverySlots(opts).some((candidate) => candidate.startMs === slot.startMs);
}

// --- Ko'rsatish (UI) uchun yordamchilar (`DeliverySlotSheet.jsx`,
// `Checkout.jsx`) — sof funksiyalar shu yerda, komponent faylida EMAS
// (`react-refresh/only-export-components`: komponent fayli FAQAT
// komponent eksport qilishi kerak — `dateRange.js`/`MonthPickerSheet.jsx`
// bilan bir xil ajratish naqshi).

/** Epoch millisekundni "Toshkent kuni" butun son kalitiga aylantiradi. */
export const dayKeyOf = (ms) => Math.floor((ms + TASHKENT_OFFSET_MS) / DAY_MS);

/** Epoch millisekunddan "HH:00" (Toshkent vaqti) soat yorlig'ini oladi. */
export const hourLabelOf = (ms) => {
  const shiftedHour = new Date(ms + TASHKENT_OFFSET_MS).getUTCHours();
  return `${String(shiftedHour).padStart(2, "0")}:00`;
};

/**
 * "Toshkent kuni" kalitini "Bugun"/"Ertaga"/"02.09" ko'rinishiga
 * o'giradi. `todayKey` chaqiruvchi tomonidan beriladi (barqaror,
 * `dayKeyOf(mountedAtMs)`) — bu funksiya `Date.now()`ni chaqirmaydi.
 */
export const formatDeliveryDayLabel = (dayKey, todayKey, t) => {
  const diffDays = dayKey - todayKey;
  if (diffDays === 0) return t("checkout.deliverySlotToday");
  if (diffDays === 1) return t("checkout.deliverySlotTomorrow");
  const anchorMs = dayKey * DAY_MS - TASHKENT_OFFSET_MS;
  return new Date(anchorMs).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit" });
};

/**
 * Tanlangan oraliqni "Bugun, 14:00–15:00" (yoki "02.09, 14:00–15:00")
 * shaklida formatlaydi — Checkout sahifasidagi qisqa xulosa tugmasi
 * uchun.
 */
export const formatDeliverySlotRangeLabel = (slot, todayKey, t) =>
  `${formatDeliveryDayLabel(dayKeyOf(slot.startMs), todayKey, t)}, ${hourLabelOf(slot.startMs)}–${hourLabelOf(slot.endMs)}`;

/**
 * Sana+soat oralig'ini MUTLAQ (nisbiy "Bugun/Ertaga"siz) shaklda
 * formatlaydi — "02.09, 14:00–15:00". Sotuvchi/xodim buyurtmalar
 * ro'yxatida ("qachon berilgan" emas, "qachon yetkazish kerak"
 * ko'rsatkichi) ishlatiladi — bu yerda ro'yxat turli kunlarga
 * tegishli buyurtmalarni aralash ko'rsatishi mumkin, shuning uchun
 * "Bugun"/"Ertaga" nisbiy yorlig'i chalkashtirib yuborishi mumkin edi.
 */
export const formatDeliverySlotAbsolute = (slot) => {
  // Lokal (`toLocaleDateString`) formatlash o'rniga qo'lda tuzish -
  // natija BROWSER/Node lokalizatsiyasidan (masalan "02/09" vs
  // "09/02" tartib chalkashligi) MUSTAQIL, har doim "DD.MM" bo'lishi
  // uchun (xuddi `hourLabelOf`dagi siljitish naqshi bilan bir xil).
  const shifted = new Date(slot.startMs + TASHKENT_OFFSET_MS);
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}, ${hourLabelOf(slot.startMs)}–${hourLabelOf(slot.endMs)}`;
};
