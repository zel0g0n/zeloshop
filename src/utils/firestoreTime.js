/**
 * Firestore Timestamp'ni (yoki tezkor boshlang'ich o'qishda kelishi
 * mumkin bo'lgan xom `{seconds}` shaklini) millisoniyaga o'tkazadi.
 *
 * OLDIN bu funksiya `CourierOrdersPage.jsx` ICHIDA, mahalliy
 * (eksport qilinmagan) holda yozilgan edi. Endi `courierLocation.
 * updatedAt`ning "qanchalik eski" ekanligini ko'rsatish kerak bo'lgan
 * BOSHQA joylarda ham (`CourierOrderCard.jsx`, `CourierTrackingPage.jsx`
 * — `locationFreshness.js`ga qarang) ishlatilishi kerak bo'lganidan
 * keyin, umumiy, sinaladigan (`firestoreTime.test.js`) yordamchi
 * funksiyaga chiqarildi — kod DUPLIKATSIYASIga yo'l qo'ymaslik uchun.
 *
 * `null` qaytsa — sana noma'lum (masalan hali umuman yozilmagan
 * maydon, yoki formati kutilmagan).
 */
export const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return null;
};
