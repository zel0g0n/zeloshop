/**
 * MAHSULOT ATRIBUTLARI UCHUN O'ZBEKCHA YORLIQLAR (backend nusxasi).
 *
 * 2026-09, foydalanuvchi savoli bilan qo'shildi: "agar sotuvchi
 * qo'shimcha xususiyatlarni (brend, teri turi, hajm va h.k.) to'ldirgan
 * bo'lsa, kanal posti buni hisobga oladimi?" — TEKSHIRUV natijasi:
 * OLDIN yo'q edi, `buildProductChannelPost` faqat nom/tavsif/narx/
 * zaxira/kategoriyani ko'rsatardi. Bu fayl shu bo'shliqni to'ldiradi.
 *
 * NEGA ALOHIDA FAYL (frontend'dagi `src/config/attributeDictionary.js`
 * va `src/i18n/translations.js`dagi `productAttributes.*`dan
 * FOYDALANILMAYDI): `functions/` — Cloud Functions uchun MUSTAQIL Node
 * paketi (o'z `package.json`i, alohida deploy qilinadi), `src/` esa
 * frontend React ilovasi — ular BIR-BIRIGA IMPORT QILA OLMAYDI
 * (Firebase deploy faqat `functions/` papkasini yuklaydi, `src/`ni
 * emas). Kanal posti HAR DOIM oddiy, qattiq yozilgan o'zbek tilida
 * (frontend'ning uz/ru/en tanlovidan MUSTAQIL — xuddi "Zaxirada",
 * "Yangi mahsulot" kabi boshqa matnlar kabi), shuning uchun bu yerda
 * FAQAT o'zbekcha yorliqlar kerak — to'liq uch tilli lug'at emas.
 *
 * QIYMATLAR `src/i18n/translations.js`dagi `productAttributes` (uz)
 * bo'limidan AYNAN, o'zgarishsiz ko'chirilgan — ikkala joyda BIR XIL
 * so'z ishlatilishi uchun (masalan frontend'da "Teri turi: Yog'li"
 * ko'rsatilsa, kanal postida ham AYNAN shu so'z chiqishi kerak).
 * Kelajakda frontend tomonda yangi atribut qo'shilsa, bu yerga ham
 * qo'lda qo'shish kerak (avtomatik sinxronlanmaydi — ikkala fayl
 * MUSTAQIL paketlarda joylashgani uchun boshqa yo'l yo'q).
 */
const ATTRIBUTE_LABELS_UZ = {
  brand: { label: "Brend" },
  productType: { label: "Mahsulot turi" },
  model: { label: "Model" },
  color: { label: "Rang" },
  material: { label: "Material" },
  size: { label: "O'lcham" },
  euSize: { label: "EU o'lcham" },
  usSize: { label: "US o'lcham" },
  weight: { label: "Og'irlik" },
  dimensions: { label: "O'lchamlar" },
  shape: { label: "Shakl" },
  style: { label: "Stil" },
  pattern: { label: "Naqsh" },
  collection: { label: "Kolleksiya" },
  capacity: { label: "Sig'im" },
  compartments: { label: "Bo'limlar soni" },
  room: { label: "Xona", options: { living_room: "Mehmonxona", bedroom: "Yotoqxona", kitchen: "Oshxona", bathroom: "Hammom", office: "Ofis", other: "Boshqa" } },
  gender: { label: "Jins", options: { men: "Erkak", women: "Ayol", unisex: "Unisex", kids: "Bolalar" } },
  fit: { label: "Fasoni", options: { slim: "Slim", regular: "Regular", oversize: "Oversize", loose: "Erkin" } },
  season: { label: "Mavsum", options: { summer: "Yoz", winter: "Qish", demi: "Bahor-kuz", all_season: "Barcha mavsum" } },
  soleType: { label: "Taglik turi" },
  assemblyRequired: { label: "Yig'ish talab qilinadi", options: { yes: "Ha", no: "Yo'q" } },
  storage: { label: "Xotira" },
  ram: { label: "RAM" },
  battery: { label: "Batareya" },
  screenSize: { label: "Ekran o'lchami" },
  connectivity: { label: "Ulanish turi" },
  compatibility: { label: "Moslik" },
  warranty: { label: "Kafolat" },
  processor: { label: "Protsessor" },
  operatingSystem: { label: "Operatsion tizim" },
  skinType: { label: "Teri turi", options: { oily: "Yog'li", dry: "Quruq", combination: "Aralash", sensitive: "Sezgir", normal: "Normal", all: "Barcha turlar" } },
  hairType: { label: "Soch turi", options: { oily: "Yog'li", dry: "Quruq", normal: "Normal", all: "Barcha turlar" } },
  shade: { label: "Ton/Reng" },
  volume: { label: "Hajm" },
  ingredients: { label: "Tarkib" },
  spf: { label: "SPF" },
  fragrance: { label: "Hid" },
  benefits: { label: "Foydali xususiyatlari" },
  finish: { label: "Finish" },
  ageGroup: { label: "Yosh guruhi" },
  age: { label: "Yosh" },
  recommendedAge: { label: "Tavsiya etilgan yosh" },
  safetyInfo: { label: "Xavfsizlik ma'lumoti" },
  metal: { label: "Metall" },
  stone: { label: "Tosh" },
  occasion: { label: "Tadbir" },
  recipient: { label: "Kimga mo'ljallangan" },
  personalization: { label: "Shaxsiylashtirish", options: { yes: "Ha", no: "Yo'q" } },
  giftPackaging: { label: "Sovg'a o'rami", options: { yes: "Ha", no: "Yo'q" } },
  priceRange: { label: "Narx toifasi" },
  animalType: { label: "Hayvon turi" },
  breed: { label: "Zoti" },
  flavor: { label: "Ta'mi" },
  sport: { label: "Sport turi" },
  skillLevel: { label: "Daraja", options: { beginner: "Boshlang'ich", intermediate: "O'rta", advanced: "Yuqori" } },
  skill: { label: "Daraja", options: { beginner: "Boshlang'ich", intermediate: "O'rta", advanced: "Yuqori" } },
  usage: { label: "Qo'llanilishi" },
  author: { label: "Muallif" },
  publisher: { label: "Nashriyot" },
  language: { label: "Til" },
  isbn: { label: "ISBN" },
  genre: { label: "Janr" },
  pages: { label: "Sahifalar soni" },
  format: { label: "Format" },
  subject: { label: "Mavzu" },
  carBrand: { label: "Avtomobil brendi" },
  carModel: { label: "Avtomobil modeli" },
  year: { label: "Yil" },
  engine: { label: "Dvigatel" },
  oemNumber: { label: "OEM raqami" },
  partNumber: { label: "Detal raqami" },
  power: { label: "Quvvat" },
  voltage: { label: "Voltaj" },
  batteryRequired: { label: "Batareya talab qilinadi", options: { yes: "Ha", no: "Yo'q" } },
  numberOfPieces: { label: "Qismlar soni" },
  difficulty: { label: "Qiyinlik darajasi", options: { easy: "Oson", medium: "O'rta", hard: "Qiyin" } },
};

/**
 * Bitta atribut kaliti+qiymati uchun "Yorliq: Qiymat" qatorini quradi.
 * Lug'atda yo'q (kelajakda frontend'ga qo'shilgan-u, bu yerga hali
 * ko'chirilmagan) kalitlar uchun ham — HECH NARSANI YASHIRMASDAN —
 * xavfsiz standart (kalitning o'zi, boshi katta harf bilan) ishlatiladi.
 */
function formatAttributeEntry(key, value) {
  const def = ATTRIBUTE_LABELS_UZ[key];
  const label = def?.label || (key.charAt(0).toUpperCase() + key.slice(1));
  const displayValue = def?.options?.[value] || String(value);
  return `${label}: ${displayValue}`;
}

/**
 * Mahsulotning dinamik `attributes` obyektini ({skinType: "oily", ...})
 * bitta, ixcham "Brend: X · Teri turi: Y" qatoriga aylantiradi — kanal
 * postida bitta qator sifatida ko'rinishi uchun ( `formatProductAttributesForDisplay`
 * dagi kabi RO'YXAT emas — u yerda alohida kartochkalar UI'da chizilgan,
 * bu yerda esa oddiy Telegram matni, joy tejash uchun bitta qatorga
 * jamlanadi).
 *
 * Sof funksiya - to'g'ridan-to'g'ri test qilinadi.
 *
 * @param {Object|undefined} attributes
 * @returns {string} - bo'sh bo'lsa "" (chaqiruvchi bu holda qatorni
 *   umuman qo'shmasligi kerak).
 */
function formatAttributesLine(attributes) {
  if (!attributes || typeof attributes !== "object") return "";
  const entries = Object.entries(attributes)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => formatAttributeEntry(key, value));
  return entries.join(" · ");
}

module.exports = { ATTRIBUTE_LABELS_UZ, formatAttributeEntry, formatAttributesLine };
