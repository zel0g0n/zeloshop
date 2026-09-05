/**
 * UNIVERSAL NICHE CONFIGURATION — ZeloShop'ning 15 xil savdo sohasini
 * (niche) qo'llab-quvvatlash arxitekturasining YURAGI.
 *
 * ODDIY QOIDA: "Universal Core + Niche Configuration" — bitta platforma,
 * har bir soha uchun konfiguratsiya. Yangi soha qo'shish = shu faylga
 * bitta yangi obyekt qo'shish (+ tegishli tarjimalar) — 20 ta komponentni
 * qo'lda o'zgartirish SHART EMAS (loyihaning asosiy talabi).
 *
 * MUHIM (moslik/backward compatibility): `id` maydonlari — sotuvchi
 * hujjatida (`sellers/{id}.category`) HOZIRDAN SAQLANAYOTGAN qiymatlar
 * bilan BIR XIL (masalan "Kosmetika"). Bu ATAYLAB shunday: platforma
 * hozirgacha FAQAT "Kosmetika" sohasi bilan ishlagan (barcha mavjud
 * sotuvchilar shu qiymatga ega), shuning uchun ID'larni o'zgartirish
 * MAVJUD PRODUKSIYA MA'LUMOTINI buzgan bo'lardi. Shu sababli:
 *   - "Kosmetika" (Beauty) — mavjud qiymat SAQLANDI, kategoriyalar
 *     ro'yxati esa 8 dan 10 taga (foydalanuvchi so'ragan to'liq
 *     ro'yxatga) KENGAYTIRILDI — bu QO'SHISH, hech narsa o'chirilmadi,
 *     mavjud mahsulotlarning eski kategoriya qiymatlari hali ham
 *     ro'yxatda bor va ishlayveradi.
 *   - Qolgan 14 ta soha — barchasi YANGI (hech qanday mavjud sotuvchi
 *     ulardan birortasini hech qachon tanlay olmagan, chunki onboarding
 *     ekrani ularni umuman ko'rsatmagan — `CreateStoreScreen.jsx`dagi
 *     `FIXED_NICHE`), shuning uchun ularni qo'shish HECH QANDAY
 *     migratsiya xavfi tug'dirmaydi.
 *   - Eski 17 talik ro'yxatdagi, lekin foydalanuvchi so'ragan 15 taga
 *     kirmaydigan qiymatlar ("Texnika mahsulotlari", "Oziq-ovqat",
 *     "Konditer mahsulotlari", "Gullar", "Qo'l mehnati mahsulotlari",
 *     "Intim tovarlar") olib tashlandi — ular ham hech qachon
 *     ishlatilmagan (bir xil sabab).
 *   - "Boshqa" (Other) — 15 taga kirmaydi, lekin xavfsiz ZAXIRA
 *     (fallback) sifatida saqlanadi (`getNicheConfig` noma'lum
 *     qiymat uchun shuni qaytaradi — eski xatti-harakat bilan bir xil).
 *
 * Har bir NicheConfig:
 *   - id, nameKey        — barqaror ID + i18n nom kaliti (`niches.<id>`)
 *   - categories          — {value, label} — label ATAYLAB Uzbek literal
 *                            matn (mavjud "kategoriya qiymatlari
 *                            tarjima qilinmaydi" tamoyili bilan BIR XIL,
 *                            `productCategories.js`dagi izohga qarang)
 *   - attributeKeys        — `attributeDictionary.js`dagi kalitlarga
 *                            murojaat (tartib — forma/filterda
 *                            ko'rsatish tartibi)
 *   - variantSuggestions   — VariantsCard'dagi placeholder/misol uchun
 *   - ai.contextKey        — AI promptlariga qo'shiladigan i18n matn
 *                            kaliti (niche terminologiyasi)
 *   - ai.strictNoGuessKeys — ushbu attributeKey'lar AI tomonidan HECH
 *                            QACHON o'ylab topilmasligi kerak (ular
 *                            allaqachon `attributeDictionary.js`da
 *                            `aiExtractable:false`, bu yerda esa AI
 *                            promptiga ANIQ ta'qiqlash sifatida
 *                            qo'shimcha eslatiladi)
 *   - search.synonymGroups — qidiruv uchun sinonim guruhlari (uz/ru/en)
 *   - recommendations      — [categoryA, categoryB] juftliklari —
 *                            haqiqiy xarid tarixi hali yo'q (sovuq
 *                            start) holatda ishlatiladigan ZAXIRA
 *                            (fallback) tavsiya qoidalari — haqiqiy
 *                            "birga sotib olingan" statistikasi mavjud
 *                            bo'lsa, `productRecommendations.js`dagi
 *                            HAQIQIY ma'lumotga asoslangan tizim doim
 *                            USTUVOR (bu yerdagi qoidalar faqat uni
 *                            TO'LDIRADI, o'rnini bosmaydi).
 */

const cat = (value, label) => ({ value, label });

export const NICHES = [
  {
    id: "Kosmetika",
    nameKey: "niches.beauty",
    categories: [
      cat("Yuz parvarishi", "Yuz parvarishi (Skincare)"),
      cat("Dekorativ kosmetika", "Dekorativ kosmetika (Makeup)"),
      cat("Soch parvarishi", "Soch parvarishi (Haircare)"),
      cat("Parfyumeriya", "Parfyumeriya (Perfume)"),
      cat("Tana parvarishi", "Tana parvarishi (Body Care)"),
      cat("Shaxsiy gigiena", "Shaxsiy gigiena (Personal Care)"),
      cat("Asboblar va aksessuarlar", "Asboblar va aksessuarlar (Beauty Accessories)"),
      cat("Erkaklar uchun", "Erkaklar uchun (Men's Grooming)"),
      cat("Tirnoq parvarishi", "Tirnoq parvarishi (Nail Care)"),
      cat("Quyoshdan himoya", "Quyoshdan himoya (Sun Care)"),
    ],
    attributeKeys: ["brand", "productType", "skinType", "hairType", "shade", "color", "volume", "weight", "ingredients", "spf", "fragrance", "gender", "benefits", "finish", "ageGroup"],
    variantSuggestions: ["shade", "volume"],
    ai: { contextKey: "niches.beauty.aiContext" },
    search: {
      synonymGroups: [
        ["krem", "крем", "cream"],
        ["yog'li teri", "жирная кожа", "oily skin"],
        ["quruq teri", "сухая кожа", "dry skin"],
        ["parfyum", "духи", "perfume", "atir"],
      ],
    },
    recommendations: [
      ["Dekorativ kosmetika", "Asboblar va aksessuarlar"],
      ["Soch parvarishi", "Tana parvarishi"],
      ["Parfyumeriya", "Tana parvarishi"],
    ],
  },
  {
    id: "Kiyim-kechak",
    nameKey: "niches.fashion",
    categories: [
      cat("Ayollar kiyimi", "Ayollar kiyimi (Women)"),
      cat("Erkaklar kiyimi", "Erkaklar kiyimi (Men)"),
      cat("Bolalar kiyimi", "Bolalar kiyimi (Kids)"),
      cat("Ko'ylaklar", "Ko'ylaklar (Dresses)"),
      cat("Kofta va toplar", "Kofta va toplar (Tops)"),
      cat("Futbolkalar", "Futbolkalar (T-Shirts)"),
      cat("Rubashkalar", "Rubashkalar (Shirts)"),
      cat("Xudilar", "Xudilar (Hoodies)"),
      cat("Shimlar", "Shimlar (Pants)"),
      cat("Jinsi shimlar", "Jinsi shimlar (Jeans)"),
      cat("Kurtkalar", "Kurtkalar (Jackets)"),
      cat("Tashqi kiyim", "Tashqi kiyim (Outerwear)"),
      cat("Sport kiyimi", "Sport kiyimi (Sportswear)"),
      cat("Ichki kiyim", "Ichki kiyim (Underwear)"),
      cat("Aksessuarlar", "Aksessuarlar (Accessories)"),
    ],
    attributeKeys: ["gender", "size", "color", "material", "brand", "fit", "style", "season", "pattern", "collection"],
    variantSuggestions: ["size", "color"],
    ai: { contextKey: "niches.fashion.aiContext" },
    search: {
      synonymGroups: [
        ["erkaklar", "мужской", "men"],
        ["ayollar", "женский", "women"],
        ["qora", "черный", "black"],
        ["oq", "белый", "white"],
      ],
    },
    recommendations: [
      ["Ko'ylaklar", "Aksessuarlar"],
      ["Rubashkalar", "Shimlar"],
      ["Xudilar", "Jinsi shimlar"],
    ],
  },
  {
    id: "Poyabzal",
    nameKey: "niches.shoes",
    categories: [
      cat("Krossovkalar", "Krossovkalar (Sneakers)"),
      cat("Kundalik poyabzal", "Kundalik poyabzal (Casual)"),
      cat("Rasmiy poyabzal", "Rasmiy poyabzal (Formal)"),
      cat("Etiklar", "Etiklar (Boots)"),
      cat("Sandallar", "Sandallar (Sandals)"),
      cat("Baland poshnali", "Baland poshnali (Heels)"),
      cat("Sport poyabzali", "Sport poyabzali (Sports Shoes)"),
      cat("Bolalar poyabzali", "Bolalar poyabzali (Kids Shoes)"),
      cat("Shippaklar", "Shippaklar (Slippers)"),
    ],
    attributeKeys: ["gender", "size", "euSize", "usSize", "color", "material", "brand", "season", "soleType", "style"],
    variantSuggestions: ["size", "color"],
    ai: { contextKey: "niches.shoes.aiContext" },
    search: {
      synonymGroups: [
        ["krossovka", "кроссовки", "sneakers"],
        ["erkaklar", "мужской", "men"],
        ["qora", "черный", "black"],
      ],
    },
    recommendations: [["Krossovkalar", "Sport poyabzali"]],
  },
  {
    id: "Uy-ro'zg'or buyumlari",
    nameKey: "niches.home",
    categories: [
      cat("Mebel", "Mebel (Furniture)"),
      cat("Yoritish", "Yoritish (Lighting)"),
      cat("Dekor", "Dekor (Decor)"),
      cat("Oshxona buyumlari", "Oshxona buyumlari (Kitchen)"),
      cat("Yotoqxona", "Yotoqxona (Bedroom)"),
      cat("Hammom", "Hammom (Bathroom)"),
      cat("Saqlash tizimlari", "Saqlash tizimlari (Storage)"),
      cat("Tekstil", "Tekstil (Textiles)"),
      cat("Devor dekoratsiyasi", "Devor dekoratsiyasi (Wall Decor)"),
      cat("Uy aksessuarlari", "Uy aksessuarlari (Home Accessories)"),
    ],
    attributeKeys: ["material", "color", "dimensions", "weight", "style", "room", "brand", "assemblyRequired", "shape"],
    variantSuggestions: ["color", "dimensions"],
    ai: { contextKey: "niches.home.aiContext" },
    search: { synonymGroups: [["mebel", "мебель", "furniture"], ["oshxona", "кухня", "kitchen"]] },
    recommendations: [["Mebel", "Dekor"], ["Yotoqxona", "Tekstil"]],
  },
  {
    id: "Elektronika",
    nameKey: "niches.electronics",
    categories: [
      cat("Smartfonlar", "Smartfonlar (Smartphones)"),
      cat("Planshetlar", "Planshetlar (Tablets)"),
      cat("Noutbuklar", "Noutbuklar (Laptops)"),
      cat("Kompyuterlar", "Kompyuterlar (Computers)"),
      cat("Quloqchinlar", "Quloqchinlar (Headphones)"),
      cat("Aqlli soatlar", "Aqlli soatlar (Smart Watches)"),
      cat("Kameralar", "Kameralar (Cameras)"),
      cat("O'yin uskunalari", "O'yin uskunalari (Gaming)"),
      cat("Aksessuarlar", "Aksessuarlar (Accessories)"),
      cat("Zaryadlagichlar", "Zaryadlagichlar (Chargers)"),
      cat("Kabellar", "Kabellar (Cables)"),
      cat("Aqlli uy", "Aqlli uy (Smart Home)"),
    ],
    attributeKeys: ["brand", "model", "storage", "ram", "color", "battery", "screenSize", "connectivity", "compatibility", "warranty", "processor", "operatingSystem"],
    variantSuggestions: ["storage", "color"],
    ai: { contextKey: "niches.electronics.aiContext" },
    search: {
      synonymGroups: [
        ["telefon", "телефон", "phone", "smartfon"],
        ["noutbuk", "ноутбук", "laptop"],
        ["gb", "гб", "gigabayt"],
      ],
    },
    recommendations: [["Smartfonlar", "Aksessuarlar"], ["Smartfonlar", "Zaryadlagichlar"], ["Noutbuklar", "Aksessuarlar"]],
  },
  {
    id: "Bolalar tovarlari",
    nameKey: "niches.babyKids",
    categories: [
      cat("Chaqaloq kiyimi", "Chaqaloq kiyimi (Baby Clothing)"),
      cat("Bolalar kiyimi", "Bolalar kiyimi (Kids Clothing)"),
      cat("O'yinchoqlar", "O'yinchoqlar (Toys)"),
      cat("Ovqatlantirish buyumlari", "Ovqatlantirish buyumlari (Feeding)"),
      cat("Chaqaloq parvarishi", "Chaqaloq parvarishi (Baby Care)"),
      cat("Aravachalar", "Aravachalar (Strollers)"),
      cat("Avto o'rindiqlar", "Avto o'rindiqlar (Car Seats)"),
      cat("Bolalar xonasi", "Bolalar xonasi (Nursery)"),
      cat("Maktab buyumlari", "Maktab buyumlari (School Products)"),
      cat("Bolalar aksessuarlari", "Bolalar aksessuarlari (Kids Accessories)"),
    ],
    attributeKeys: ["age", "gender", "size", "material", "color", "safetyInfo", "brand", "weight", "recommendedAge"],
    variantSuggestions: ["size", "age"],
    ai: { contextKey: "niches.babyKids.aiContext" },
    search: { synonymGroups: [["chaqaloq", "младенец", "baby"], ["o'yinchoq", "игрушка", "toy"]] },
    recommendations: [["Aravachalar", "Avto o'rindiqlar"], ["O'yinchoqlar", "Bolalar aksessuarlari"]],
  },
  {
    id: "Zargarlik va aksessuarlar",
    nameKey: "niches.jewelry",
    categories: [
      cat("Uzuklar", "Uzuklar (Rings)"),
      cat("Bo'yinbog'lar", "Bo'yinbog'lar (Necklaces)"),
      cat("Bilakuzuklar", "Bilakuzuklar (Bracelets)"),
      cat("Sirg'alar", "Sirg'alar (Earrings)"),
      cat("Soatlar", "Soatlar (Watches)"),
      cat("Brochlar", "Brochlar (Brooches)"),
      cat("Soch aksessuarlari", "Soch aksessuarlari (Hair Accessories)"),
      cat("Moda aksessuarlari", "Moda aksessuarlari (Fashion Accessories)"),
    ],
    attributeKeys: ["material", "metal", "stone", "size", "color", "gender", "brand", "collection", "style"],
    variantSuggestions: ["size", "metal"],
    ai: { contextKey: "niches.jewelry.aiContext" },
    search: { synonymGroups: [["uzuk", "кольцо", "ring"], ["soat", "часы", "watch"]] },
    recommendations: [["Uzuklar", "Bo'yinbog'lar"], ["Sirg'alar", "Bilakuzuklar"]],
  },
  {
    id: "Suvenir mahsulotlar",
    nameKey: "niches.gifts",
    categories: [
      cat("Tug'ilgan kun sovg'alari", "Tug'ilgan kun sovg'alari (Birthday Gifts)"),
      cat("To'y sovg'alari", "To'y sovg'alari (Wedding Gifts)"),
      cat("Korporativ sovg'alar", "Korporativ sovg'alar (Corporate Gifts)"),
      cat("Shaxsiylashtirilgan sovg'alar", "Shaxsiylashtirilgan sovg'alar (Personalized Gifts)"),
      cat("Suvenirlar", "Suvenirlar (Souvenirs)"),
      cat("Romantik sovg'alar", "Romantik sovg'alar (Romantic Gifts)"),
      cat("Sovg'a to'plamlari", "Sovg'a to'plamlari (Gift Sets)"),
      cat("Qo'lda yasalgan sovg'alar", "Qo'lda yasalgan sovg'alar (Handmade Gifts)"),
    ],
    attributeKeys: ["occasion", "recipient", "personalization", "material", "color", "size", "giftPackaging", "priceRange"],
    variantSuggestions: ["size"],
    ai: { contextKey: "niches.gifts.aiContext" },
    search: { synonymGroups: [["sovg'a", "подарок", "gift"], ["tug'ilgan kun", "день рождения", "birthday"]] },
    recommendations: [["Sovg'a to'plamlari", "Shaxsiylashtirilgan sovg'alar"]],
  },
  {
    id: "Uy hayvonlari tovarlari",
    nameKey: "niches.pets",
    categories: [
      cat("It uchun", "It uchun (Dog)"),
      cat("Mushuk uchun", "Mushuk uchun (Cat)"),
      cat("Qushlar", "Qushlar (Birds)"),
      cat("Baliqlar", "Baliqlar (Fish)"),
      cat("Mayda hayvonlar", "Mayda hayvonlar (Small Animals)"),
      cat("Aksessuarlar", "Aksessuarlar (Accessories)"),
      cat("O'yinchoqlar", "O'yinchoqlar (Toys)"),
      cat("Parvarish vositalari", "Parvarish vositalari (Grooming)"),
      cat("Yotoqchalar", "Yotoqchalar (Beds)"),
      cat("Bo'yinbog'lar", "Bo'yinbog'lar (Collars)"),
      cat("Etaklar", "Etaklar (Leashes)"),
    ],
    attributeKeys: ["animalType", "breed", "age", "size", "material", "weight", "flavor", "brand"],
    variantSuggestions: ["size", "flavor"],
    ai: { contextKey: "niches.pets.aiContext" },
    search: { synonymGroups: [["it", "собака", "dog"], ["mushuk", "кошка", "cat"]] },
    recommendations: [["Bo'yinbog'lar", "Etaklar"], ["It uchun", "O'yinchoqlar"]],
  },
  {
    id: "Sport va faollik",
    nameKey: "niches.sports",
    categories: [
      cat("Fitnes", "Fitnes (Fitness)"),
      cat("Trenajyorlar", "Trenajyorlar (Gym)"),
      cat("Yugurish", "Yugurish (Running)"),
      cat("Futbol", "Futbol (Football)"),
      cat("Basketbol", "Basketbol (Basketball)"),
      cat("Velosiped sporti", "Velosiped sporti (Cycling)"),
      cat("Yoga", "Yoga (Yoga)"),
      cat("Ochiq havoda", "Ochiq havoda (Outdoor)"),
      cat("Sport kiyimi", "Sport kiyimi (Sportswear)"),
      cat("Sport aksessuarlari", "Sport aksessuarlari (Sports Accessories)"),
    ],
    attributeKeys: ["sport", "gender", "size", "material", "weight", "brand", "skillLevel", "color", "usage"],
    variantSuggestions: ["size", "color"],
    ai: { contextKey: "niches.sports.aiContext" },
    search: { synonymGroups: [["futbol", "футбол", "football"], ["trenajyor", "тренажер", "gym"]] },
    recommendations: [["Yugurish", "Sport kiyimi"], ["Fitnes", "Sport aksessuarlari"]],
  },
  {
    id: "Kitoblar",
    nameKey: "niches.books",
    categories: [
      cat("Kitoblar", "Kitoblar (Books)"),
      cat("Daftarlar", "Daftarlar (Notebooks)"),
      cat("Ruchka va qalamlar", "Ruchka va qalamlar (Pens)"),
      cat("Maktab buyumlari", "Maktab buyumlari (School Supplies)"),
      cat("Ofis buyumlari", "Ofis buyumlari (Office Supplies)"),
      cat("San'at buyumlari", "San'at buyumlari (Art Supplies)"),
      cat("Kundaliklar", "Kundaliklar (Planners)"),
      cat("Ta'lim materiallari", "Ta'lim materiallari (Educational Materials)"),
    ],
    attributeKeys: ["author", "publisher", "language", "isbn", "genre", "pages", "ageGroup", "format", "subject"],
    variantSuggestions: ["format"],
    ai: { contextKey: "niches.books.aiContext" },
    search: { synonymGroups: [["kitob", "книга", "book"], ["daftar", "тетрадь", "notebook"]] },
    recommendations: [["Kitoblar", "Kundaliklar"], ["Daftarlar", "Ruchka va qalamlar"]],
  },
  {
    id: "Avto ehtiyot qismlari",
    nameKey: "niches.autoParts",
    categories: [
      cat("Dvigatel", "Dvigatel (Engine)"),
      cat("Osma tizimi", "Osma tizimi (Suspension)"),
      cat("Tormozlar", "Tormozlar (Brakes)"),
      cat("Elektr jihozlari", "Elektr jihozlari (Electrical)"),
      cat("Salon jihozlari", "Salon jihozlari (Interior)"),
      cat("Tashqi qism", "Tashqi qism (Exterior)"),
      cat("Shinalar", "Shinalar (Tires)"),
      cat("Disklar", "Disklar (Wheels)"),
      cat("Avto aksessuarlar", "Avto aksessuarlar (Car Accessories)"),
      cat("Asboblar", "Asboblar (Tools)"),
    ],
    attributeKeys: ["carBrand", "carModel", "year", "engine", "oemNumber", "partNumber", "compatibility", "material", "brand"],
    variantSuggestions: [],
    ai: {
      contextKey: "niches.autoParts.aiContext",
      // MUHIM (foydalanuvchi ANIQ so'ragan qoida): "Bu detal qaysi
      // mashinaga mos?" degan savolga AI FAQAT mavjud `compatibility`
      // maydoni asosida javob bersin, hech qachon taxmin qilmasin.
      compatibilityStrict: true,
    },
    search: { synonymGroups: [["tormoz", "тормоз", "brake"], ["dvigatel", "двигатель", "engine"]] },
    recommendations: [["Tormozlar", "Avto aksessuarlar"]],
  },
  {
    id: "Asboblar va qurilish",
    nameKey: "niches.tools",
    categories: [
      cat("Qo'l asboblari", "Qo'l asboblari (Hand Tools)"),
      cat("Elektr asboblar", "Elektr asboblar (Power Tools)"),
      cat("Qurilish materiallari", "Qurilish materiallari (Construction)"),
      cat("Elektr jihozlari", "Elektr jihozlari (Electrical)"),
      cat("Santexnika", "Santexnika (Plumbing)"),
      cat("Xavfsizlik vositalari", "Xavfsizlik vositalari (Safety)"),
      cat("Metizlar", "Metizlar (Hardware)"),
      cat("Ustaxona jihozlari", "Ustaxona jihozlari (Workshop)"),
      cat("O'lchash asboblari", "O'lchash asboblari (Measuring Tools)"),
    ],
    attributeKeys: ["brand", "material", "power", "voltage", "dimensions", "weight", "warranty", "usage", "compatibility"],
    variantSuggestions: [],
    ai: { contextKey: "niches.tools.aiContext" },
    search: { synonymGroups: [["asbob", "инструмент", "tool"], ["elektr", "электро", "power"]] },
    recommendations: [["Elektr asboblar", "Xavfsizlik vositalari"]],
  },
  {
    id: "Sumka va charm buyumlar",
    nameKey: "niches.bags",
    categories: [
      cat("Qo'l sumkalari", "Qo'l sumkalari (Handbags)"),
      cat("Ryukzaklar", "Ryukzaklar (Backpacks)"),
      cat("Hamyonlar", "Hamyonlar (Wallets)"),
      cat("Sayohat sumkalari", "Sayohat sumkalari (Travel Bags)"),
      cat("Noutbuk sumkalari", "Noutbuk sumkalari (Laptop Bags)"),
      cat("Portfellar", "Portfellar (Briefcases)"),
      cat("Yelka sumkalari", "Yelka sumkalari (Crossbody)"),
      cat("Yo'l sumkalari", "Yo'l sumkalari (Luggage)"),
    ],
    attributeKeys: ["material", "color", "size", "capacity", "gender", "brand", "style", "compartments"],
    variantSuggestions: ["color"],
    ai: { contextKey: "niches.bags.aiContext" },
    search: { synonymGroups: [["sumka", "сумка", "bag"], ["ryukzak", "рюкзак", "backpack"]] },
    recommendations: [["Qo'l sumkalari", "Hamyonlar"], ["Noutbuk sumkalari", "Ryukzaklar"]],
  },
  {
    id: "O'yinchoqlar va xobbi",
    nameKey: "niches.toys",
    categories: [
      cat("Ta'limiy o'yinchoqlar", "Ta'limiy o'yinchoqlar (Educational Toys)"),
      cat("Qo'g'irchoqlar", "Qo'g'irchoqlar (Dolls)"),
      cat("Mashinachalar", "Mashinachalar (Cars)"),
      cat("Konstruktorlar", "Konstruktorlar (Building Sets)"),
      cat("Boshqotirmalar", "Boshqotirmalar (Puzzles)"),
      cat("Ochiq havo o'yinchoqlari", "Ochiq havo o'yinchoqlari (Outdoor Toys)"),
      cat("Radioboshqaruvli o'yinchoqlar", "Radioboshqaruvli o'yinchoqlar (Remote Control)"),
      cat("Kolleksion buyumlar", "Kolleksion buyumlar (Collectibles)"),
      cat("Xobbi mahsulotlari", "Xobbi mahsulotlari (Hobby Products)"),
      cat("Nastol o'yinlari", "Nastol o'yinlari (Board Games)"),
    ],
    attributeKeys: ["age", "gender", "material", "brand", "recommendedAge", "skill", "batteryRequired", "numberOfPieces", "difficulty"],
    variantSuggestions: ["age"],
    ai: { contextKey: "niches.toys.aiContext" },
    search: { synonymGroups: [["o'yinchoq", "игрушка", "toy"], ["konstruktor", "конструктор", "building set"]] },
    recommendations: [["Konstruktorlar", "Boshqotirmalar"], ["Mashinachalar", "Kolleksion buyumlar"]],
  },
];

// Xavfsiz zaxira (fallback) — 15 taga kirmaydi, lekin noma'lum/bo'sh
// niche qiymati uchun (masalan eski/buzilgan ma'lumot) har doim
// ISHLAYDIGAN natija qaytarishi kerak — eski xatti-harakat
// (`NICHE_CATEGORIES["Boshqa"]`) bilan bir xil.
const OTHER_NICHE = {
  id: "Boshqa",
  nameKey: "niches.other",
  categories: [cat("Boshqa", "Boshqa")],
  attributeKeys: ["brand", "color", "material"],
  variantSuggestions: [],
  ai: { contextKey: "niches.other.aiContext" },
  search: { synonymGroups: [] },
  recommendations: [],
};

const NICHE_BY_ID = new Map(NICHES.map((n) => [n.id, n]));

/** Barcha 15 ta niche ID'sini qaytaradi (onboarding tanlovi uchun). */
export const NICHE_IDS = NICHES.map((n) => n.id);

/** Berilgan ID uchun to'liq NicheConfig'ni qaytaradi — topilmasa "Boshqa". */
export function getNicheConfig(nicheId) {
  return NICHE_BY_ID.get(nicheId) || OTHER_NICHE;
}

/** Berilgan niche uchun kategoriyalar ro'yxati — `{value,label}[]`. */
export function getCategoriesForNiche(nicheId) {
  return getNicheConfig(nicheId).categories;
}

/** Berilgan niche uchun atribut KALITLARI ro'yxati (tartib muhim). */
export function getAttributeKeysForNiche(nicheId) {
  return getNicheConfig(nicheId).attributeKeys;
}

/**
 * Berilgan kategoriyaga niche konfiguratsiyasidagi `recommendations`
 * juftliklari orqali BOG'LANGAN boshqa kategoriyalarni qaytaradi
 * (masalan Kosmetika'da "Dekorativ kosmetika" -> "Parfyumeriya").
 * Juftlik IKKI TOMONLAMA hisoblanadi (`[A,B]` bo'lsa, A uchun ham,
 * B uchun ham bir-birini qaytaradi).
 *
 * Bu — cross-sell/upsell uchun "sovuq boshlanish" zaxirasi
 * (`src/utils/productRecommendations.js`): HAQIQIY xarid tarixi
 * hali yetarli bo'lmagan yangi mahsulotlar uchun, xolis ("tasodifiy
 * emas") boshlang'ich tavsiya manbai sifatida ishlatiladi — bu
 * "customers often buy" kabi HAQIQIY statistik da'vo EMAS, faqat
 * savdo bo'yicha odatiy, mantiqan bog'liq kategoriyalarni ko'rsatish
 * (masalan poyabzal ko'rilganda, mos aksessuarlarni taklif qilish).
 */
export function getRelatedCategoriesForCategory(nicheId, category) {
  if (!category) return [];
  const related = new Set();
  (getNicheConfig(nicheId).recommendations || []).forEach(([a, b]) => {
    if (a === category) related.add(b);
    if (b === category) related.add(a);
  });
  return Array.from(related);
}
