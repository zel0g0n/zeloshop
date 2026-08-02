// Do'kon SOHASI (butun do'konga tegishli, keng ro'yxat) — bu
// `constants/productCategories.js` dagi (Skincare/Makeup/Perfume/Tools)
// mahsulot kategoriyalaridan FARQ QILADI. U yerdagi ro'yxat faqat
// kosmetika mahsulotlari uchun edi; bu yerdagi ro'yxat esa istalgan
// sohadagi sotuvchi ro'yxatdan o'tishi uchun.
//
// ⚠️ Muhim eslatma: hozircha "Mahsulot qo'shish" formasi (BasicInfoCard)
// faqat kosmetika kategoriyalarini taklif qiladi. Agar sotuvchi bu yerda
// "Kiyim-kechak" yoki boshqa sohani tanlasa, mahsulot qo'shishda hali
// ham faqat kosmetika kategoriyalari ko'rinadi — bu nomuvofiqlik, lekin
// uni tuzatish (har bir soha uchun alohida mahsulot kategoriyalari
// tizimi) alohida, kattaroq ish, hozircha so'ralmagan.
export const STORE_NICHES = [
  { value: "Kosmetika", icon: "💄" },
  { value: "Kiyim-kechak", icon: "👕" },
  { value: "Poyabzal", icon: "👟" },
  { value: "Elektronika", icon: "📱" },
  { value: "Texnika mahsulotlari", icon: "🔧" },
  { value: "Uy-ro'zg'or buyumlari", icon: "🏠" },
  { value: "Bolalar tovarlari", icon: "🧸" },
  { value: "Oziq-ovqat", icon: "🍽️" },
  { value: "Konditer mahsulotlari", icon: "🍰" },
  { value: "Sport va faollik", icon: "⚽" },
  { value: "Zargarlik va aksessuarlar", icon: "💍" },
  { value: "Gullar", icon: "💐" },
  { value: "Kitoblar", icon: "📚" },
  { value: "Qo'l mehnati mahsulotlari", icon: "🧶" },
  { value: "Suvenir mahsulotlar", icon: "🎁" },
  { value: "Intim tovarlar", icon: "🔞" },
  { value: "Boshqa", icon: "📦" },
];
