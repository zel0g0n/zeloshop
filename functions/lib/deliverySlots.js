/**
 * YETKAZIB BERISH VAQT ORALIG'I — backend nusxasi.
 *
 * `src/utils/deliverySlots.js` bilan AYNAN BIR XIL mantiq (loyihada
 * allaqachon o'rnatilgan "frontend+backend duplikatsiyasi" naqshi,
 * `constants/deliveryTiers.js`/`lib/deliveryTiers.js` bilan bir xil) —
 * `functions/orders.js` xaridor tanlagan oraliqni bu YERDA, YAKUNIY
 * (ishonchli) ravishda tasdiqlaydi, chunki frontend'dagi hisob-kitobga
 * ishonib bo'lmaydi (soat/sana soxtalashtirilishi mumkin).
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function parseHHmm(str) {
  if (typeof str !== "string") return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return null;
  return { h, m };
}

function getMinLeadHours(deliveryTier) {
  return deliveryTier === "otherRegions" ? 27 : 3;
}

const toTashkentShifted = (ms) => new Date(ms + TASHKENT_OFFSET_MS);
const fromTashkentShifted = (shiftedMs) => shiftedMs - TASHKENT_OFFSET_MS;

function generateDeliverySlots({
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

function isValidDeliverySlot(slot, opts) {
  if (!slot || typeof slot.startMs !== "number" || typeof slot.endMs !== "number") return false;
  if (slot.endMs - slot.startMs !== HOUR_MS) return false;
  return generateDeliverySlots(opts).some((candidate) => candidate.startMs === slot.startMs);
}

/** `src/utils/deliverySlots.js`dagi `hourLabelOf` bilan AYNAN BIR XIL. */
function hourLabelOf(ms) {
  const shiftedHour = new Date(ms + TASHKENT_OFFSET_MS).getUTCHours();
  return `${String(shiftedHour).padStart(2, "0")}:00`;
}

/**
 * Sana+soat oralig'ini MUTLAQ shaklda formatlaydi — "02.09, 14:00–15:00".
 * `src/utils/deliverySlots.js`dagi `formatDeliverySlotAbsolute` bilan
 * AYNAN BIR XIL — Telegram bildirishnomalarida (`notifications.js`,
 * `staff.js`) mijoz tanlagan yetkazib berish vaqtini ko'rsatish uchun
 * (2026-09 punkt-royxati, 89-band: bildirishnoma boyitish — sotuvchi/
 * xodim ilovani ochmasdan, xabarning O'ZIDAN kelishilgan vaqtni bilishi
 * kerak).
 */
function formatDeliverySlotAbsolute(slot) {
  const shifted = new Date(slot.startMs + TASHKENT_OFFSET_MS);
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}, ${hourLabelOf(slot.startMs)}–${hourLabelOf(slot.endMs)}`;
}

module.exports = { parseHHmm, getMinLeadHours, generateDeliverySlots, isValidDeliverySlot, formatDeliverySlotAbsolute };
