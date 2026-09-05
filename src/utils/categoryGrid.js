/**
 * Katalog bosh sahifasidagi KATEGORIYA-KARTOCHKALARI uchun ma'lumot
 * tayyorlaydi (Yandex Market/Ozon/Wildberries uslubidagi panjara).
 *
 * MUHIM DIZAYN QARORI (avval muhokama qilingan): har bir kategoriya
 * uchun MUQOVA RASMI so'ralmaydi (sotuvchidan qo'shimcha ish talab
 * qilmaslik uchun) - buning o'rniga, o'sha kategoriyadagi BIRINCHI
 * (rasmga ega) mahsulotning surati AVTOMATIK ishlatiladi. Agar
 * kategoriyada hech qanday rasmli mahsulot bo'lmasa, `coverImage`
 * `null` qaytariladi - komponent buni placeholder bilan almashtiradi.
 *
 * BO'SH KATEGORIYALAR (0 ta mahsulot) — natijaga UMUMAN KIRITILMAYDI,
 * chunki bo'sh kartochka ko'rsatishning ma'nosi yo'q va kichik
 * katalogda "to'liqroq" ko'rinish beradi.
 *
 * @param {Array} products
 * @param {Array<{value:string,label:string}>} categories - getCategoriesForNiche() natijasi
 */
export function buildCategoryCards(products, categories) {
  if (!categories || categories.length === 0) return [];

  return categories
    .map((cat) => {
      const matching = products.filter((p) => p.category === cat.value);
      const withImage = matching.find((p) => p.image || (Array.isArray(p.images) && p.images[0]));
      const coverImage = withImage ? (withImage.image || withImage.images[0]) : null;

      return { value: cat.value, label: cat.label, count: matching.length, coverImage };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}
