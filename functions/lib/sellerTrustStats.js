/**
 * Sof funksiya - sotuvchi darajasidagi "ishonch" ko'rsatkichlarini
 * (haqiqiy sharh reytingi yig'indisi/soni) HAR SAFAR BARCHA
 * sharhlarni/mahsulotlarni qayta yig'ib chiqmasdan, DELTA orqali
 * saqlab borish uchun.
 *
 * NEGA DELTA (mahsulot darajasidagi yaxlitlangan `averageRating`dan
 * emas): agar sotuvchi darajasidagi yig'indini mahsulotning
 * YAXLITLANGAN o'rtacha bahosidan (masalan 4.7) qayta hisoblasak, har
 * bir yozuvda kichik yaxlitlash xatosi (rounding error) to'planib
 * boradi. Bu yerda esa har bir sharh hujjatining XOM (yaxlitlanmagan)
 * `rating` (1-5) qiymatidan to'g'ridan-to'g'ri DELTA hisoblanadi -
 * xato to'planish IMKONIYATI YO'Q.
 *
 * @param {{rating:number}|null} before - sharh hujjati YOZUVDAN OLDIN (yaratilgan bo'lsa yoki topilmasa - null)
 * @param {{rating:number}|null} after - sharh hujjati YOZUVDAN KEYIN (o'chirilgan bo'lsa - null)
 * @returns {{ratingSumDelta:number, ratingCountDelta:number}}
 */
function computeSellerRatingDelta(before, after) {
  const beforeRating = before ? Number(before.rating) || 0 : 0;
  const afterRating = after ? Number(after.rating) || 0 : 0;
  const beforeExists = !!before;
  const afterExists = !!after;
  return {
    ratingSumDelta: afterRating - beforeRating,
    ratingCountDelta: (afterExists ? 1 : 0) - (beforeExists ? 1 : 0),
  };
}

module.exports = { computeSellerRatingDelta };
