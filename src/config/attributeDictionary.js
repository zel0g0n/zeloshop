/**
 * UNIVERSAL MAHSULOT ATRIBUTLARI LUG'ATI (15 niche uchun umumiy).
 *
 * Bu — ZeloShop'ni "faqat Kosmetika" platformadan 15 xil soha (niche)ni
 * qo'llab-quvvatlaydigan universal platformaga aylantirish ishining
 * asosiy qismi. Har bir niche o'zining atributlar ro'yxatiga ega
 * (`niches.js`dagi `attributeKeys`), lekin ko'p atributlar (masalan
 * "Brand", "Color", "Material") bir nechta niche'da BIR XIL ma'noda
 * takrorlanadi — shuning uchun ular shu yerda BIR MARTA aniqlanadi va
 * niche configlar faqat KALIT orqali murojaat qiladi (DRY).
 *
 * Har bir atribut:
 *   - `key`   — Firestore'da `product.attributes.<key>` sifatida
 *               saqlanadigan barqaror, ingliz tilidagi identifikator
 *               (hech qachon o'zgartirilmaydi, aks holda mavjud
 *               mahsulotlar ma'lumoti "yo'qolib qoladi").
 *   - `type`  — "select" (yopiq, oldindan belgilangan variantlar),
 *               "text" (erkin matn), "number" (sof raqam).
 *   - `options` — faqat "select" turi uchun, `{value, labelKey}[]`.
 *   - `aiExtractable` — AI (mahsulot nomi/tavsifidan) shu atributni
 *               AVTOMATIK aniqlashga urinishi mumkinmi. `false` bo'lgan
 *               atributlar (masalan `ingredients`, `oemNumber`,
 *               `warranty`, `safetyInfo`, `compatibility`) — bular
 *               AI o'ylab topsa xavfli bo'lgan, sotuvchi FAQAT o'zi
 *               kiritishi kerak bo'lgan maydonlar (batafsil izoh:
 *               loyihaning "AI hech qachon mavjud bo'lmagan
 *               spetsifikatsiyani o'ylab topmasin" tamoyili).
 *
 * Labellar (`labelKey`) `src/i18n/translations.js`dagi
 * `productAttributes.*` ostida joylashgan — uz/ru/en barchasida.
 */

export const ATTRIBUTE_TYPES = { SELECT: "select", TEXT: "text", NUMBER: "number" };

const opt = (value, labelKey) => ({ value, labelKey });

export const ATTRIBUTE_DICTIONARY = {
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
  room: {
    type: "select",
    aiExtractable: true,
    options: [
      opt("living_room", "room.livingRoom"), opt("bedroom", "room.bedroom"),
      opt("kitchen", "room.kitchen"), opt("bathroom", "room.bathroom"),
      opt("office", "room.office"), opt("other", "room.other"),
    ],
  },
  gender: {
    type: "select",
    aiExtractable: true,
    options: [opt("men", "gender.men"), opt("women", "gender.women"), opt("unisex", "gender.unisex"), opt("kids", "gender.kids")],
  },
  fit: {
    type: "select",
    aiExtractable: true,
    options: [opt("slim", "fit.slim"), opt("regular", "fit.regular"), opt("oversize", "fit.oversize"), opt("loose", "fit.loose")],
  },
  season: {
    type: "select",
    aiExtractable: true,
    options: [opt("summer", "season.summer"), opt("winter", "season.winter"), opt("demi", "season.demi"), opt("all_season", "season.allSeason")],
  },
  soleType: { type: "text", aiExtractable: false },
  assemblyRequired: {
    type: "select",
    aiExtractable: false,
    options: [opt("yes", "boolean.yes"), opt("no", "boolean.no")],
  },
  storage: { type: "text", aiExtractable: true },
  ram: { type: "text", aiExtractable: true },
  battery: { type: "text", aiExtractable: false },
  screenSize: { type: "text", aiExtractable: true },
  connectivity: { type: "text", aiExtractable: false },
  compatibility: { type: "text", aiExtractable: false },
  warranty: { type: "text", aiExtractable: false },
  processor: { type: "text", aiExtractable: true },
  operatingSystem: { type: "text", aiExtractable: true },
  skinType: {
    type: "select",
    aiExtractable: true,
    options: [
      opt("oily", "skinType.oily"), opt("dry", "skinType.dry"), opt("combination", "skinType.combination"),
      opt("sensitive", "skinType.sensitive"), opt("normal", "skinType.normal"), opt("all", "skinType.all"),
    ],
  },
  hairType: {
    type: "select",
    aiExtractable: true,
    options: [opt("oily", "hairType.oily"), opt("dry", "hairType.dry"), opt("normal", "hairType.normal"), opt("all", "hairType.all")],
  },
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
  personalization: {
    type: "select",
    aiExtractable: false,
    options: [opt("yes", "boolean.yes"), opt("no", "boolean.no")],
  },
  giftPackaging: {
    type: "select",
    aiExtractable: false,
    options: [opt("yes", "boolean.yes"), opt("no", "boolean.no")],
  },
  priceRange: { type: "text", aiExtractable: false },
  animalType: { type: "text", aiExtractable: true },
  breed: { type: "text", aiExtractable: false },
  flavor: { type: "text", aiExtractable: true },
  sport: { type: "text", aiExtractable: true },
  skillLevel: {
    type: "select",
    aiExtractable: false,
    options: [opt("beginner", "level.beginner"), opt("intermediate", "level.intermediate"), opt("advanced", "level.advanced")],
  },
  skill: {
    type: "select",
    aiExtractable: false,
    options: [opt("beginner", "level.beginner"), opt("intermediate", "level.intermediate"), opt("advanced", "level.advanced")],
  },
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
  batteryRequired: {
    type: "select",
    aiExtractable: false,
    options: [opt("yes", "boolean.yes"), opt("no", "boolean.no")],
  },
  numberOfPieces: { type: "number", aiExtractable: false },
  difficulty: {
    type: "select",
    aiExtractable: false,
    options: [opt("easy", "difficulty.easy"), opt("medium", "difficulty.medium"), opt("hard", "difficulty.hard")],
  },
};

/** Berilgan kalit uchun to'liq atribut ta'rifini (turi, variantlari) qaytaradi. */
export function getAttributeDefinition(key) {
  return ATTRIBUTE_DICTIONARY[key] || null;
}
