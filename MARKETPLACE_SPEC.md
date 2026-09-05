# "Katta Magazin" (Marketplace) — texnik spetsifikatsiya (v2, dropshipping modeli)

> Bu hujjat avvalgi versiyani ALMASHTIRADI. Muhokama davomida model
> aniqlashdi: bu — sof "ko'rish oynasi" emas, balki HAQIQIY savat/buyurtma
> bilan ishlaydigan, DROPSHIPPING uslubidagi do'kon. Mijoz faqat "Alisherning
> katta do'koni"ni ko'radi, qaysi sotuvchidan ekanini katalogda BILMAYDI;
> buyurtma esa to'g'ridan-to'g'ri haqiqiy sotuvchining ZeloShop hisobiga
> tushadi. Narxga ustama/komissiya va ATMOS HALI HAM bu bosqichga KIRITILMAGAN
> (5-bo'limga qarang) — to'lov hozirgidek, mijoz va sotuvchi o'rtasida.

## 1. Model — qisqacha

- Alisher — tizimda ODDIY sotuvchi hisobi (`sellers/{id}.isMarketplaceStore: true`),
  o'zining YANGI Telegram botiga ega.
- Boshqa sotuvchilar so'rov yuboradi → Alisher (admin sifatida) tasdiqlaydi →
  ularning mahsulotlari AVTOMATIK ravishda Alisherning katalogida paydo
  bo'ladi (Firebase ma'lumotlaridan avtomatik "tortib olinadi").
- Sotuvchi katta do'konga HECH QANDAY nazorat qilmaydi — faqat (agar Alisher
  ruxsat bersa) statistikani o'z panelida ko'radi.
- Mijoz katalogda mahsulotni ko'radi — QAYSI sotuvchidan ekanini BILMAYDI
  (sotuvchi nomi/logotipi ko'rsatilmaydi). Savatga qo'shgach, agar mahsulotlar
  turli sotuvchidan bo'lsa, savat guruhlarga (haqiqiy do'kon nomi bilan)
  bo'linadi — buni FAQAT shu yerda, yetkazib berish narxi nega bo'linganini
  tushuntirish uchun ko'rsatamiz.
- Buyurtma berilganda, mavjud, o'zgarmagan buyurtma yaratish tizimi orqali,
  buyurtma to'g'ridan-to'g'ri HAQIQIY sotuvchining ZeloShop panelidagi
  "Buyurtmalar" ro'yxatiga tushadi — u buni ODATDAGIDEK ko'radi va bajaradi.
  To'lov ham hozirgidek — mijoz va sotuvchi o'rtasida, dekentralizatsiyalashgan
  holda. Alisher HALI hech qanday komissiya olmaydi.

**Ochiq aytilishi kerak bo'lgan tavakkal**: mijoz "kimdan sotib olayotganini"
bilmagani va Alisher sotuvchi ustidan operatsion nazoratga ega bo'lmagani
(sifat, tezlik) uchun — agar biror sotuvchi sifatsiz xizmat ko'rsatsa, bu
salbiy taassurot "Alisherning katta do'koni" brendiga yopishadi, aslida
aybdor sotuvchi ekanligiga qaramay. Bu — dropshipping modelining tabiiy
tavakkali, tanlov Sizniki, lekin buni ko'zdan qochirmaslik kerak (masalan past
reytingli sotuvchini katalogdan avtomatik chiqarib tashlash chegarasi
kerak bo'lishi mumkin — 7-bo'limga qarang).

## 2. Arxitektura — nega bot kerak va bu nimani osonlashtiradi

Bu ENDI alohida, login talab qilmaydigan sahifa EMAS — bu HAQIQIY sotuvchi
hisobi, xuddi boshqa har qanday sotuvchi kabi. Shuning uchun MAVJUD mijoz
ilovasi (mahsulotlar ro'yxati, savat, checkout, sevimlilar, bildirishnomalar)
DEYARLI O'ZGARISHSIZ qayta ishlatiladi — bu avvalgi "alohida sahifa" rejasidan
KO'RA arzonroq.

- **Yangi bot**: Siz tanlagan nom bilan (masalan "ZeloMarket") yaratiladi va
  mavjud, o'zgarishsiz `customBot.js` mexanizmi orqali Alisherning maxsus
  hisobiga ulanadi.
- **Natija**: sevimlilar, buyurtma bildirishnomalari, savat-tashlab-ketish
  eslatmalari kabi ko'plab narsa AVTOMATIK, QO'SHIMCHA KOD YOZMASDAN ishlaydi
  — chunki bular allaqachon "har qanday sotuvchi hisobi" uchun umumiy qilib
  qurilgan (3.4-bo'limga qarang, bitta muhim istisnodan tashqari).
- **Narxi**: bu katta do'kon endi ODDIY brauzerdan ochilmaydi — faqat
  Telegram orqali (aynan hozirgi BOSHQA barcha do'konlar kabi). Bu — kamchilik
  emas, oddiy izchillik: hozirgi tizimda boshqa hech bir do'kon ham
  brauzerdan ochilmaydi.

## 3. Yangi/o'zgargan qismlar

### 3.1 Mahsulotlar ro'yxati (katalog)

Mavjud "mahsulotlar ro'yxati" komponenti ishlatiladi — FAQAT so'rov manbai
o'zgaradi: joriy sotuvchi `isMarketplaceStore===true` bo'lsa,
`products.where("sellerId","==",X)` o'rniga
`products.where("marketplaceApproved","==",true)` ishlatiladi. Sotuvchi
nomi/logotipi HECH QAYERDA ko'rsatilmaydi (dropshipping tamoyili).

Qo'shimchalar: saralash (narx past→baland, yangi, eng yuqori reytingli),
"Yangi qo'shilganlar" va "Ommabop mahsulotlar" tasmalari, reyting ko'rsatish
(mavjud `averageRating`/`reviewCount` maydonlaridan — bular allaqachon har
bir mahsulotda avtomatik hisoblanadi, backend'da hech narsa o'zgarmaydi).

### 3.2 Savat — eng katta, yangi qism

**Muammo**: mavjud savat (`cartSlice.js`) faqat BITTA sotuvchiga bog'langan
holda ishlaydi (`scopedSellerId`). Marketpleys uchun bu kengaytirilishi
kerak.

**Yechim**: marketpleys rejimida savat ICHKI ravishda mahsulotning HAQIQIY
`sellerId`si bo'yicha guruhlanadi (bu maydon mahsulot hujjatida allaqachon
bor, faqat hozir ishlatilmayapti).

Savatga kirilganda:

- Agar 2 yoki undan ko'p guruh bo'lsa — OGOHLANTIRISH banneri: "Bu
  mahsulotlar turli manbalardan, shuning uchun N ta alohida yetkazib berish
  bo'ladi" + umumiy yetkazib berish narxi.
- Har bir guruh o'z sarlavhasi bilan — HAQIQIY do'kon nomi ko'rsatiladi
  (masalan "Gulnora Cosmetics") — guruh ichida o'sha guruh mahsulotlari va
  O'SHA GURUHNING yetkazib berish narxi (mavjud yetkazib berish hisoblash
  funksiyasi har bir guruh uchun ALOHIDA chaqiriladi).
- "Optimal yechim" maslahati: agar mijoz bitta guruhdan yana mahsulot
  qo'shsa, umumiy yetkazib berish narxi OSHMASLIGINI tushuntiruvchi matn
  (masalan: "Gulnora Cosmetics'dan yana mahsulot qo'shsangiz, yetkazib
  berish narxi oshmaydi").

**Muhim cheklov**: hozircha HAQIQIY SUBSIDIYA (masalan "ikkinchi yetkazib
berish bepul") YO'Q — bunday chegirma komissiya daromadidan
moliyalashtirilishi kerak, komissiya esa hali yo'q (ATMOS kutilmoqda).
Shuning uchun bu bosqichdagi "optimal yechim" — FAQAT shaffoflik va
maslahat, real chegirma emas. Real subsidiya — ATMOS/komissiya paydo
bo'lgach qo'shiladigan keyingi qadam.

### 3.3 Checkout (buyurtma berish)

"Buyurtma berish" bosilganda, mavjud, O'ZGARTIRILMAGAN buyurtma yaratish
funksiyasi HAR BIR guruh uchun ALOHIDA chaqiriladi (3 guruh bo'lsa — 3
marta), har birining `sellerId`si — o'sha guruhning haqiqiy sotuvchisi.

Har bir chaqiruv MUSTAQIL: biri xato bersa, qolganlari baribir muvaffaqiyatli
yaratiladi — mijozga aniq ko'rsatiladi ("2 ta buyurtma muvaffaqiyatli
qabul qilindi, 1 tasida xatolik yuz berdi").

Natijada buyurtma to'g'ridan-to'g'ri tegishli sotuvchining ZeloShop
panelidagi "Buyurtmalar" ro'yxatiga tushadi — u buni ODATDAGI tartibda
ko'radi va bajaradi, Alisher hech narsaga aralashmaydi.

Kichik, deyarli bepul qo'shimcha: har bir shunday yaratilgan buyurtmaga
`orderSource: "marketplace"` maydoni yoziladi — hozircha hech narsaga ta'sir
qilmaydi, lekin ATMOS/komissiya kelganda kerak bo'ladigan hisobot uchun
oldindan tayyorgarlik.

### 3.4 "Bepul" keladigan narsalar (chunki bu haqiqiy sotuvchi hisobi)

- **Sevimlilar** — mavjud, login-bog'liq tizim to'g'ridan-to'g'ri ishlaydi
  (avvalgi rejadagi "brauzerga xos" hiyla endi kerak emas).
- **Savat tashlab ketilganda eslatma** (`engagementReminders.js`) —
  o'zgarishsiz ishlaydi.
- **Bitta muhim ISTISNO — buyurtma holati bildirishnomalari**: buyurtma
  HAQIQIY sotuvchiga tegishli bo'lgani uchun, "buyurtmangiz
  tayyorlanmoqda" kabi xabar SOTUVCHINING o'z botidan emas, MARKETPLEYS
  botidan yuborilishi TO'G'RIROQ (mijoz Alisherning boti orqali kirgan,
  sotuvchining botini "bilmaydi" ham). Hozirgi `lib/customerNotify.js`
  "buyurtma qaysi sotuvchiga tegishli bo'lsa, o'sha sotuvchining o'z
  botidan yuborish" mantig'iga qurilgan — bu yerda buni "buyurtma
  `orderSource==='marketplace'` bo'lsa, MARKETPLEYS botidan yubor" degan
  qo'shimcha shart bilan to'g'rilash kerak bo'ladi. Bu — kichik, lekin
  qurish paytida albatta alohida hal qilinishi kerak bo'lgan texnik nuqta.

## 4. Ma'lumotlar tuzilishi (avvalgi rejadan o'zgarishsiz qoladi)

| Maydon | Joyi | Izoh |
|---|---|---|
| `marketplaceStatus` | `sellers/{id}` | `"none"` \| `"requested"` \| `"approved"` \| `"rejected"` |
| `marketplaceApproved` | `products/{id}` | Katalogda ko'rinadimi — sotuvchi tasdiqlanganda ommaviy yoziladi |
| `isMarketplaceStore` | `sellers/{alisherId}` | Faqat Alisherning hisobida `true` |
| `orderSource` | `orders/{id}` | `"marketplace"` (yangi, ixtiyoriy) \| mavjud emas = oddiy buyurtma |

Cloud Function'lar (`requestMarketplaceJoin`, `reviewMarketplaceRequest`,
`leaveMarketplace`) — avvalgi rejadagidek, o'zgarishsiz.

## 5. Bu bosqichga KIRITILMAGAN (keyingi qadam)

- Narxga ustama/komissiya ko'rsatish.
- ATMOS yoki har qanday avtomatik to'lov bo'linishi.
- Yetkazib berishga REAL subsidiya (masalan "ikkinchisi bepul") — komissiya
  daromadi paydo bo'lgach qo'shiladi.
- Sotuvchi profili sahifasi — MODELGA MOS EMASLIGI SABABLI BUTUNLAY OLIB
  TASHLANDI (dropshipping'da sotuvchi ko'rinmaydi).

## 6. Qurilish tartibi (yangilangan)

1. Backend: a'zolik (`requestMarketplaceJoin`/`reviewMarketplaceRequest`/`leaveMarketplace`)
   + mahsulot ro'yxati so'rovini `isMarketplaceStore` bo'yicha shartli
   qilish.
2. Alisherning o'z sotuvchi hisobi yaratiladi + yangi bot ulanadi (mavjud
   `customBot.js` orqali, KOD O'ZGARISHISIZ).
3. Katalog sahifasi kengaytmasi: saralash, reyting ko'rsatish, "Yangi"/
   "Ommabop" tasmalari.
4. Savat — ko'p-sotuvchili guruhlash mantig'i (eng katta, markaziy qism).
5. Checkout — guruh bo'yicha bir nechta buyurtma yaratish + xatoliklarni
   qisman qayta ishlash.
6. Bildirishnoma yo'nalishini tekshirish/tuzatish (3.4-bo'limdagi istisno).
7. Admin: a'zolik so'rovlari sahifasi.
8. i18n (uz/ru/en), to'liq test/lint/build tekshiruvi, paketlash.

## 7. Ochiq qarorlar (boshlashdan oldin kerak)

- ~~**Bot nomi/brendi**~~ — **HAL QILINDI: "Z-Bazar"** (ko'rinadigan nom).
  Texnik eslatma: Telegram bot username'ida chiziqcha (`-`) ishlatilmaydi —
  BotFather'da username sifatida masalan `z_bazar_bot` yoki `zbazar_bot`
  tanlanadi (pastki chiziqcha bilan), ko'rinadigan sarlavha esa "Z-Bazar"
  bo'lib qolaveradi.
- **Past reytingli sotuvchini avtomatik chiqarib tashlash chegarasi
  kerakmi** (masalan o'rtacha reyting 3 dan pastga tushsa, mahsulotlari
  katalogdan avtomatik yashirinsinmi) — sifat nazorati yo'qligi tufayli
  yuzaga kelishi mumkin bo'lgan obro' tavakkalini kamaytirish uchun,
  tavsiya etiladi, lekin qaror Sizniki.

## 8. TO'LIQ REJA RO'YXATI (ushbu muhokama davomida kelishilgan barcha band)

**Model va brend**
1. Nomi: **Z-Bazar** — dropshipping + Uzum Market uslubidagi gibrid
   marketpleys.
2. Alisher — tizimda alohida sotuvchi hisobi (`isMarketplaceStore: true`),
   o'z Telegram boti (`z_bazar_bot`) bilan.
3. Boshqa sotuvchilar so'rov yuboradi → admin (Alisher) tasdiqlaydi →
   mahsulotlar avtomatik ravishda Z-Bazar katalogiga qo'shiladi.
4. Mijoz katalogda QAYSI sotuvchidan ekanini bilmaydi — sof "Z-Bazar"
   brendi sifatida ko'radi (sotuvchi profili sahifasi shu sababli olib
   tashlandi).

**Sotuvchi tomoni**
5. "Katta magazinga qo'shilish" so'rovi yuborish (bir tugma).
6. Holatni ko'rish: so'ralgan / tasdiqlangan / rad etilgan.
7. Istagan payt o'z ixtiyori bilan chiqib ketish imkoniyati.
8. Sotuvchi Z-Bazar'ga HECH QANDAY nazorat qilmaydi — faqat (ruxsat
   berilsa) statistikani ko'radi.
9. Yangi qo'shilgan mahsulot, agar sotuvchi tasdiqlangan bo'lsa, avtomatik
   katalogga tushadi (qayta so'rov shart emas).

**Admin (Alisher) tomoni**
10. So'rovlar ro'yxati sahifasi — tasdiqlash/rad etish.
11. Tasdiqlashda — sotuvchining BARCHA mahsulotlariga ommaviy belgi
    qo'yiladi; rad etish/chiqarishda — belgi olib tashlanadi.

**Mijoz — katalog**
12. Qidiruv, kategoriya filtri, saralash (narx/yangi/reyting).
13. "Yangi qo'shilganlar" va "Ommabop mahsulotlar" tasmalari.
14. Reyting/sharh soni ko'rsatiladi (mavjud ma'lumotdan, backend
    o'zgarishsiz).
15. Sevimlilar — haqiqiy, login-bog'liq tizim (avtomatik ishlaydi).

**Mijoz — savat va checkout (eng katta texnik ish)**
16. Savat ICHKI ravishda mahsulotning HAQIQIY sotuvchisi bo'yicha
    guruhlanadi.
17. 2+ guruh bo'lsa — ogohlantirish banneri + umumiy yetkazib berish
    narxi.
18. Har bir guruh HAQIQIY do'kon nomi bilan ko'rsatiladi (masalan
    "Gulnora Cosmetics"), o'z alohida yetkazib berish narxi bilan.
19. "Optimal yechim" maslahati — "shu sotuvchidan yana qo'shsangiz,
    narx oshmaydi" turidagi matn (HAQIQIY chegirma emas, faqat maslahat).
20. Checkout — mavjud, o'zgartirilmagan buyurtma funksiyasi HAR BIR guruh
    uchun alohida chaqiriladi (N ta mustaqil buyurtma).
21. Qisman muvaffaqiyat qo'llab-quvvatlanadi (bitta guruh xato bersa,
    qolganlari baribir yaratiladi).
22. Har bir buyurtmaga `orderSource:"marketplace"` belgisi qo'yiladi
    (kelajakdagi hisobot uchun, hozircha ta'sirsiz).
23. Buyurtma to'g'ridan-to'g'ri HAQIQIY sotuvchining ZeloShop
    "Buyurtmalar" ro'yxatiga tushadi — u ODATDAGIDEK bajaradi.

**Texnik tuzatish kerak bo'ladigan joy**
24. Buyurtma-holati bildirishnomalari `orderSource==="marketplace"` bo'lsa
    Z-Bazar botidan yuborilishi kerak (sotuvchining o'z botidan emas) —
    `lib/customerNotify.js`ga qo'shimcha shart kerak.

**Hozircha KIRITILMAGAN (keyingi bosqich)**
25. Narxga ustama/komissiya.
26. ATMOS yoki har qanday avtomatik to'lov bo'linishi.
27. Yetkazib berishga REAL subsidiya (masalan "ikkinchisi bepul").
28. Push-bildirishnoma uchun alohida infratuzilma — bot orqali AVTOMATIK
    keladi, qo'shimcha ish shart emas.

**Hal qilinmagan, boshlashdan oldin kerak bo'lishi mumkin bo'lgan savol**
29. Past reytingli sotuvchini katalogdan avtomatik chiqarib tashlash
    chegarasi kerakmi (tavsiya etiladi, qaror Sizniki).
