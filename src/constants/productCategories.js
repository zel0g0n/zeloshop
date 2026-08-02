// OLDIN: bu ro'yxat FAQAT kosmetika uchun edi (Skincare/Makeup/Perfume),
// garchi do'kon sohalari ro'yxati (STORE_NICHES) 17 xil sohani o'z ichiga
// olsa ham — Elektronika yoki Kiyim-kechak sotuvchisi uchun bu ro'yxat
// hech qanday ma'noga ega emas edi.
//
// ENDI: har bir soha (niche) o'zining mos subkategoriyalariga ega.
// `getCategoriesForNiche(niche)` — sotuvchining tanlagan sohasiga mos
// kategoriyalarni qaytaradi.
export const NICHE_CATEGORIES = {
  "Kosmetika": [
    { value: "Skincare", label: "Skincare (Krem, Serum)" },
    { value: "Makeup", label: "Makeup (Kosmetika)" },
    { value: "Perfume", label: "Perfume (Atirlar)" },
    { value: "Soch parvarishi", label: "Soch parvarishi" },
    { value: "Jihozlar", label: "Jihozlar" },
  ],
  "Kiyim-kechak": [
    { value: "Erkaklar kiyimi", label: "Erkaklar kiyimi" },
    { value: "Ayollar kiyimi", label: "Ayollar kiyimi" },
    { value: "Bolalar kiyimi", label: "Bolalar kiyimi" },
    { value: "Sport kiyimi", label: "Sport kiyimi" },
  ],
  "Poyabzal": [
    { value: "Erkaklar poyabzali", label: "Erkaklar poyabzali" },
    { value: "Ayollar poyabzali", label: "Ayollar poyabzali" },
    { value: "Bolalar poyabzali", label: "Bolalar poyabzali" },
    { value: "Sport poyabzali", label: "Sport poyabzali" },
  ],
  "Elektronika": [
    { value: "Telefonlar", label: "Telefonlar" },
    { value: "Noutbuklar", label: "Noutbuklar" },
    { value: "Aksessuarlar", label: "Aksessuarlar" },
    { value: "Quloqchinlar", label: "Quloqchinlar" },
    { value: "Aqlli soatlar", label: "Aqlli soatlar" },
  ],
  "Texnika mahsulotlari": [
    { value: "Maishiy texnika", label: "Maishiy texnika" },
    { value: "Kompyuter texnikasi", label: "Kompyuter texnikasi" },
    { value: "Asboblar", label: "Asboblar" },
    { value: "Elektr jihozlari", label: "Elektr jihozlari" },
  ],
  "Uy-ro'zg'or buyumlari": [
    { value: "Oshxona buyumlari", label: "Oshxona buyumlari" },
    { value: "Yotoqxona", label: "Yotoqxona" },
    { value: "Mehmonxona", label: "Mehmonxona" },
    { value: "Tozalash vositalari", label: "Tozalash vositalari" },
  ],
  "Bolalar tovarlari": [
    { value: "O'yinchoqlar", label: "O'yinchoqlar" },
    { value: "Bolalar kiyimi", label: "Bolalar kiyimi" },
    { value: "Chaqaloq buyumlari", label: "Chaqaloq buyumlari" },
  ],
  "Oziq-ovqat": [
    { value: "Sabzavot-meva", label: "Sabzavot-meva" },
    { value: "Go'sht-baliq", label: "Go'sht-baliq" },
    { value: "Non mahsulotlari", label: "Non mahsulotlari" },
    { value: "Ichimliklar", label: "Ichimliklar" },
  ],
  "Konditer mahsulotlari": [
    { value: "Tortlar", label: "Tortlar" },
    { value: "Shirinliklar", label: "Shirinliklar" },
    { value: "Pechenye", label: "Pechenye" },
    { value: "Shokolad", label: "Shokolad" },
  ],
  "Sport va faollik": [
    { value: "Trenajyorlar", label: "Trenajyorlar" },
    { value: "Sport kiyimi", label: "Sport kiyimi" },
    { value: "Sport aksessuarlari", label: "Sport aksessuarlari" },
    { value: "Velosipedlar", label: "Velosipedlar" },
  ],
  "Zargarlik va aksessuarlar": [
    { value: "Uzuklar", label: "Uzuklar" },
    { value: "Zanjirlar", label: "Zanjirlar" },
    { value: "Soatlar", label: "Soatlar" },
    { value: "Sumkalar", label: "Sumkalar" },
  ],
  "Gullar": [
    { value: "Buketlar", label: "Buketlar" },
    { value: "Gulchambarlar", label: "Gulchambarlar" },
    { value: "Ko'chatlar", label: "Ko'chatlar" },
  ],
  "Kitoblar": [
    { value: "Badiiy adabiyot", label: "Badiiy adabiyot" },
    { value: "Darsliklar", label: "Darsliklar" },
    { value: "Bolalar kitoblari", label: "Bolalar kitoblari" },
  ],
  "Qo'l mehnati mahsulotlari": [
    { value: "To'qima", label: "To'qima" },
    { value: "Kulolchilik", label: "Kulolchilik" },
    { value: "Yog'och buyumlar", label: "Yog'och buyumlar" },
  ],
  "Suvenir mahsulotlar": [
    { value: "Uy dekoratsiyasi", label: "Uy dekoratsiyasi" },
    { value: "Sovg'a to'plamlari", label: "Sovg'a to'plamlari" },
    { value: "Magnitlar", label: "Magnitlar" },
  ],
  "Intim tovarlar": [
    { value: "Parfyumeriya", label: "Parfyumeriya" },
    { value: "Kosmetika", label: "Kosmetika" },
    { value: "Aksessuarlar", label: "Aksessuarlar" },
    { value: "Boshqa", label: "Boshqa" },
  ],
  "Boshqa": [
    { value: "Boshqa", label: "Boshqa" },
  ],
};

/** Berilgan soha uchun mos kategoriyalar ro'yxatini qaytaradi. */
export const getCategoriesForNiche = (niche) => {
  return NICHE_CATEGORIES[niche] || NICHE_CATEGORIES["Boshqa"];
};

// Eski kod bilan moslik uchun — hech kim ishlatmasa ham xavfsiz zaxira.
export const PRODUCT_CATEGORIES = NICHE_CATEGORIES["Kosmetika"];
