/**
 * Katalog qidiruvi - HALOL "aqlli" qidiruv: soxta "semantik AI"
 * va'da qilinmaydi (bu ish uchun hozircha real ma'lumot hajmi
 * yetarli emas - `ZERO_FRICTION_REVIEW.md`da muhokama qilingan
 * "sovuq boshlanish" muammosi), lekin OLDINGI holatga (faqat
 * `product.name`da oddiy substring qidiruvi, hech qanday
 * relevantlik tartiblashsiz) nisbatan HAQIQIY yaxshilanish:
 *
 *   1. Bir nechta maydon bo'yicha qidiradi (nomi > kategoriyasi >
 *      tavsifi - ustuvorlik shu tartibda).
 *   2. Natijalarni RELEVANTLIK bo'yicha tartiblaydi (oldingi versiya
 *      umuman tartiblamas edi - faqat filtrlardi).
 *   3. Kichik yozuv xatolariga (typo) chidamli - so'z uzunligiga
 *      qarab moslashuvchan Levenshtein masofasi bilan.
 *   4. O'zbekcha apostrof belgilarining turli variantlarini (', ʼ,
 *      ‘, ’) BIR XIL deb hisoblaydi - "o'g'lim" turli
 *      klaviaturalarda turlicha apostrof bilan yozilishi odatiy hol.
 *
 * Hech qanday tashqi kutubxona/ML modeli ishlatilmaydi - hammasi
 * sinaladigan, sof JavaScript.
 */

// O'zbekcha matnlarda apostrof turli klaviatura/font'larda turlicha
// belgi bilan kiritiladi (to'g'ri qo'shtirnoq, teskari qo'shtirnoq,
// oddiy apostrof) - qidiruvda bularning barchasi BIR XIL deb
// hisoblanishi kerak, aks holda "do'kon" va "do‘kon" mos kelmay qoladi.
const APOSTROPHE_VARIANTS = /[‘’ʼʻ`´]/g;

export function normalizeSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ikki so'z orasidagi tahrirlash masofasi (Levenshtein). Sof, standart
 * dinamik dasturlash algoritmi - faqat QISQA so'zlar (odatda <20
 * belgi) uchun ishlatiladi, shuning uchun ishlash tezligi muammo
 * emas.
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // o'chirish
        currRow[j - 1] + 1, // qo'shish
        prevRow[j - 1] + cost // almashtirish
      );
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

/**
 * So'z uzunligiga qarab, "typo" sifatida qabul qilinadigan MAKSIMAL
 * tahrirlash masofasini qaytaradi. Qisqa so'zlar uchun (<=4 harf)
 * xiralik (fuzzy) matching O'CHIRILGAN - aks holda "krem" va "trek"
 * kabi butunlay boshqa so'zlar noto'g'ri mos kelib qolishi mumkin.
 */
function maxTypoDistanceForWord(word) {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

/** Berilgan so'z (query token) `words` ro'yxatidagi biror so'zga XIRALIK (fuzzy) mos kelsa - true. */
function hasFuzzyWordMatch(token, words) {
  const maxDist = maxTypoDistanceForWord(token);
  if (maxDist === 0) return false;
  return words.some((w) => Math.abs(w.length - token.length) <= maxDist && levenshteinDistance(token, w) <= maxDist);
}

/**
 * Bitta so'rov TOKENI (bitta so'z) uchun, bitta maydon matnidagi
 * mosligini ballga aylantiradi. `0` - hech qanday moslik yo'q.
 */
function scoreTokenAgainstField(token, normalizedField, exactPoints, fuzzyPoints) {
  if (!normalizedField) return 0;
  if (normalizedField === token) return exactPoints * 2; // to'liq moslik - eng yuqori ustuvorlik
  if (normalizedField.startsWith(token)) return exactPoints * 1.5; // boshidan mos kelishi - keyingi ustuvorlik
  if (normalizedField.includes(token)) return exactPoints;
  if (hasFuzzyWordMatch(token, normalizedField.split(" "))) return fuzzyPoints;
  return 0;
}

/**
 * Bitta mahsulot uchun umumiy relevantlik ballini hisoblaydi. Har bir
 * so'rov so'zi (token) KAMIDA bitta maydonda (nomi/kategoriya/tavsif)
 * moslashishi SHART - aks holda mahsulot butunlay chetlab o'tiladi
 * (natija `0` - "mos kelmadi" degani).
 *
 * @param {{name?: string, category?: string, description?: string, brand?: string}} product
 * @param {string} normalizedQuery - `normalizeSearchText` orqali oldindan tozalangan so'rov
 * @returns {number} 0 - mos kelmadi; musbat son - qanchalik relevantligi
 */
export function computeProductSearchScore(product, normalizedQuery) {
  if (!normalizedQuery) return 1; // bo'sh so'rov - hamma narsa "mos", tartiblanmaydi
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length === 0) return 1;

  const name = normalizeSearchText(product?.name);
  const category = normalizeSearchText(product?.category);
  const description = normalizeSearchText(product?.description);
  const brand = normalizeSearchText(product?.brand);
  // 15-NICHE UNIVERSAL PLATFORMA: dinamik `attributes` (masalan
  // `{brand: "Nivea", skinType: "oily"}`) qiymatlari ham qidiruv
  // maydoniga qo'shiladi - shu orqali "yog'li" deb qidirilganda
  // `skinType: oily`ga ega mahsulot ham topiladi, kategoriyaga xos
  // qattiq kodlangan maydon nomlari yozilmasdan (har qanday niche
  // uchun ishlaydi).
  const attributesText = normalizeSearchText(
    product?.attributes && typeof product.attributes === "object"
      ? Object.values(product.attributes).filter((v) => typeof v === "string" || typeof v === "number").join(" ")
      : ""
  );

  let total = 0;
  for (const token of tokens) {
    // Ustuvorlik: NOMI (eng muhim) > BREND/KATEGORIYA > ATRIBUTLAR/TAVSIF (eng kam muhim).
    const nameScore = scoreTokenAgainstField(token, name, 10, 3);
    const brandScore = scoreTokenAgainstField(token, brand, 6, 2);
    const categoryScore = scoreTokenAgainstField(token, category, 4, 1);
    const descriptionScore = scoreTokenAgainstField(token, description, 2, 1);
    const attributesScore = scoreTokenAgainstField(token, attributesText, 3, 1);
    const bestForToken = Math.max(nameScore, brandScore, categoryScore, descriptionScore, attributesScore);

    if (bestForToken === 0) return 0; // shu so'z HECH QAYERDA topilmadi - mahsulot mos emas
    total += bestForToken;
  }
  return total;
}

/**
 * 15-NICHE UNIVERSAL PLATFORMA — sinonimlar orqali so'rovni KENGAYTIRADI.
 *
 * Har bir niche o'zining sinonim guruhlariga ega (`config/niches.js`dagi
 * `search.synonymGroups` — masalan `["telefon", "телефон", "phone",
 * "smartfon"]`, uch tilda + tabiiy variant). Agar foydalanuvchi so'rovi
 * biror guruhdagi FRAZAni o'z ichiga olsa, o'sha frazani guruhning HAR
 * BIR boshqa a'zosiga almashtirib, qo'shimcha "variant" so'rovlar
 * hosil qilinadi — mahsulot HAR QAYSI variantga mos kelsa ham topiladi
 * (masalan ruscha "телефон" deb qidirilsa, o'zbekcha "telefon"/
 * "smartfon" nomli mahsulotlar ham topiladi).
 *
 * Sof funksiya - Gemini yoki tarmoq so'rovisiz, statik lug'at asosida
 * ishlaydi (tezkor, bepul, "sovuq boshlanish" muammosiga tobe emas).
 *
 * @param {string} normalizedQuery - `normalizeSearchText` orqali oldindan tozalangan so'rov
 * @param {string[][]} [synonymGroups] - niche'ning sinonim guruhlari
 * @returns {string[]} asl so'rov + har bir topilgan almashtirish varianti (takrorlarsiz)
 */
export function expandQueryWithSynonyms(normalizedQuery, synonymGroups = []) {
  const variants = new Set([normalizedQuery]);
  if (!normalizedQuery || !Array.isArray(synonymGroups)) return Array.from(variants);

  for (const group of synonymGroups) {
    if (!Array.isArray(group) || group.length < 2) continue;
    const normalizedGroup = group.map((phrase) => normalizeSearchText(phrase)).filter(Boolean);
    const matchedPhrase = normalizedGroup.find((phrase) => normalizedQuery.includes(phrase));
    if (!matchedPhrase) continue;

    normalizedGroup.forEach((phrase) => {
      if (phrase !== matchedPhrase) {
        variants.add(normalizedQuery.split(matchedPhrase).join(phrase));
      }
    });
  }
  return Array.from(variants);
}

/**
 * Mahsulotlar ro'yxatini so'rov bo'yicha filtrlaydi VA relevantlik
 * bo'yicha (yuqoridan pastga) tartiblaydi. Bo'sh so'rov - ro'yxat
 * TARTIBI o'zgarishsiz qaytariladi (asl holat saqlanadi).
 *
 * @param {Array} products
 * @param {string} query - foydalanuvchi kiritgan xom qidiruv matni
 */
/**
 * @param {Array} products
 * @param {string} query - foydalanuvchi kiritgan xom qidiruv matni
 * @param {string[][]} [synonymGroups] - 15-NICHE UNIVERSAL PLATFORMA: do'kon
 *   sohasining (niche) sinonim guruhlari (`config/niches.js`dagi
 *   `search.synonymGroups`) - berilmasa, oldingi xatti-harakat
 *   o'zgarishsiz qoladi (orqaga moslik).
 */
export function searchProducts(products, query, synonymGroups = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return products;

  const queryVariants = expandQueryWithSynonyms(normalizedQuery, synonymGroups);

  return products
    .map((product, index) => ({
      product,
      index,
      // Mahsulot QAYSI variantga (asl so'rov yoki sinonim orqali
      // kengaytirilgan) yaxshiroq mos kelsa, o'sha eng yuqori ball
      // ishlatiladi - shu orqali "телефон" deb qidirilganda "telefon"
      // nomli mahsulot ham, aynan "телефон" so'zini o'z ichiga olgan
      // mahsulot ham bir xil adolatli tartiblanadi.
      score: Math.max(...queryVariants.map((variant) => computeProductSearchScore(product, variant))),
    }))
    .filter((entry) => entry.score > 0)
    // Barqaror tartiblash: bir xil ball bo'lsa, ASL tartib saqlanadi
    // (`index` bo'yicha "tie-break") - natijalar har safar bir xil
    // ketma-ketlikda chiqishi uchun.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.product);
}
