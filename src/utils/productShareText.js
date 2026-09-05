/**
 * Mahsulot uchun, "professional SMM mutaxassisi" darajasidagi
 * ulashish matnini QURADI - SOF FUNKSIYA, hech qanday tashqi
 * API (Gemini) chaqirmaydi.
 *
 * MUHIM QAROR: bu matn AI (Gemini) orqali EMAS, balki tayyor
 * SHABLON asosida yaratiladi - chunki: (1) ulashish - TEZKOR,
 * bir bosishlik amal bo'lishi kerak, AI so'rovi esa bir necha
 * soniya kutishni talab qilardi; (2) har safar ulashishda AI
 * chaqirish - HAQIQIY PUL XARAJATI (va bu funksiya CHEKSIZ marta
 * bosilishi mumkin - narx nazorati muhim); (3) mahsulot allaqachon
 * o'zining nomi, narxi, tavsifiga ega - bu ma'lumotlardan chiroyli
 * shablon qurish uchun AI shart emas. Sotuvchi, agar xohlasa,
 * Mahsulotni Tahrirlash sahifasidagi (AI CEO) "Post generatori"dan
 * ALOHIDA foydalanib, chuqurroq ijodiy matn yaratishi mumkin -
 * bu YERDAGI tezkor ulashish esa har doim ISHONCHLI va TEZKOR
 * bo'lishi kerak.
 *
 * Loyihaning "ilova ICHIDA emoji yo'q" qoidasi bu YERGA
 * QO'LLANILMAYDI - bu, TASHQI chat/ijtimoiy tarmoqqa yuboriladigan
 * KONTENT, bizning UI'imiz emas (AI CEO'ning ijtimoiy tarmoq posti
 * uchun qabul qilingan bir xil, ilgari o'rnatilgan istisno).
 */
export function buildProductShareText(product) {
  const name = product?.name || product?.title || "";
  const price = Number(product?.discountPrice || product?.price) || 0;
  const hasDiscount = product?.discountPrice && Number(product.discountPrice) > 0 && Number(product.discountPrice) < Number(product.price);
  const originalPrice = Number(product?.price) || 0;

  const lines = [`✨ ${name}`, ""];

  if (product?.description) {
    const shortDesc = product.description.length > 100 ? `${product.description.slice(0, 100).trim()}...` : product.description;
    lines.push(shortDesc, "");
  }

  if (hasDiscount) {
    lines.push(`💰 ${price.toLocaleString()} so'm  ~~${originalPrice.toLocaleString()} so'm~~`, "");
  } else {
    lines.push(`💰 ${price.toLocaleString()} so'm`, "");
  }

  lines.push("👉 Xarid qilish uchun havolani bosing:");

  return lines.join("\n");
}
