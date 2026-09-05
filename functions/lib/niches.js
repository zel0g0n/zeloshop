/**
 * BACKEND NICHE CONFIGURATION (15 ta soha) — AI promptlari va
 * validatsiya uchun.
 *
 * MUHIM: bu fayl `src/config/niches.js`dagi (frontend) konfiguratsiya
 * bilan MA'NOAN BIR XIL, lekin JISMONIY ravishda ALOHIDA saqlanadi.
 * Sabab — mavjud kod bazasida ALLAQACHON o'rnatilgan yondashuv:
 * `functions/productDrafts.js`dagi `KOSMETIKA_CATEGORIES` ham xuddi
 * shunday, frontend'dagi mos konstantadan ALOHIDA saqlangan (chunki
 * frontend ESM (`export const`), backend esa CommonJS (`require`) —
 * ikkalasi alohida deploy qilinadigan, bir-biridan mustaqil paketlar,
 * bittasi ikkinchisini to'g'ridan-to'g'ri import qila olmaydi).
 *
 * IKKALASINI YANGILAGANDA MOS TUTISH KERAK: agar bu yerga yangi
 * kategoriya/atribut qo'shilsa, `src/config/niches.js`ga ham qo'shish
 * kerak (va aksincha). ID'lar (`sellers.category` qiymatlari) ikkala
 * faylda HAM ANIQ bir xil bo'lishi SHART.
 */

const NICHES = [
  {
    id: "Kosmetika",
    categories: ["Yuz parvarishi", "Dekorativ kosmetika", "Soch parvarishi", "Parfyumeriya", "Tana parvarishi", "Shaxsiy gigiena", "Asboblar va aksessuarlar", "Erkaklar uchun", "Tirnoq parvarishi", "Quyoshdan himoya"],
    attributeKeys: ["brand", "productType", "skinType", "hairType", "shade", "color", "volume", "weight", "ingredients", "spf", "fragrance", "gender", "benefits", "finish", "ageGroup"],
    aiContext: "Bu — go'zallik va kosmetika do'koni. Mahsulotlar: dekorativ kosmetika, teri/soch parvarishi, parfyumeriya. Atamalar: teri turi, soch turi, SPF, hid, tarkib, ton.",
  },
  {
    id: "Kiyim-kechak",
    categories: ["Ayollar kiyimi", "Erkaklar kiyimi", "Bolalar kiyimi", "Ko'ylaklar", "Kofta va toplar", "Futbolkalar", "Rubashkalar", "Xudilar", "Shimlar", "Jinsi shimlar", "Kurtkalar", "Tashqi kiyim", "Sport kiyimi", "Ichki kiyim", "Aksessuarlar"],
    attributeKeys: ["gender", "size", "color", "material", "brand", "fit", "style", "season", "pattern", "collection"],
    aiContext: "Bu — kiyim-kechak do'koni. Atamalar: o'lcham (S/M/L/XL), rang, material (paxta, jins), fason, mavsum.",
  },
  {
    id: "Poyabzal",
    categories: ["Krossovkalar", "Kundalik poyabzal", "Rasmiy poyabzal", "Etiklar", "Sandallar", "Baland poshnali", "Sport poyabzali", "Bolalar poyabzali", "Shippaklar"],
    attributeKeys: ["gender", "size", "euSize", "usSize", "color", "material", "brand", "season", "soleType", "style"],
    aiContext: "Bu — poyabzal do'koni. Atamalar: o'lcham (EU/US), rang, material, taglik turi.",
  },
  {
    id: "Uy-ro'zg'or buyumlari",
    categories: ["Mebel", "Yoritish", "Dekor", "Oshxona buyumlari", "Yotoqxona", "Hammom", "Saqlash tizimlari", "Tekstil", "Devor dekoratsiyasi", "Uy aksessuarlari"],
    attributeKeys: ["material", "color", "dimensions", "weight", "style", "room", "brand", "assemblyRequired", "shape"],
    aiContext: "Bu — uy va dekor do'koni. Atamalar: material, o'lchamlar, xona turi, stil.",
  },
  {
    id: "Elektronika",
    categories: ["Smartfonlar", "Planshetlar", "Noutbuklar", "Kompyuterlar", "Quloqchinlar", "Aqlli soatlar", "Kameralar", "O'yin uskunalari", "Aksessuarlar", "Zaryadlagichlar", "Kabellar", "Aqlli uy"],
    attributeKeys: ["brand", "model", "storage", "ram", "color", "battery", "screenSize", "connectivity", "compatibility", "warranty", "processor", "operatingSystem"],
    aiContext: "Bu — elektronika va gadjetlar do'koni. Atamalar: xotira (GB), RAM, protsessor, ekran o'lchami, ulanish turi. HECH QACHON mavjud bo'lmagan texnik xususiyatni o'ylab topma.",
  },
  {
    id: "Bolalar tovarlari",
    categories: ["Chaqaloq kiyimi", "Bolalar kiyimi", "O'yinchoqlar", "Ovqatlantirish buyumlari", "Chaqaloq parvarishi", "Aravachalar", "Avto o'rindiqlar", "Bolalar xonasi", "Maktab buyumlari", "Bolalar aksessuarlari"],
    attributeKeys: ["age", "gender", "size", "material", "color", "safetyInfo", "brand", "weight", "recommendedAge"],
    aiContext: "Bu — bolalar va chaqaloq tovarlari do'koni. Atamalar: yosh guruhi, o'lcham, xavfsizlik. Xavfsizlik ma'lumotini HECH QACHON o'ylab topma.",
  },
  {
    id: "Zargarlik va aksessuarlar",
    categories: ["Uzuklar", "Bo'yinbog'lar", "Bilakuzuklar", "Sirg'alar", "Soatlar", "Brochlar", "Soch aksessuarlari", "Moda aksessuarlari"],
    attributeKeys: ["material", "metal", "stone", "size", "color", "gender", "brand", "collection", "style"],
    aiContext: "Bu — zargarlik va aksessuarlar do'koni. Atamalar: metall turi, tosh, o'lcham.",
  },
  {
    id: "Suvenir mahsulotlar",
    categories: ["Tug'ilgan kun sovg'alari", "To'y sovg'alari", "Korporativ sovg'alar", "Shaxsiylashtirilgan sovg'alar", "Suvenirlar", "Romantik sovg'alar", "Sovg'a to'plamlari", "Qo'lda yasalgan sovg'alar"],
    attributeKeys: ["occasion", "recipient", "personalization", "material", "color", "size", "giftPackaging", "priceRange"],
    aiContext: "Bu — sovg'a va suvenir do'koni. Xaridorning maqsadi (tadbir, kimga mo'ljallangan) muhim.",
  },
  {
    id: "Uy hayvonlari tovarlari",
    categories: ["It uchun", "Mushuk uchun", "Qushlar", "Baliqlar", "Mayda hayvonlar", "Aksessuarlar", "O'yinchoqlar", "Parvarish vositalari", "Yotoqchalar", "Bo'yinbog'lar", "Etaklar"],
    attributeKeys: ["animalType", "breed", "age", "size", "material", "weight", "flavor", "brand"],
    aiContext: "Bu — uy hayvonlari tovarlari do'koni. Atamalar: hayvon turi, zoti, ta'mi (ovqat uchun).",
  },
  {
    id: "Sport va faollik",
    categories: ["Fitnes", "Trenajyorlar", "Yugurish", "Futbol", "Basketbol", "Velosiped sporti", "Yoga", "Ochiq havoda", "Sport kiyimi", "Sport aksessuarlari"],
    attributeKeys: ["sport", "gender", "size", "material", "weight", "brand", "skillLevel", "color", "usage"],
    aiContext: "Bu — sport va fitnes do'koni. Atamalar: sport turi, daraja (boshlang'ich/o'rta/yuqori).",
  },
  {
    id: "Kitoblar",
    categories: ["Kitoblar", "Daftarlar", "Ruchka va qalamlar", "Maktab buyumlari", "Ofis buyumlari", "San'at buyumlari", "Kundaliklar", "Ta'lim materiallari"],
    attributeKeys: ["author", "publisher", "language", "isbn", "genre", "pages", "ageGroup", "format", "subject"],
    aiContext: "Bu — kitob va kantselyariya do'koni. Atamalar: muallif, janr, til, sahifalar soni. ISBN va nashriyot ma'lumotini HECH QACHON o'ylab topma.",
  },
  {
    id: "Avto ehtiyot qismlari",
    categories: ["Dvigatel", "Osma tizimi", "Tormozlar", "Elektr jihozlari", "Salon jihozlari", "Tashqi qism", "Shinalar", "Disklar", "Avto aksessuarlar", "Asboblar"],
    attributeKeys: ["carBrand", "carModel", "year", "engine", "oemNumber", "partNumber", "compatibility", "material", "brand"],
    aiContext: "Bu — avto ehtiyot qismlari do'koni. Atamalar: avtomobil brendi/modeli, yil, dvigatel, OEM raqami.",
    // MUHIM QOIDA: "Bu detal qaysi mashinaga mos?" degan savolga AI
    // FAQAT mahsulotning `compatibility` maydonida ANIQ yozilgan
    // ma'lumot asosida javob bersin. Agar bu maydon bo'sh yoki
    // yetarli bo'lmasa, AI "Mosligini aniqlash uchun yetarli ma'lumot
    // mavjud emas" deb javob bersin — hech qachon taxmin qilmasin.
    compatibilityStrict: true,
  },
  {
    id: "Asboblar va qurilish",
    categories: ["Qo'l asboblari", "Elektr asboblar", "Qurilish materiallari", "Elektr jihozlari", "Santexnika", "Xavfsizlik vositalari", "Metizlar", "Ustaxona jihozlari", "O'lchash asboblari"],
    attributeKeys: ["brand", "material", "power", "voltage", "dimensions", "weight", "warranty", "usage", "compatibility"],
    aiContext: "Bu — asboblar va qurilish materiallari do'koni. Atamalar: quvvat, voltaj, moslik.",
  },
  {
    id: "Sumka va charm buyumlar",
    categories: ["Qo'l sumkalari", "Ryukzaklar", "Hamyonlar", "Sayohat sumkalari", "Noutbuk sumkalari", "Portfellar", "Yelka sumkalari", "Yo'l sumkalari"],
    attributeKeys: ["material", "color", "size", "capacity", "gender", "brand", "style", "compartments"],
    aiContext: "Bu — sumka va charm buyumlar do'koni. Atamalar: material (charm, ekokoja), sig'im, bo'limlar soni.",
  },
  {
    id: "O'yinchoqlar va xobbi",
    categories: ["Ta'limiy o'yinchoqlar", "Qo'g'irchoqlar", "Mashinachalar", "Konstruktorlar", "Boshqotirmalar", "Ochiq havo o'yinchoqlari", "Radioboshqaruvli o'yinchoqlar", "Kolleksion buyumlar", "Xobbi mahsulotlari", "Nastol o'yinlari"],
    attributeKeys: ["age", "gender", "material", "brand", "recommendedAge", "skill", "batteryRequired", "numberOfPieces", "difficulty"],
    aiContext: "Bu — o'yinchoqlar va xobbi do'koni. Atamalar: tavsiya etilgan yosh, qismlar soni, qiyinlik darajasi.",
  },
];

const OTHER_NICHE = {
  id: "Boshqa",
  categories: ["Boshqa"],
  attributeKeys: ["brand", "color", "material"],
  aiContext: "Bu — onlayn do'kon. Mahsulot haqidagi faktlarni sotuvchi bergan ma'lumotdan tashqari hech qachon o'ylab topma.",
};

const NICHE_BY_ID = new Map(NICHES.map((n) => [n.id, n]));

const NICHE_IDS = NICHES.map((n) => n.id);

/** Berilgan ID uchun to'liq niche konfiguratsiyasini qaytaradi (topilmasa "Boshqa"). */
function getNicheConfig(nicheId) {
  return NICHE_BY_ID.get(nicheId) || OTHER_NICHE;
}

/** Berilgan niche uchun kategoriyalar ro'yxati (faqat qiymatlar). */
function getCategoriesForNiche(nicheId) {
  return getNicheConfig(nicheId).categories;
}

module.exports = { NICHES, NICHE_IDS, OTHER_NICHE, getNicheConfig, getCategoriesForNiche };
