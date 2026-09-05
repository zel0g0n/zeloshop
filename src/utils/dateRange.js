const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** "Bugun" / "Hafta" / "Oy" — tanlangan davrning boshlanish vaqtini (ms) qaytaradi.
 *
 * MUHIM TUZATISH (2026-09): "Oy" OLDIN shunchaki "hozirgi vaqtdan 30
 * kun oldin" (rolling 30-day window) edi — bu, yangi kalendar oyi
 * boshlanganda (masalan oyning 1-2-kunlarida), oynaning katta qismi
 * HALI HAM O'TGAN OYGA tegishli bo'lib qolishiga olib kelardi ("bugun
 * yangi oy, lekin statistika hali o'tgan oyniki" - aynan shu xato
 * sifatida xabar qilingan). Endi "Oy" HAQIQIY KALENDAR OYI boshlanishi
 * (joriy oyning 1-kuni, 00:00) - `getCalendarMonthRange(0)` bilan bir
 * xil.
 */
export const getRangeStart = (timeframe) => {
  const now = new Date();
  if (timeframe === "Bugun") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (timeframe === "Hafta") {
    return now.getTime() - 7 * MS_IN_DAY;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
};

/**
 * Berilgan "necha oy oldin" (`monthsAgo`, 0 = joriy oy) uchun HAQIQIY
 * KALENDAR OYI chegaralarini qaytaradi: `start` — o'sha oyning 1-kuni
 * 00:00, `end` — KEYINGI oyning 1-kuni 00:00 (EXCLUSIVE — ya'ni "shu
 * vaqtgacha, lekin o'zi kirmaydi"). Bu — Dashboard/P&L/Mahsulot
 * analitikasi bo'limlaridagi "Oy" filtri VA yangi oy-tanlash
 * (`MonthPickerSheet.jsx`) uchun YAGONA, umumiy manba - to'rtta joyda
 * alohida-alohida (va turlicha xato bilan) qayta yozilgan eski
 * mantiq o'rniga.
 */
export const getCalendarMonthRange = (monthsAgo = 0) => {
  const now = new Date();
  const targetMonthIndex = now.getMonth() - monthsAgo;
  const start = new Date(now.getFullYear(), targetMonthIndex, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), targetMonthIndex + 1, 1, 0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime(), year: start.getFullYear(), month: start.getMonth() };
};

/**
 * Oy-tanlash paneli (`MonthPickerSheet.jsx`) uchun so'nggi `count` ta
 * oyning ro'yxati (eng yangisi birinchi, `monthsAgo: 0` = joriy oy).
 */
export const getRecentMonthOptions = (count = 12) => {
  const options = [];
  for (let i = 0; i < count; i++) {
    const range = getCalendarMonthRange(i);
    options.push({ monthsAgo: i, ...range });
  }
  return options;
};

export const MS_IN_DAY_VALUE = MS_IN_DAY;
