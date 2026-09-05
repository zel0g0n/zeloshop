/**
 * BACKEND ATRIBUTLAR LUG'ATI — `src/config/attributeDictionary.js`
 * (frontend) bilan MA'NOAN BIR XIL, lekin JISMONIY ravishda ALOHIDA
 * saqlanadi (batafsil sabab: `lib/niches.js`dagi izoh — ikkalasi
 * alohida deploy qilinadigan paketlar).
 *
 * BU FAYL AI EKSTRAKSIYASI UCHUN ISHLATILADI (`productDrafts.js`):
 * `aiExtractable: false` bo'lgan atributlar AI'dan HECH QACHON
 * so'ralmaydi va AI ularni "topib bersa" ham har doim rad etiladi —
 * bu, loyihaning "AI hech qachon mavjud bo'lmagan tarkib/texnik
 * xususiyat/moslik/kafolat/sertifikat/xavfsizlik ma'lumotini o'ylab
 * topmasin" qat'iy qoidasini amalga oshiradi.
 *
 * Frontend versiyasidan farqi: bu yerda `labelKey` YO'Q (backend UI
 * ko'rsatmaydi, faqat validatsiya qiladi) — `options` oddiy qiymatlar
 * ro'yxati ({value}[] o'rniga string[]).
 *
 * IKKALASINI YANGILAGANDA MOS TUTISH KERAK: `key`, `type`,
 * `aiExtractable` va "select" `options` qiymatlari ikkala faylda ham
 * ANIQ bir xil bo'lishi SHART.
 */

const ATTRIBUTE_DICTIONARY = {
  brand: { type: "text", aiExtractable: true },
  productType: { type: "text", aiExtractable: true },
  model: { type: "text", aiExtractable: true },
  color: { type: "text", aiExtractable: true },
  material: { type: "text", aiExtractable: true },
  size: { type: "text", aiExtractable: true },
  euSize: { type: "text", aiExtractable: true },
  usSize: { type: "text", aiExtractable: true },
  weight: { type: "text", aiExtractable: true },
  dimensions: { type: "text", aiExtractable: false },
  shape: { type: "text", aiExtractable: true },
  style: { type: "text", aiExtractable: true },
  pattern: { type: "text", aiExtractable: true },
  collection: { type: "text", aiExtractable: false },
  capacity: { type: "text", aiExtractable: true },
  compartments: { type: "number", aiExtractable: false },
  room: { type: "select", aiExtractable: true, options: ["living_room", "bedroom", "kitchen", "bathroom", "office", "other"] },
  gender: { type: "select", aiExtractable: true, options: ["men", "women", "unisex", "kids"] },
  fit: { type: "select", aiExtractable: true, options: ["slim", "regular", "oversize", "loose"] },
  season: { type: "select", aiExtractable: true, options: ["summer", "winter", "demi", "all_season"] },
  soleType: { type: "text", aiExtractable: false },
  assemblyRequired: { type: "select", aiExtractable: false, options: ["yes", "no"] },
  storage: { type: "text", aiExtractable: true },
  ram: { type: "text", aiExtractable: true },
  battery: { type: "text", aiExtractable: false },
  screenSize: { type: "text", aiExtractable: true },
  connectivity: { type: "text", aiExtractable: false },
  compatibility: { type: "text", aiExtractable: false },
  warranty: { type: "text", aiExtractable: false },
  processor: { type: "text", aiExtractable: true },
  operatingSystem: { type: "text", aiExtractable: true },
  skinType: { type: "select", aiExtractable: true, options: ["oily", "dry", "combination", "sensitive", "normal", "all"] },
  hairType: { type: "select", aiExtractable: true, options: ["oily", "dry", "normal", "all"] },
  shade: { type: "text", aiExtractable: true },
  volume: { type: "text", aiExtractable: true },
  ingredients: { type: "text", aiExtractable: false },
  spf: { type: "number", aiExtractable: true },
  fragrance: { type: "text", aiExtractable: true },
  benefits: { type: "text", aiExtractable: false },
  finish: { type: "text", aiExtractable: true },
  ageGroup: { type: "text", aiExtractable: false },
  age: { type: "text", aiExtractable: false },
  recommendedAge: { type: "text", aiExtractable: false },
  safetyInfo: { type: "text", aiExtractable: false },
  metal: { type: "text", aiExtractable: true },
  stone: { type: "text", aiExtractable: true },
  occasion: { type: "text", aiExtractable: true },
  recipient: { type: "text", aiExtractable: true },
  personalization: { type: "select", aiExtractable: false, options: ["yes", "no"] },
  giftPackaging: { type: "select", aiExtractable: false, options: ["yes", "no"] },
  priceRange: { type: "text", aiExtractable: false },
  animalType: { type: "text", aiExtractable: true },
  breed: { type: "text", aiExtractable: false },
  flavor: { type: "text", aiExtractable: true },
  sport: { type: "text", aiExtractable: true },
  skillLevel: { type: "select", aiExtractable: false, options: ["beginner", "intermediate", "advanced"] },
  skill: { type: "select", aiExtractable: false, options: ["beginner", "intermediate", "advanced"] },
  usage: { type: "text", aiExtractable: false },
  author: { type: "text", aiExtractable: true },
  publisher: { type: "text", aiExtractable: false },
  language: { type: "text", aiExtractable: true },
  isbn: { type: "text", aiExtractable: false },
  genre: { type: "text", aiExtractable: true },
  pages: { type: "number", aiExtractable: false },
  format: { type: "text", aiExtractable: true },
  subject: { type: "text", aiExtractable: true },
  carBrand: { type: "text", aiExtractable: false },
  carModel: { type: "text", aiExtractable: false },
  year: { type: "number", aiExtractable: false },
  engine: { type: "text", aiExtractable: false },
  oemNumber: { type: "text", aiExtractable: false },
  partNumber: { type: "text", aiExtractable: false },
  power: { type: "text", aiExtractable: true },
  voltage: { type: "text", aiExtractable: true },
  batteryRequired: { type: "select", aiExtractable: false, options: ["yes", "no"] },
  numberOfPieces: { type: "number", aiExtractable: false },
  difficulty: { type: "select", aiExtractable: false, options: ["easy", "medium", "hard"] },
};

/** Berilgan kalit uchun to'liq atribut ta'rifini qaytaradi (topilmasa null). */
function getAttributeDefinition(key) {
  return ATTRIBUTE_DICTIONARY[key] || null;
}

module.exports = { ATTRIBUTE_DICTIONARY, getAttributeDefinition };
