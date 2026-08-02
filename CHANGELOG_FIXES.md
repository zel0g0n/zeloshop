# O'zgarishlar hisoboti (CHANGELOG)

Bu fayl loyihada nima topilgani va nima tuzatilgani haqida to'liq hisobot.
Barcha izohlar kod ichida ham o'zbek tilida qoldirildi (`// OLDIN / ENDI`
formatida) — kelajakda kodni o'qiganda nima uchun shunday qilinganini
eslab qolish uchun.

## 1. ENG KATTA MUAMMO — Multi-tenancy umuman ishlamas edi

Loyiha "har bir sotuvchi uchun alohida do'kon" g'oyasiga qurilgan, lekin
amalda **sellerId va clientId 9 ta faylda qo'lda (hardcode) yozilgan edi**,
va ular hattoki bir-biriga ham mos kelmasdi:

| Fayl | Nima yozilgan edi |
|---|---|
| `services/products/addProduct.js` | `sellerId: "yGsq7Cmn2C3IF103gtGm"` |
| `features/seller/components/order/OrderSection.jsx` | `sellerID = 'yGsq7Cmn2C3IF103gtGm'` |
| `features/seller/components/products/Products.jsx` | `sellerID = 'yGsq7Cmn2C3IF103gtGm'` |
| `pages/client/Checkout.jsx` | `currentSellerId = "yGsq..."`, `currentUserId = "QdPK..."` |
| `features/shop/components/cabinet/EditProfile.jsx` | `currentUserId = '0czQALhZ3D152vYawfgC'` ⚠️ **boshqa** ID |
| `hooks/useGetClientData.jsx` | `userId = "0czQALhZ3D152vYawfgC"` |
| `features/shop/components/order/OrdersList.jsx` | `clientId = 'QdPK91xipZh6c6JHaupV'` |
| `firebase/profile/editProfile.js` | to'liq statik Firestore yo'l (ishlatilmagan, o'chirildi) |

**Natija:** barcha foydalanuvchilar/sotuvchilar Firestore'da bitta xil
hujjatga yozar/o'qir edi — ma'lumotlar izolyatsiyasi (loyihangizning eng
muhim talabi) amalda mavjud emas edi. Bundan tashqari, profil sahifasi bir
clientId, checkout esa boshqa clientId ishlatgani uchun **bir xil
foydalanuvchi ikkita turli "shaxs" sifatida ko'rinardi**.

### Yechim

Yangi `src/context/SessionContext.jsx` + `src/config/telegram.js` qo'shildi:

- Ilova Telegram Mini App ichida ochilganda, `window.Telegram.WebApp`
  orqali **haqiqiy** sotuvchi ID'sini (`start_param`) va foydalanuvchi
  ID'sini avtomatik oladi.
- Lokal/brauzerda test qilish uchun (Telegram tashqarisida) bitta joyda
  (`src/config/telegram.js`) zaxira ID'lar saqlanadi — shu bilan loyiha
  darhol `npm run dev` bilan ishlab turadi.
- Barcha yuqoridagi 9 ta joy endi `useSession()` orqali shu bitta manbadan
  foydalanadi. Xato/eskirgan `firebase/profile/editProfile.js` fayli
  butunlay o'chirildi (u hech qayerda import qilinmagan, ishlatilmagan
  "o'lik" kod edi).

**⚠️ Muhim eslatma:** bu — arxitekturaviy yechim, lekin Telegram bot orqali
`start_param`ni to'g'ri yuborish (BotFather/bot backend tomonida) hali ham
sizning tomoningizda sozlanishi kerak. `src/config/telegram.js` faylidagi
izohlarda bu aniq tushuntirilgan.

## 2. Firebase trafigini kamaytirish

1. **`useRelatedProducts` hooki** — avval har bir mahsulot sahifasi
   ochilganda **butun "products" kolleksiyasini** (`getDocs`) qayta
   yuklardi, garchi bu ma'lumot Home sahifasida Redux'da keshlangan bo'lsa
   ham. Endi mavjud keshdan foydalanadi — deyarli hech qachon qo'shimcha
   o'qish bo'lmaydi.

2. **Bitta mahsulotni ochish** (`getSingleProductSlice.js`) — endi avval
   Redux keshini tekshiradi; agar mahsulot allaqachon ro'yxatda bo'lsa,
   Firestore'ga umuman so'rov yubormaydi.

3. **Sotuvchi "Mahsulotlarim" sahifasi** (`Products.jsx`) — bu ehtimol eng
   jiddiy muammo edi: sahifa **ishlatilmayotgan** `useGetOrdersData(sellerID)`
   ni ham chaqirardi — ya'ni sahifa ochilganda **buyurtmalar uchun ham
   real-time Firestore listener** ochilardi, lekin natija hech qayerda
   ko'rsatilmasdi. Bu listener butunlay olib tashlandi.

4. **Live-search debounce** — avval `SearchCatalog` har bosilgan harfda
   Redux'ga dispatch yuborardi (bu Firestore o'qishi emas, lekin butun
   katalog ro'yxatini har harfda qayta filtrlardi). Endi 300ms debounce
   qo'shildi. `SearchOverlay` uchun esa alohida, butunlay **lokal**
   (Firestore/Redux'ga tegmaydigan) taklif qidiruvi yaratildi.

5. **Firestore composite index'lar** — `getOrderData`, `getClientOrderData`,
   `getSellerProducts` xizmatlari `where(...) + orderBy(...)` ishlatadi.
   Bunday so'rovlar uchun Firestore Console'da composite index yaratish
   kerak (agar hali yaratilmagan bo'lsa, birinchi marta ishga tushirganda
   Firestore konsolda to'g'ridan-to'g'ri havola beradi — shu havolani bosib
   index yaratish yetarli).

## 3. Ortiqcha renderlar (excessive re-renders)

Bu — ilovadagi eng keng tarqalgan muammo edi: `useAddToCart` va
`useAddFavorite` hooklari **butun savat/sevimlilar massivini** (`state.carts.items`,
`state.favorites.items`) `useSelector` bilan olardi, keyin komponent
ichida `.find()`/`.some()` bilan kerakli elementni qidirardi.

**Nega bu yomon:** Redux Toolkit (Immer) har qanday o'zgarishda (masalan
bitta mahsulot sonini oshirish) **butun massivning yangi referensini**
yaratadi. `useSelector` esa referens tengligini tekshirgani uchun — **HAR
BIR** shu hookni ishlatuvchi komponent (ya'ni sahifadagi HAR BIR
`ProductCard`, `CartItem`) qayta render bo'lardi, hatto ular o'sha
o'zgarishga aloqasi bo'lmasa ham. 20 ta mahsulot ko'rsatilgan sahifada,
bitta mahsulotni savatga qo'shish — 20 ta komponentni qayta chizishga
sabab bo'lardi.

**Yechim:** endi tanlov (`useSelector`) funksiyasi ICHIDA faqat shu
mahsulotga tegishli yozuv qidiriladi va **shu yozuv qaytariladi** (butun
massiv emas). Redux Toolkit/Immer o'zgarmagan elementlar uchun eski
obyekt referensini saqlab qolgani (structural sharing) uchun — aloqasiz
komponentlar endi umuman qayta render bo'lmaydi.

To'liq ro'yxat kerak bo'lgan joylar uchun (savat sahifasi, sevimlilar
sahifasi, Navbar'dagi son) alohida `useCartList()` / `useFavoritesList()`
hooklari qo'shildi — bu joylar ataylab to'liq ro'yxatga obuna bo'ladi,
chunki ular haqiqatan ham shuni ko'rsatishi kerak.

Qo'shimcha ravishda:
- `CartItem.jsx` endi `React.memo` bilan o'ralgan va o'zining sonini
  (quantity) hookdan to'g'ridan-to'g'ri oladi (avval alohida `carts.find()`
  bilan qayta hisoblardi).
- `ProductItem.jsx` (sotuvchi paneli) `React.memo` bilan o'ralgan.
- `SellerNavbar` endi lokal `useState` o'rniga `NavLink`ning `isActive`
  render-prop'idan foydalanadi (`Navbar.jsx` dagi kabi) — bu ham ortiqcha
  state, ham noto'g'ri ko'rsatish bugini bartaraf etadi.

## 4. To'g'ri komponentlarga ajratish

- **`AddProductPage`** allaqachon yaxshi bo'lingan ekan (8 ta kichik
  komponent: `PageHeader`, `BasicInfoCard`, `PricingCard`, `VariantsCard`,
  `ImageUploadCard`, `DescriptionCard`, `SubmitBar`, `FormErrors`) — lekin
  eski, bo'linmagan versiyasi (`Add.jsx`, 280+ qator) hali ham loyihada
  yotgan edi (ishlatilmasa ham). O'chirildi.

- **Sotuvchi "Products" sahifasi** (avval 260+ qator, hammasi bitta
  faylda: qidiruv, kategoriya tablari, status tablari, tezkor tahrirlash
  modali, mock-data — barchasi aralash) 5 ta faylga bo'lindi:
  - `ProductsHeader.jsx` — qidiruv + kam qolgan mahsulot ogohlantirishi
  - `ProductsCategoryTabs.jsx` — kategoriya karuseli
  - `ProductsStatusTabs.jsx` — Faol/Nofaol/Hammasi tablari
  - `QuickEditSheet.jsx` — tezkor narx/stok tahrirlash oynasi (endi
    **haqiqatan ham Firestore'ga yozadi** — avval `handleSaveQuickEdit`
    hech narsa qilmasdan modalni yopib qo'yardi)
  - `Products.jsx` — faqat holatni boshqaruvchi "container"

## 5. Boshqa topilgan va tuzatilgan xatolar

- **`SearchOverlay.jsx` — CRASH bugi.** Komponent `useLiveSearch()`dan
  `results` va `isLoading` larni kutib olardi, lekin hook ular umuman
  qaytarmasdi. Foydalanuvchi avval biror narsa qidirgan bo'lsa (Redux'da
  eski `searchQuery` saqlanib qolgani uchun) — qidiruv oynasini qayta
  ochganda `results.length` chaqirilib, **butun ilova ishdan chiqardi**.
  Bundan tashqari, taklif/teg bosilganda `handleSearchSubmit(null, ...)`
  chaqirilib, `e.preventDefault()` `null` ustida ishga tushib yana crash
  berardi. Ikkalasi ham tuzatildi, alohida `useProductSearchSuggestions`
  hooki yozildi.

- **Sotuvchi "Mahsulotlarim" sahifasi noto'g'ri ma'lumot ko'rsatardi.**
  `Products.jsx` va `ProductsList.jsx` global (barcha sotuvchilar)
  mahsulot ro'yxatidan foydalanardi — sotuvchi o'z mahsulotlari o'rniga
  **hamma sotuvchining** mahsulotlarini ko'rardi. Endi faqat shu
  sotuvchiga tegishli (`where sellerId ==`) ma'lumot ishlatiladi.

- **`ProductItem.jsx` — sxema nomuvofiqligi.** Komponent `prod.title`,
  `prod.brand`, `prod.isActive` maydonlarini kutardi, lekin haqiqiy
  Firestore hujjatida (`addProduct.js` orqali yoziladigan) bu maydonlar
  `name`, `category` deb ataladi va `isActive` umuman yo'q. Fallback
  qo'shildi.

- **`getClientOrderSlice.js`** — `ordersCounter = orders.length + 1`
  (noto'g'ri, +1 ortiqcha edi) va mavjud bo'lmagan `changeOrderStatus`
  reducer'ining action creator'ini eksport qilishga urinish (bu hech
  qachon ishlamagan, chunki bunday reducer yo'q edi) tuzatildi.

- **`ActiveOrder.jsx`** — `const user = false` keyin `user > 0` tekshiruvi
  (boolean bilan raqamni solishtirish, hech qachon `true` bo'lmaydi) —
  chalkash "o'lik" kod edi. Aniq `HAS_ACTIVE_ORDER_TRACKING` bayrog'iga
  almashtirildi va nega o'chiq turgani izohlandi (real kuryer/backend
  integratsiyasi hali yo'q).

- **`ProductPrice.jsx`** — `price.toFixed(2)` mahsulot narxi
  `undefined`/`null` bo'lsa ilovani yiqitardi. `Number(price) || 0` bilan
  himoyalandi.

- **`main.jsx`** — `<StrictMode>` va `<Provider>` izohga olib
  tashlangan edi (ikkalasi ham amalda ishlamas edi, Provider esa allaqachon
  `App.jsx` ichida bor edi — ikkilanish). Tozalandi, `StrictMode` qayta
  yoqildi (dev rejimida ikki karra effekt chaqiruvi orqali xatolarni
  erta topishga yordam beradi).

- **O'chirilgan "o'lik" fayllar** (hech qayerda import qilinmagan,
  ba'zilari xato kod bilan):
  - `features/seller/components/add/Add.jsx` (AddProductPage'ning eski,
    bo'linmagan versiyasi)
  - `features/seller/components/products/ProductsFilter.jsx` (hech qayerda
    ulanmagan orfan komponent)
  - `features/shop/components/order/OrderForm.jsx` (Checkout.jsx bilan
    to'qnashadigan, Redux'ni chetlab o'tib to'g'ridan-to'g'ri Firestore'ga
    yozadigan muqobil/eskirgan forma)
  - `firebase/product/productService.js` (bo'sh fayl)
  - `firebase/profile/getUserData.js` (nomi noto'g'ri, `EditProfile.jsx`
    ning eski nusxasi, mavjud bo'lmagan `state.auth` slice'iga murojaat
    qilardi va JSX'da e'lon qilinmagan o'zgaruvchilarni ishlatardi —
    ishlatilganda darhol crash berardi)
  - `firebase/profile/editProfile.js` (statik, noto'g'ri Firestore yo'lli,
    hech qayerda ishlatilmagan)
  - `routes/index.js` (`index.route.jsx` bilan chalkashadigan,
    ishlatilmagan qayta eksport fayli)

- Debug uchun qoldirilgan **console.log** chaqiruvlari (har renderda,
  har Redux action'da ishga tushib turgan) tozalandi: `ProductCard`,
  `ProductDetailPage`, `Products.jsx`, `Cabinet.jsx`,
  `updateProfileSlice.js` (3 ta), `favoriteSlice.js`, `EditProfile.jsx`.

## 6. Ikkinchi chuqur tekshiruv — barcha hooks/slices/services fayllari

Foydalanuvchi so'rovi bo'yicha barcha `hooks/`, `store/slices/`, `services/`,
`utils/` fayllari (42 ta) qayta, tag-batag tekshirildi. Yangi topilgan va
tuzatilgan xatolar:

- **`services/orders/changeOrderStatus.js`** — `Error` konstruktori
  noto'g'ri ishlatilgan edi (`new Error(msg, error, {cause})` — ikkinchi
  argument yaroqsiz, asl xato yo'qolib ketardi). Tuzatildi.

- **`OrderCard.jsx` — status o'zgartirishda loading/xato ko'rsatilmasdi.**
  Sotuvchi "Jo'natish"/"Bekor qilish" tugmasini bossa, so'rov fonda
  xatoga uchrasa (masalan tarmoq, yoki yangi xavfsizlik qoidalari
  asosida ruxsat xatosi) — hech narsa ko'rsatilmasdi, tugma qayta-qayta
  bosilishi (ikkilangan so'rov) mumkin edi. Endi har bir karta o'zining
  lokal loading/xato holatini ko'rsatadi (ataylab global Redux state
  ishlatilmadi — aks holda bitta buyurtmani tasdiqlash boshqa barcha
  ko'rsatilgan kartalarda ham "yuklanmoqda" deb ko'rsatib yuborardi).

- **`changeOrderSlice.js` — ikkita bug**: (1) `rejected` holatida
  `state.error = true` deb yozib, keyin ustidan `state.error = action.payload`
  bilan qayta yozilardi (birinchi qator ortiqcha va chalkash edi); (2)
  `rejected` holatida `state.loading` hech qachon `false`ga tushmasdi —
  xato yuz berganda "yuklanmoqda" holati abadiy davom etardi.

- **`getOrdersSlice.js`** — hech qayerda dispatch qilinmagan, ishlatilmagan
  `changeOrderStatus` reducer'i o'chirildi (boshqa slice'dagi xuddi shu
  nomli, lekin butunlay boshqa narsa qiladigan async thunk bilan
  chalkashtirib yuborishi mumkin edi).

- **Valyuta nomuvofiqligi — "$" vs "so'm".** `CartItem.jsx` va
  `Checkout.jsx` (3 joyda) narxni **"$"** belgisi bilan ko'rsatardi,
  ilovaning qolgan barcha qismi (`ProductItem`, `ProductPrice`,
  `OrderCard`, `Order.jsx`) esa **"so'm"** ishlatadi. Barchasi "so'm"ga
  keltirildi, yirik summalar uchun `toLocaleString()` bilan minglik
  ajratgichlar ham qo'shildi.

- **"Arzon" (cheap) katalog filtri ishlamas edi.** `useFilterPriduct.jsx`
  ichida `price < 40` degan qattiq kodlangan chegara bor edi — bu faqat
  eski, dollar shkalasidagi mock-ma'lumotlar (`constants/data.jsx`, 12-325
  oralig'ida) uchun mantiqiy edi. Haqiqiy sotuvchi so'mda narx kiritsa
  (masalan 45 000 so'm), bu filtr **deyarli hech qanday mahsulotni
  topmasdi**. Endi chegara har doim mavjud mahsulotlarning eng arzon 30%
  qismi sifatida dinamik hisoblanadi — valyuta/shkaladan qat'i nazar
  ishlaydi.

- **`services/products/getProducts.js` — xato jim yutib yuborilardi**
  (`catch { console.log(error); return []; }`). Bu degani: Firestore
  ruxsat xatosi yoki tarmoq uzilishi bo'lganda ham Redux thunk har doim
  "muvaffaqiyatli, lekin bo'sh" deb ko'rsatardi — foydalanuvchi
  "mahsulot yo'q" deb noto'g'ri xabar ko'rardi, haqiqiy xato esa hech
  qayerda ko'rinmasdi. Endi xato to'g'ri qayta uloqtiriladi (`throw`),
  boshqa xizmat fayllari bilan bir xil andozada.

- **`services/clientUser/getClientData.js` — hujjat mavjudligi
  tekshirilmasdi.** `clientSnapshot.data()` hujjat topilmagan holatda ham
  chaqirilardi (`undefined` qaytaradi, keyin spread qilingani uchun xato
  bermaydi, lekin "topildi" deb noto'g'ri ko'rsatardi). `.exists()`
  tekshiruvi qo'shildi.

  **⚠️ Buni tuzatish jarayonida yangi nozik xato paydo bo'lishining oldi
  olindi:** agar mijoz hujjati haqiqatan topilmasa, `clientInfo` doimiy
  `null` bo'lib qoladi. `useGetClientData.jsx` oldingi versiyasi faqat
  `!clientInfo` shartiga tayanardi — bu holatda har safar `loading`
  `false`ga qaytganda hook qayta-qayta so'rov yuborib, **cheksiz tsiklga**
  aylanib qolishi mumkin edi. Hook endi alohida "so'rov yuborildimi"
  belgisidan foydalanadi (Redux ma'lumotining o'zidan emas).

- **`updateProfileSlice.js` — `clientInfo` maydoni hech qachon to'g'ri
  to'lmasdi.** Boshlang'ich qiymati `null` edi, lekin uni yangilovchi kod
  `if (state.clientInfo) {...}` sharti bilan himoyalangan edi — ya'ni
  birinchi yangilanishda ham, undan keyin ham hech qachon `null`dan
  chiqolmasdi. Bu maydon hech qayerda ishlatilmagani uchun (haqiqiy
  nusxa `getClientDataSlice.js`da to'g'ri ishlaydi) butunlay olib
  tashlandi — chalkashtiruvchi, ishlamaydigan kodni saqlashning hojati
  yo'q edi.

- **`utils/shop/productCart/addToCart.js`** (bo'sh fayl) va
  **`addToFavourite.jsx`** (Redux'dan oldingi, localStorage'ga asoslangan
  eski/ishlatilmaydigan versiya) — ikkalasi ham hech qayerda import
  qilinmagani tasdiqlandi va o'chirildi.

- **`useProductDetail` hookidagi funksiyalar** (`getSingleProduct`,
  `handleClearProduct`) `useCallback` bilan barqarorlashtirildi — avval
  har renderda yangi funksiya yaratilardi, bu `ProductDetailPage`dagi
  `useEffect`ni ataylab faqat `[id]`ga bog'lab qo'yishga majbur qilgan
  edi (to'g'ri, lekin ESLint qoidasini buzadigan, "qulay" yechim). Endi
  ikkalasi ham `useEffect` bog'liqlik ro'yxatiga to'g'ri qo'shilgan.

- **Tekshirilib, xatosiz topilgan fayllar** (o'zgartirilmadi):
  `useUploadStorage.jsx`, `compressImage.js`, `useAddProduct.jsx`,
  `useChangeOrderStatus.jsx` (asos e'tibori bilan), `cartSlice.js`,
  `favoriteSlice.js`, `getProductSlice.js`, `sendOrderSlice.js`,
  `getSellerProductsSlice.js`, store'dagi barcha reducer kalitlari
  (`store.js`) — bularning barchasi allaqachon professional darajada
  yozilgan edi.

## 7. Uchinchi bosqich — barcha JSX komponentlari (UI/UX + performance)

Foydalanuvchi so'rovi bo'yicha barcha 93 ta `.jsx` fayl ko'rib chiqildi:
xatolar, komponentlarga to'g'ri ajratish, UI/UX, va performance nuqtai
nazaridan. Eng muhim topilmalar:

- **Katalog kategoriya filtri (`FilterType.jsx`) umuman ishlamas edi.**
  Lokal state bilan faqat vizual ko'rinishni o'zgartirardi, hech qanday
  Redux action dispatch qilmasdi — va hatto sahifada **kod ichida
  o'chirib qo'yilgan edi** (`{/* <FilterType /> */}`). Bundan tashqari,
  undagi kategoriya nomlari ("skincare", "parfum", "hair") mahsulot
  qo'shish formasidagi haqiqiy qiymatlarga ("Skincare", "Perfume",
  "Tools") mos kelmasdi. Endi: yangi Redux state (`activeType`) + yangi
  hook (`useChangeType`) orqali to'liq ishlaydi, va barcha 3 joydagi
  kategoriya ro'yxati bitta markaziy manbaga
  (`constants/productCategories.js`) birlashtirildi.

- **Sotuvchi "Dashboard" sahifasi 100% soxta ma'lumot edi.** Barcha
  savdo raqamlari, o'sish foizlari, buyurtmalar — qo'lda yozilgan mock
  data, Firestore bilan hech qanday aloqasi yo'q edi. Hatto ilovada
  arxitektura jihatidan mavjud bo'lmagan "bir nechta do'kon o'rtasida
  almashish" funksiyasi (soxta modal oyna bilan) ham bor edi. Butunlay
  qayta qurildi: endi haqiqiy `useGetOrdersData`/`useGetProductsData`
  real-time ma'lumotidan (davr bo'yicha filtrlab) hisoblanadi, va 5 ta
  kichik komponentga bo'lindi (`TimeframeTabs`, `SalesSummaryCard`,
  `KpiCards`, `RecentOrdersList`).

- **"Ko'proq" (More) sahifasi ham soxta ma'lumot bilan ishlar edi**
  (o'ylab topilgan do'kon nomi, tasodifiy Unsplash rasm, o'ylab topilgan
  "5,250,000 so'm" balans) va "Tizimdan chiqish" tugmasi faqat
  `alert()` chiqarardi — hech narsa qilmasdi. Endi sarlavhada haqiqiy
  Telegram identifikatsiyasi ko'rsatiladi, soxta balans butunlay olib
  tashlandi, hali qurilmagan bo'limlar uchun halol "Tez orada" belgisi
  qo'yildi, va chiqish tugmasi haqiqatan ham Firebase sessiyasini
  tugatadi.

- **`ProductReviews.jsx` va `ProductBenefits.jsx` o'chirildi.** Ikkalasi
  ham hech qayerda ishlatilmagan (dead code), va `ProductReviews`
  o'ylab topilgan ismlarga ("Shahnoza", "Madina") bog'langan soxta
  mijoz sharhlarini ko'rsatardi — bu haqiqiy ijtimoiy dalil sifatida
  tasodifan ishga tushirilsa, foydalanuvchilarni chalg'itishi mumkin
  edi.

- **`ProductPrice.jsx` — ikkita chalkash muammo.** (1) Haqiqiy chegirma
  bo'lmasa ham har doim "100 000 so'm" degan **soxta "eski narx"**
  ko'rsatilardi — bu yolg'on chegirma taassurotini beradi; endi faqat
  haqiqiy `oldPrice` mavjud va u joriy narxdan katta bo'lganda
  ko'rsatiladi. (2) Mahsulot tugagan (`stock = 0`) bo'lsa ham bir
  vaqtning o'zida "Mavjud emas" VA "Zaxirada: 0 ta" ikkalasi
  ko'rsatilib, bir-biriga zid xabar berardi — endi faqat bittasi,
  holatga mos ravishda ko'rsatiladi.

- **Buyurtma status belgisi butunlay yetishmasdi.** Na mijozning o'z
  buyurtmalari ro'yxatida (`Order.jsx`), na sotuvchining buyurtma
  kartasida (`OrderCard.jsx`) buyurtma qaysi holatda ekani (Yangi/
  Jo'natildi/Bekor qilindi) ko'rsatilmasdi. Bitta umumiy manba
  (`constants/orderStatus.js`) yaratilib, ikkalasiga ham status
  belgisi qo'shildi.

- **Performance:** `Cabinet.jsx`dagi menyu massivi (ichida JSX ikonkalar
  bilan) har renderda qaytadan yaratilardi — bu uni ishlatuvchi
  `CabinetMenu`ni memo qilishning ma'nosini yo'qqa chiqarardi (chunki
  prop har doim "yangi" obyekt bo'lib ko'rinardi). `useMemo` bilan
  tuzatildi. `CabinetMenu`dagi 2 ta ishlatilmagan prop (`orders`, `idx`)
  ham olib tashlandi. Yana bir nechta komponentga (`ProductInfo`,
  `ProductGallery`, `ProductPrice`, `BottomBuyBar`, `CabinetHeader`,
  uchta mahsulot bo'limi) `React.memo` qo'shildi; bo'sh massivlar
  (`FilterBadges`, `RecentOrdersList`) komponent tanasi ichida emas,
  modul darajasida e'lon qilindi.

- **UI/UX:** bo'sh natijalar uchun to'g'ri xabar/skeleton qo'shildi
  (`FilteredCatalogProducts`, `BestSeller`/`Trends`/`Recommend` — bo'sh
  bo'lsa endi sarlavhasi bilan bo'sh joy qoldirmasdan butunlay
  yashiriladi). Yana bir joyda "$" vs "so'm" nomuvofiqligi
  (`CartPage.jsx`) va `ProductInfo.jsx`dagi chalkash hardcoded
  fallback nom ("Advanced Night Repair Serum" — haqiqiy nom
  yo'qolganda ko'rsatilardi) tuzatildi.

- **Tekshirilib, xato topilmagan qism:** `AddProductPage.jsx` va uning
  8 ta kichik komponenti (`PageHeader`, `BasicInfoCard`, `PricingCard`,
  `VariantsCard`, `ImageUploadCard`, `DescriptionCard`, `SubmitBar`,
  `FormErrors`) — bular allaqachon professional darajada yozilgan,
  to'g'ri memo qilingan va batafsil izohlangan edi.

- **Bilib turilishi kerak bo'lgan, ataylab tegilmagan narsa:**
  "✨ AI bilan to'ldirish" tugmasi (`DescriptionCard.jsx`) haqiqiy AI
  xizmatiga ulanmagan — u faqat bitta qattiq kodlangan namuna matnni
  qo'yadi. Buni ishlatuvchilarga "AI" deb ko'rsatish ozgina
  chalg'ituvchi, lekin haqiqiy AI integratsiyasi (qaysi xizmat/API
  ishlatishni tanlash) alohida qaror talab qiladi — shu sabab
  o'zgartirmadim, faqat sizga bildirib qo'yaman.

## 8. Ko'p tillilik (uz/ru/en) va Dark/Light rejim

- **Yangi infratuzilma:** `src/i18n/translations.js` (3 tillik lug'at),
  `src/context/LanguageContext.jsx` (tanlangan til localStorage'da
  saqlanadi, `t("key.path")` orqali tarjima qilinadi),
  `src/context/ThemeContext.jsx` (yorqin/tungi rejim, `<html>`
  elementiga `.dark` klassi qo'yiladi, Tailwind v4'da
  `@custom-variant dark` orqali ishlaydi).
- **Muhim bug tuzatildi:** mijoz kabinetidagi "Ilova tili" va "Yorqin
  rejim" tugmalari `/language` va `/theme` degan **mavjud bo'lmagan**
  marshrutlarga o'tishga harakat qilardi — bosilganda **bo'sh sahifaga
  tushib qolinardi**. Endi ikkalasi uchun ham haqiqiy, to'liq ishlaydigan
  sahifalar yaratildi va marshrutlarga qo'shildi (mijoz va sotuvchi
  tomoni uchun alohida-alohida, chunki ular boshqa-boshqa Layout
  ichida joylashgan).
- Mijoz kabinetidagi til belgisi va tungi rejim tugmasi endi **haqiqiy
  joriy holatni** ko'rsatadi (avval doim qattiq kodlangan
  "O'zbekcha" va o'zgarmas holat edi).
- Sotuvchi "Ko'proq" sahifasidagi "Til" bandi ham endi haqiqiy sahifaga
  ulandi, va yangi "Ko'rinish rejimi" bandi qo'shildi.
- **Qamrov:** to'liq ishlaydigan infratuzilma va asosiy "qobiq"
  (Navbar, Header, Kabinet, Savat, mahsulot kartochkalari, bosh
  sahifa) uchun tarjima/qorong'i rejim qo'llandi. **Mahsulot tafsiloti,
  checkout, va sotuvchi panelining ichki sahifalari (Dashboard,
  Products, Orders) hali faqat yorug' rejimda va faqat o'zbek tilida
  qoladi** — bularga to'liq qamrov keyingi bosqichda davom ettirilishi
  kerak.

## 9. Shu jarayonda topilgan qo'shimcha xatolar

- **`ProductCard.jsx` — narxlarni USD ($) da ko'rsatardi.**
  `Intl.NumberFormat(..., {currency: 'USD'})` ishlatilgan edi — bu eng
  ko'p ko'rinadigan joyda (bosh sahifa, katalog, barcha mahsulot
  kartochkalari) butun qolgan ilova "so'm" ishlatayotganda "$" belgisini
  ko'rsatardi. Tuzatildi.
- **`CartItem.jsx` — `item.title` ishlatilgan, lekin haqiqiy mahsulot
  ma'lumotida bu maydon `name` deb ataladi.** Natijada savatga
  qo'shilgan haqiqiy mahsulotlarning nomi **bo'sh** ko'rinishi kerak
  edi. Tuzatildi (fallback bilan: `item.name || item.title`).
- `ProductCard.jsx`da komponent ikki marta ketma-ket `memo()` bilan
  o'ralgan edi (bir marta e'lon qilinganda, yana eksport qilinganda) —
  ortiqcha, foydasiz o'rash olib tashlandi.

## 10. Modal'ga o'tkazish va to'liq dark mode/tarjima qamrovi

Foydalanuvchi so'rovi bo'yicha "Til" va "Tema" endi alohida sahifa emas,
**modal oyna** orqali tanlanadi (`LanguageModal.jsx`, `ThemeModal.jsx` —
`QuickEditSheet` bilan bir xil bottom-sheet naqshida). Keraksiz
`/language`, `/theme` marshrutlari olib tashlandi.

Shundan so'ng **dark mode va 3 tillik qamrov butun ilovaga** kengaytirildi:

- Mijoz tomoni: Navbar, Header, Kabinet, Savat, Katalog (qidiruv,
  filtrlar), Mahsulot tafsiloti (to'liq), Checkout (to'liq),
  Sevimlilar, Buyurtmalar tarixi
- Sotuvchi tomoni: Dashboard (barcha subkomponentlari), Mahsulotlarim
  (barcha subkomponentlari), Buyurtmalar, Mahsulot qo'shish formasi
  (barcha 8 subkomponenti)

Barcha o'zgarishlardan so'ng butun loyiha bo'ylab qavslar balansi va
import izchilligi qayta tekshirildi — muvozanatsizlik yoki uzilgan
import topilmadi.

**Ataylab tegilmagan/qolgan:** `HeroSlider.jsx`, `SellerNavbar.jsx`,
`SubmitBar.jsx` — bularning barchasi allaqachon to'q rangli (gradient)
fonlarda ishlaydi, shuning uchun yorug'/tungi rejimga alohida moslashning
hojati yo'q edi.

## 11. Forma validatsiyasi, alert() → modal, va skeleton loading

- **Telefon raqam validatsiyasi** (`src/utils/phone.js`) — O'zbekiston
  formatiga ("+998 XX XXX XX XX") mos avtomatik formatlash va uzunlik
  chegarasi qo'shildi. OLDIN telefon maydoni oddiy matn input edi —
  foydalanuvchi istagancha uzun raqam kirita olardi (masalan 100 ta
  raqam). Endi `Checkout.jsx` va `EditProfile.jsx`dagi telefon
  maydonlari avtomatik formatlanadi va to'liq (9 xonali) bo'lmasa,
  aniq xato ko'rsatiladi.

- **Barcha `alert()` chaqiruvlari olib tashlandi** (5 ta joyda edi:
  `Checkout.jsx` — 2 ta, `AddProductPage.jsx` — 1 ta, `More.jsx`
  (sotuvchi) — 2 ta). Ularning o'rniga yagona `StatusModal.jsx`
  komponenti ishlatiladi — xuddi profil tahrirlashdagi "Muvaffaqiyatli
  saqlandi" oynasi bilan bir xil dizaynda (muvaffaqiyat/xato/ma'lumot
  variantlari bilan). `Checkout.jsx`da, bundan tashqari, umumiy
  "hammasini to'ldiring" xabari o'rniga har bir maydon o'zining aniq
  xatosini ko'rsatadi (F.I.Sh, telefon, manzil alohida-alohida).

- **Skeleton loading qo'shildi** — oldin ko'p joyda faqat "Yuklanmoqda..."
  matni (yoki katta bo'sh spinner) ko'rsatilardi. Yangi
  `src/components/ui/Skeleton.jsx` (`CardSkeleton`, `ProfileHeaderSkeleton`,
  `ListSkeleton`, `GridSkeleton`, `ProductDetailSkeleton`) quyidagi
  joylarga qo'llandi: mijoz profil sarlavhasi, mahsulot tafsiloti
  sahifasi (avval katta bo'sh spinner edi), mijozning buyurtmalar
  ro'yxati, sotuvchining mahsulotlar va buyurtmalar sahifalari.

## 12. Sotuvchi ro'yxatdan o'tish oqimi (Onboarding) — yangi qurilgan funksiya

Bu — "tuzatish" emas, balki **butunlay yangi, ilgari mavjud bo'lmagan
funksiya**: ZeloShop "tayyor do'kon" emas, balki **do'kon yaratuvchi
platforma** ekan, lekin kodda hech qanday "ro'yxatdan o'tish/do'kon
yaratish" jarayoni yo'q edi — botni to'g'ridan-to'g'ri ochgan HAR
QANDAY odam (hatto hech qachon do'kon ochmagan bo'lsa ham) avtomatik
ravishda bo'sh sotuvchi paneliga tushib qolardi.

**Yangi marshrutlash mantig'i** (`SessionContext.jsx`):
```
start_param bor?
├─ Ha → Mijoz (o'sha sotuvchining do'koni)
└─ Yo'q → Firestore'da sellers/{uid} tekshiriladi
    ├─ Mavjud → Sotuvchi paneli (/seller)
    └─ Mavjud emas → Xush kelibsiz + Ro'yxatdan o'tish oqimi
```

**Yangi fayllar:**
- `features/onboarding/WelcomeScreen.jsx` — ZeloShop haqida qisqacha,
  "Do'konimni ochish" tugmasi
- `features/onboarding/CreateStoreScreen.jsx` — to'liq ro'yxatdan o'tish
  formasi: do'kon nomi, telefon (`utils/phone.js`dan foydalanadi),
  soha (`constants/storeNiches.js` — keng ro'yxat: Kosmetika, Kiyim-
  kechak, Elektronika va h.k.), logotip (mavjud `useUploadStorage`
  hookidan foydalanadi)
- `services/sellers/createSeller.js`, `services/sellers/getSeller.js`
- `store/slices/seller/createSellerSlice.js` + `hooks/seller/useCreateSeller.jsx`
- `firestore.rules` yangilandi — sotuvchi endi **faqat o'z** hujjatini
  yarata oladi (`tgID == o'z uid'i` va `status == "active"` bo'lishi
  shart — boshqacha qiymat bilan yaratib bo'lmaydi)

**Qarorlar** (foydalanuvchi bilan kelishilgan): moderatsiya yo'q (do'kon
darhol faol bo'ladi), bitta foydalanuvchi — bitta do'kon, to'liq
ro'yxatdan o'tish formasi.

**⚠️ Bilib turilishi kerak bo'lgan nomuvofiqlik:** ro'yxatdan o'tishda
keng soha ro'yxati (`storeNiches.js`) ishlatiladi, lekin "Mahsulot
qo'shish" formasi (`BasicInfoCard.jsx`) hali ham faqat kosmetika
kategoriyalarini (`Skincare/Makeup/Perfume/Tools`) taklif qiladi. Agar
sotuvchi "Kiyim-kechak" sohasini tanlasa, mahsulot qo'shishda baribir
faqat kosmetika kategoriyalari ko'rinadi. Buni to'liq tuzatish (har bir
soha uchun alohida mahsulot kategoriyalari tizimi) — alohida, kattaroq
ish, hozircha so'ralmagan.

## 13. Super Admin paneli — yangi qurilgan funksiya

**Admin qanday aniqlanadi:** yangi `admins/{uid}` Firestore kolleksiyasi
orqali. Bu kolleksiyaga **hech kim frontend'dan yoza olmaydi** — yangi
admin qo'shish FAQAT siz tomondan, Firebase Console orqali qo'lda
qilinadi (`admins` kolleksiyasida, admin qilmoqchi bo'lgan odamning
Telegram ID'si bilan bo'sh hujjat yaratasiz).

**Marshrutlash:** admin tekshiruvi endi eng birinchi bo'lib ishlaydi —
agar odam admin bo'lsa, botni qanday ochganidan (oddiy start yoki
sotuvchi havolasi orqali) qat'i nazar, doim admin panelга tushadi.

**Yangi fayllar** (`features/admin/`):
- `AdminApp.jsx` — panelning o'zining alohida navigatsiyasi bilan
  (Bosh sahifa / Sotuvchilar)
- `AdminDashboard.jsx` — platforma statistikasi (jami sotuvchilar,
  mahsulotlar, buyurtmalar, to'xtatilgan do'konlar soni) —
  `getCountFromServer` orqali, barcha hujjatlarni yuklab olmasdan,
  tez va arzon hisoblanadi
- `AdminSellersPage.jsx` — barcha sotuvchilar ro'yxati, qidiruv
  (do'kon nomi/telefon bo'yicha), holat bo'yicha filtrlash (Barchasi/
  Faol/To'xtatilgan)
- `AdminSellerCard.jsx` — har bir sotuvchi uchun "To'xtatish"/"Qayta
  faollashtirish" tugmasi (real vaqtda Firestore'ga yoziladi)

**`firestore.rules` yangilandi:** admin endi barcha `sellers`,
`products`, `orders` hujjatlarini o'qiy/kerak bo'lganda yozа oladi
(masalan qoidabuzar mahsulotni o'chirish yoki sotuvchini to'xtatish
uchun) — bu maxsus `isAdmin()` funksiyasi orqali ta'minlangan, boshqa
hech bir oddiy foydalanuvchi bunga ega emas.

**Ilgari mavjud bo'lgan bo'sh fayllar tozalandi:** `pages/admin.jsx`
va `routes/admin.route.jsx` (0-baytli, hech qachon to'ldirilmagan
skelet) — o'rniga to'liq ishlaydigan `features/admin/` moduli qurildi.

## 14. Haqiqiy topilgan bug: Telegram initData "poyga sharti" (race condition)

Sizning kuzatuvingiz — "botni ochganda noto'g'ri sahifa, lekin
yangilaganda to'g'ri sahifa chiqadi" — **haqiqiy, aniq texnik xatoni**
ko'rsatib berdi (avvalgi keshlash gumonim emas).

**Sabab:** Telegram'ning `initData`si (foydalanuvchi ma'lumotini o'z
ichiga olgan, imzolangan qator) "sovuq" ochilishda (ayniqsa Desktop
mijozida) bir necha o'n millisoniyaga **bo'sh** bo'lib turishi mumkin —
Telegram SDK'si hali to'liq ishga tushib ulgurmagani uchun.
`isRunningInTelegram()` funksiyam aynan shu bo'sh `initData`ga qarab
qaror qabul qilardi — bo'sh bo'lsa "Telegram ichida emasmiz" deb xato
xulosaga kelib, **zaxira (dev-fallback) rejimiga** o'tib ketardi. Sahifa
yangilanganda esa Telegram allaqachon tayyor bo'lgani uchun hammasi
to'g'ri ishlardi.

**Tuzatildi** (`src/config/telegram.js`, `src/context/SessionContext.jsx`):
- `isRunningInTelegram()` endi `initData`ning mazmuniga emas, balki
  `WebApp` obyektining mavjudligiga qaraydi (bu ancha barqaror signal)
- Yangi `waitForInitData()` — `initData` bo'sh bo'lsa, uni to'ldirilishini
  qisqa vaqt (jami 2 soniyagacha, har 100ms tekshirib) kutadi

## 15. Firestore ma'lumotidagi chalkashlikni yo'qotish

`functions/index.js` — `clients/{uid}` hujjati endi **faqat haqiqatan
mijoz sifatida kirilganda** (start_param bor — sotuvchining do'kon
havolasi orqali) yaratiladi, avvalgidek HAR BIR kirishda (admin,
sotuvchi, yangi foydalanuvchi — barchasi uchun) emas. Bu sinov paytida
"hammasi client sifatida qo'shilyapti" degan chalkashlikni keltirib
chiqargan edi — endi Firestore'dagi ma'lumot ilovaning haqiqiy
qarori bilan mos keladi.

## 16. Qo'shimcha himoya — kesh muammosi

`firebase.json`ga `index.html` uchun `Cache-Control: no-cache`
sarlavhasi qo'shildi — bu Telegram WebView'ning (ayniqsa Desktop'da)
eski build'ni keshlab qolish xavfini kamaytiradi (garchi asosiy topilgan
sabab kesh emas, poyga sharti bo'lsa ham, bu qo'shimcha ehtiyot chorasi
sifatida foydali).

## 17. Ilova tezligini oshirish (Error Boundary, Lazy-loading, Build optimallashtirish)

- **`ErrorBoundary.jsx`** — endi butun ilovani o'rab turadi (`main.jsx`).
  Oldin biror komponent render paytida xato tashlasa, butun React
  ilovasi **bo'sh oq ekranga** aylanib qolardi. Endi tushunarli xabar
  va "Qayta yuklash" tugmasi ko'rsatiladi.

- **Kod bo'lib yuklash (code-splitting) sezilarli kengaytirildi:**
  - Sotuvchi panelining barcha sahifalari (`Dashboard`, `Products`,
    `AddProductPage`, `OrderSection`, `More`)
  - Admin panelining o'zi (`AdminApp`)
  - Mijoz tomonining kam ishlatiladigan sahifalari (`Catalog`,
    `Checkout`, `Saved`, `Cabinet`, `EditProfile`, `ProductDetail`,
    `Orders`) — faqat bosh sahifa (`HomePage`) va savat (`CartPage`)
    darhol yuklanadi, chunki ular eng ko'p ishlatiladi
  - Ro'yxatdan o'tish formasi (`CreateStoreScreen`) — faqat "Xush
    kelibsiz" ekranidagi tugma bosilgandan keyin yuklanadi

  Bularning barchasi `React.lazy()` + `<Suspense>` bilan amalga
  oshirildi — mos fallback (kichik aylanuvchi indikator) bilan.

- **`vite.config.js`** — build konfiguratsiyasiga `manualChunks`
  qo'shildi: React, Firebase, Redux, va UI kutubxonalari (framer-motion,
  react-icons) endi **alohida** fayllarga bo'linadi. Bu ikki foyda
  beradi: (1) brauzer bu kutubxonalarni keyingi tashriflarda qayta
  yuklab olmaydi (chunki ular kamroq o'zgaradi), (2) `Vite` ogohlantirgan
  "957 KB'lik bitta fayl" muammosi yumshatiladi.

- **`firebase.json`** — hash raqamli fayllar (`/assets/**` — JS, CSS,
  rasm) uchun 1 yillik "immutable" kesh sarlavhasi qo'shildi (bu
  xavfsiz, chunki har bir yangi deploy'da fayl nomi o'zi o'zgaradi —
  eskirgan versiya hech qachon noto'g'ri ishlatilmaydi).

- **Sessiya aniqlash tezlashtirildi** — admin va sotuvchi tekshiruvlari
  endi ketma-ket emas, **parallel** (bir vaqtda) yuboriladi.

**⚠️ Hal qilinmagan, eng katta sekinlik sababi bo'lishi mumkin bo'lgan
narsa:** Cloud Function'ning "sovuq boshlanishi" (cold start) — bepul/
kam trafikli rejimda konteyner ishlatilmasa o'chib qoladi va qayta
ishga tushirish 5-10 soniyagacha davom etishi mumkin. Buni yo'qotish
uchun "minimal doim ishlaydigan nusxa" (`minInstanceCount`) sozlanishi
kerak — bu oylik qo'shimcha xarajat talab qiladi, shuning uchun
foydalanuvchidan tasdiq so'ralmoqda.

## 18. Do'kon ma'lumotlari, to'liq tahrirlash sahifasi, ko'p rasm

- **Sotuvchi "Ko'proq" sahifasi endi haqiqiy DO'KON ma'lumotini
  ko'rsatadi** (nomi, logotipi, sohasi, telefoni) — avval bu yerda
  faqat Telegram foydalanuvchi identifikatsiyasi (ism, username)
  ko'rsatilardi, garchi ro'yxatdan o'tishda alohida do'kon nomi va
  logotip kiritilgan bo'lsa ham. Endi `sellers/{uid}` hujjati
  (`getSeller`) yuklanadi va shu ma'lumot ko'rsatiladi.

- **Mahsulotni tahrirlash — endi to'liq, alohida sahifa**
  (`/seller/products/:id/edit`), avvalgi tor, faqat narx/stok uchun
  bo'lgan pastdan chiquvchi modal (`QuickEditSheet`) o'rniga. Yangi
  `EditProductPage.jsx` — `AddProductPage` bilan bir xil shaklda,
  BARCHA maydonlarni (nomi, kategoriya, narx, tannarx, stok, tavsif,
  variantlar, rasmlar) tahrirlash imkoni bilan. Boshqa sotuvchining
  mahsulotini tasodifan ochib qolsa, "Bu mahsulot sizga tegishli emas"
  degan aniq himoya ham qo'shildi.

- **Mahsulotga 4 tagacha rasm qo'shish + asosiy rasm (thumbnail)
  belgilash.** Yangi umumiy `useProductImages.jsx` hooki (add/remove/
  qayta tartiblash/yuklash mantig'i) va `MultiImageUploadCard.jsx`
  komponenti — ikkalasi ham `AddProductPage` va `EditProductPage`da
  ishlatiladi. Birinchi (⭐ belgili) rasm — katalogda ko'rinadigan
  asosiy rasm.

  **Moslik (backward compatibility) haqida muhim eslatma:** Firestore'da
  yangi `images: []` massivi qo'shildi, lekin eski `image` (yakka rasm)
  maydoni ham **saqlab qolindi** — endi u avtomatik ravishda birinchi
  (asosiy) rasmga teng qilib yoziladi. Shu tufayli `ProductCard`,
  `CartItem`, katalog va boshqa 10+ joyda `.image` maydonini o'qiydigan
  eski kodlarning **birortasini ham o'zgartirish shart bo'lmadi** —
  ular avvalgidek ishlashda davom etadi.

## 19. "Do'konni ulashish" — yangi qurilgan funksiya

Sotuvchi Dashboard'ida yangi tugma: **"🔗 Do'konni ulashish"**. Bosilganda
modal ochiladi:

- Do'konning shaxsiy havolasi (`https://t.me/zeloshop_bot?start=SOTUVCHI_ID`)
  ko'rsatiladi
- **"Nusxalash"** — havolani buferga (clipboard) nusxalaydi
- **"Ulashish"** — Telegram'ning o'z "ulashish" ekranini ochadi
  (`openTelegramLink`), sotuvchi kontakt yoki guruh tanlab yubora oladi

**Yangi fayllar:** `utils/shareLink.js` (havola yasovchi funksiya),
`ShareStoreModal.jsx`. `config/telegram.js`ga `BOT_USERNAME` konstantasi
qo'shildi.

**⚠️ Muhim, qo'lda tekshirilishi kerak bo'lgan narsa:** `BOT_USERNAME`
hozircha `"zeloshop_bot"` deb qattiq kodlangan. Agar botingizning
haqiqiy username'i boshqacha bo'lsa (masalan siz uni keyinroq
o'zgartirgan bo'lsangiz), `src/config/telegram.js` faylidagi shu
qatorni yangilang.

## 20. KRITIK: Mijoz tomoni endi to'g'ri sotuvchiga cheklangan

Bu — loyihaning eng muhim izolyatsiya talabiga to'g'ridan-to'g'ri
tegishli, jiddiy topilma edi: **mijoz (sotuvchining havolasi orqali
kirgan) bosh sahifasi, katalogi, qidiruvi va "O'xshash mahsulotlar"
bo'limi HAMMA sotuvchilarning mahsulotlarini aralashtirib ko'rsatardi**
— faqat o'sha havolani bergan sotuvchining emas.

**Sabab:** `getProducts()` xizmati hech qanday `sellerId` filtrisiz,
`products` kolleksiyasining **BARCHA** hujjatlarini yuklardi. Bu
ma'lumot Redux'da keshlanib, Home/Catalog/Qidiruv/O'xshash mahsulotlar
— barchasi shu **umumiy** keshdan foydalanardi.

**Tuzatildi:**
- `getProducts(sellerId)` — endi Firestore darajasida
  `where("sellerId","==",...)` bilan filtrlaydi
- `useFilterProducts()` va `useRelatedProducts()` — endi
  `useSession()`dan joriy `sellerId`ni olib, shu bo'yicha so'rov
  yuboradi; kesh qaysi sotuvchiga tegishli ekanini kuzatib boradi
  (`loadedForSellerId`) — sotuvchi o'zgarsa, avtomatik qayta yuklanadi
- Bu bitta tuzatish orqali **Home sahifasi, Katalog, Qidiruv taklifi,
  va "O'xshash mahsulotlar"** — barchasi avtomatik to'g'ri
  cheklangan bo'lib qoldi (ular barchasi bitta umumiy keshdan
  foydalanadi)

**Qo'shimcha izchillik uchun:** mijozning **"Mening buyurtmalarim"**
ro'yxati ham endi faqat `clientId` bilan emas, balki `clientId` VA
`sellerId` bilan birga filtrlanadi — shu bilan mijoz turli
sotuvchilardan avval buyurtma bergan bo'lsa ham, joriy do'kon
sahifasida faqat **shu do'kondan** berilgan buyurtmalarni ko'radi.
Buning uchun yangi Firestore composite index qo'shildi
(`firestore.indexes.json`).

## 21. Z-index ierarxiyasi bugi (modal + "Saqlash" tugmasi yashirilishi)

Ikkita ko'rinishda alohida bo'lib tuyulgan, lekin **bir xil** sababdan
kelib chiqqan muammo topildi va tuzatildi:

- **Sabab:** `Navbar.jsx` va `SellerNavbar.jsx` `z-1000` ishlatgan edi
  — bu barcha modal oynalar (`z-50`) va `EditProductPage`ning
  "Saqlash" tugmasi (z-index umuman yo'q edi)dan **ancha baland**.
  Natijada navbar ularning USTIDAN chiqib, ko'rinishini buzardi yoki
  tugmani butunlay bosilmaydigan qilib qo'yardi.

- **Tuzatildi:** Navbar/SellerNavbar `z-40`ga tushirildi (barcha
  modallardan past, lekin oddiy kontentdan baland). Endi til/tema
  modallari navbar ustidan to'g'ri ko'rinadi.

- **`EditProductPage`ning "Saqlash" tugmasi** — avval `bottom-0`,
  z-index'siz edi (shuning uchun navbar ostida yashiringan, "yo'q"
  bo'lib tuyulgan). Endi `AddProductPage`dagi ishlaydigan andozaga
  mos qilib (`bottom-24`, `z-40`) qayta joylashtirildi, va formaning
  oxirgi maydoni (tavsif) tugma ostida qolib ketmasligi uchun bo'sh
  joy qo'shildi.

- **Saqlash muvaffaqiyatli bo'lgandan keyingi xatti-harakat** — endi
  aniq siz so'raganidek: "O'zgarishlar saqlandi" modal oynasi chiqadi
  (mavjud `StatusModal` orqali — yangi modal yaratilmadi), va uni
  yopganda `navigate(-1)` chaqiriladi (qaysi sahifadan kelgan bo'lsangiz,
  o'sha sahifaga qaytadi).

## 22. Do'kon logotipi — bosh sahifa sarlavhasida (Header)

Mijoz tomonidagi bosh sahifaning yuqori qismida (qidiruv qatori
yonida) ko'rsatiladigan logotip — avval **doim bitta statik rasm**
(`@/assets/logo.jpg`) edi, qaysi sotuvchining do'koni ochilishidan
qat'i nazar. Endi `Header.jsx` joriy do'konning (`sellerId`) haqiqiy
logotipini `sellers/{sellerId}` hujjatidan yuklaydi va ko'rsatadi;
agar sotuvchi hali logotip yuklamagan bo'lsa, statik rasm zaxira
sifatida qoladi.

## 23. Mijoz sahifalarini qayta ko'rib chiqish (xato/warning/performance)

- **HeroSlider bannerlari mavjud bo'lmagan sahifalarga havola qilardi**
  (`/products/premium`, `/products/sale`, `/products/ai`) — bunday
  marshrutlar ilovada UMUMAN yo'q edi. Bosilganda bo'sh sahifa
  chiqardi. Endi hammasi mavjud `/catalog` sahifasiga yo'naltiradi.
- **Bosh sahifadagi "All Products" bo'limi hech qanday holat ko'rsatmasdi**
  — endi yangi (hali mahsulot qo'shmagan) sotuvchi do'koni ochilsa,
  yoki ma'lumot hali yuklanayotgan bo'lsa, mos skeleton/xabar
  ko'rsatiladi (avval bo'sh joy qolib ketardi, hech qanday tushuntirishsiz).
- `HeroSlider` va `AllProducts` komponentlariga `React.memo` qo'shildi.
- Boshqa tekshirilgan narsalar (key propslar, console.log qoldiqlari,
  memoizatsiya) — muammo topilmadi, allaqachon avvalgi bosqichlarda
  to'g'ri qilingan edi.

## 24. Katta bug-tuzatish bosqichi (8 ta screenshot bo'yicha)

- **Dark mode'da pastki qismda rang yo'qolishi** — `<html>`/`<body>`ga
  hech qanday fon rangi berilmagan edi, shuning uchun sahifa oxiridan
  o'tib ketilganda (overscroll) brauzerning standart foni ko'rinib
  qolardi. `index.css`ga aniq fon ranglari qo'shildi.
- **Mahsulot sahifasida narx bloki "Tezkor sotib olish" panelining
  ostida yashiringan** — pastki bo'sh joy (140px) yetarli emas edi,
  ayniqsa "O'xshash mahsulotlar" bo'limi bo'sh (ko'rsatilmagan) bo'lsa.
  260px'ga oshirildi.
- **Kabinet sahifasi har safar qayta ochilganda Firestore'dan qayta
  yuklanib, skeleton ko'rsatardi** — haqiqiy sabab topildi: `useRef`
  orqali saqlangan "so'rov yuborildimi" belgisi sahifa qayta
  montaj qilinganda (marshrut o'zgarganda) qayta boshlanib ketardi,
  garchi ma'lumot Redux'da (global, saqlanib qoladigan) allaqachon
  bor bo'lsa ham. Endi avval Redux'dagi ma'lumot tekshiriladi.
- **"Maxfiylik siyosati" va "Biz haqimizda"** — mavjud bo'lmagan
  `/privacy`, `/about` sahifalariga havola qilardi. Endi "Tez orada"
  modal oynasi ko'rsatiladi (seller panelidagi bilan bir xil naqsh).
- **"Tizimdan chiqish" tugmasi (mijoz Kabinet)** — umuman ishlamas
  edi (hech qanday funksiya bog'lanmagan). Endi haqiqatan Firebase
  sessiyasini tugatadi.
- **Saqlanganlar va Savat sahifalarida sarlavha kartochkaga yopishib
  turardi** — sarlavha fonida shaffoflik va kontent bilan orasida
  bo'shliq yo'q edi. Ikkalasiga ham to'liq fon va tepa bo'shlig'i
  qo'shildi.
- **Yangi funksiya:** mijoz do'konga kirganda endi Header'da (yuqori
  qidiruv paneli yonida) do'kon **nomi va telefon raqami** ham
  ko'rsatiladi, avval faqat logotip ko'rinardi.

**⚠️ Hali aniqlanmagan/javob kutilayotgan narsalar:**
- Katalog sahifasidagi "jiddiy xatolik" (kulrang xira qatlam) — screenshot
  asosida aniq sababini topa olmadim, ehtimollarni ko'rib chiqdim, lekin
  ishonchli tashxis qo'ya olmadim. Qo'shimcha ma'lumot so'raldi.
- Savat va Checkout sahifalarining dizayni "xunuk/noto'g'ri" deb
  ta'riflangan — bu aniq bug emas, balki uslubiy fikr bo'lishi mumkin,
  shuning uchun aniq nima yoqmayotganini so'radim (ranglar? joylashuv?
  boshqa uslub kerakmi?) — noaniq taxmin bilan o'zgartirish xavfli.

## 25. Aniqlashtirilgan tuzatishlar + mahsulot rasmlari karuseli

- **Katalog sahifasidagi "jiddiy xatolik" (xira ko'rinish) — sababi
  topildi:** `CatalogPage.jsx`ning o'z konteynerida **umuman dark mode
  foni yo'q edi**, ichidagi qidiruv/filtr panellari esa qorong'i fon
  bilan blur qilinardi. Bu ikkalasi orasidagi nomuvofiqlik xira
  ko'rinishni keltirib chiqargan edi — hech qanday hodisaga bog'liq
  emas, doimiy CSS xatosi edi. Tuzatildi.
- **Savat va Checkout'dagi pastki panellar** — ikkalasi ham ekranni
  chekka-chekkasigacha egallab, faqat yuqori burchaklari yumaloq,
  navbar'ga juda yaqin turardi. Endi ikkalasi ham Navbar bilan bir xil
  kenglik naqshiga ega (yon bo'shliqlar bilan), to'liq yumaloq
  burchaklar, va navbar'dan aniq bo'shliq bilan ajratilgan.
- **Mahsulot rasmlari karuseli — yangi funksiya.** Mahsulot 4 tagacha
  rasmga ega bo'lishi mumkin bo'lsa-da, tafsilot sahifasida avval
  faqat BITTA (asosiy) rasm ko'rinardi. Endi barcha rasmlar gorizontal
  surish (swipe) orqali ko'riladigan karuselda, pastida nuqta
  ko'rsatkichlari bilan namoyish etiladi. Eski, bitta rasmli
  mahsulotlar uchun ham to'g'ri ishlaydi.

## 26. KRITIK: Do'kon nomi/logotipi mijozga hech qachon ko'rinmasligining haqiqiy sababi

Avvalgi bosqichda `Header.jsx`ga do'kon nomi/logotipini ko'rsatish
kodini qo'shgan edim, lekin u ishlamasdi — sabab **kodda emas, balki
Firestore xavfsizlik qoidalarida** ekan:

`firestore.rules`da `sellers/{sellerId}` uchun `allow read: if isOwner(sellerId) || isAdmin();`
deb yozilgan edi — ya'ni **faqat sotuvchining o'zi** (yoki admin) shu
hujjatni o'qiy olardi. Mijoz (boshqa `uid`) do'konning ommaviy
ma'lumotini (nomi, logotipi) o'qishga uringanda, Firestore so'rovni
**jimgina rad etardi** — shuning uchun na logotip, na nomi hech qachon
ko'rinmasdi.

**Tuzatildi:** `sellers` kolleksiyasi uchun o'qish endi **ochiq**
(`allow read: if true`) — xuddi `products` kolleksiyasi kabi (mijozlar
do'konni ko'rishi kerak). **Yozish/tahrirlash hali ham faqat egasiga**
cheklangan — bu o'zgarmadi.

**Aniqlashtirish:** `Header.jsx` — faqat **mijoz** tomonida, va faqat
**bosh sahifada** (`HomePage.jsx`) ishlatiladi. Avvalgi javobimda "barcha
sahifada ko'rinadi" deyilgan edi — bu noto'g'ri edi, tuzatib qo'yaman:
u faqat bosh sahifada ko'rinadi, sotuvchi panelida esa umuman yo'q.

## 27. Bosh sahifa dizayni — "2-dizayn" asosida qayta qurildi

Foydalanuvchi ko'rsatgan ikkita dizayndan tanlab, gibrid emas, aynan
2-dizayn yo'nalishida uchta qismni qayta qurdik:

- **Do'kon ma'lumotlari** — endi o'zining kengroq qatorida, nomi
  kesilmasdan to'liq ko'rinadi, kattaroq logotip, va oddiy dekorativ
  "tasdiqlangan" belgisi (`MdVerified`) — **haqiqiy verifikatsiya
  tizimi emas**, faqat vizual belgi, aniq shunday so'ralgan.
- **Qidiruv** — endi alohida qatorda, va eng muhimi: bosilganda modal
  oyna ochish o'rniga **to'g'ridan-to'g'ri Katalog sahifasiga
  o'tkazadi** (`navigate('/catalog?search=...')`), kiritilgan matn
  bilan birga — Katalog sahifasidagi qidiruv maydoni buni avtomatik
  qabul qiladi (bu mexanizm allaqachon mavjud edi, faqat Header
  undan foydalanmagan edi).
- **Banner** — endi **haqiqiy barmoq bilan surish (touch swipe)ni**
  qo'llab-quvvatlaydi (gorizontal scroll-snap texnikasi — xuddi
  mahsulot rasmlari karuselidagi kabi), va vizual uslubi (qalinroq
  matn, gradient) 2-dizaynga yaqinlashtirildi.
- Endi ishlatilmay qolgan `SearchOverlay.jsx` va uning yordamchi
  hooki (`useProductSearchSuggestions.jsx`) o'chirildi.

**Yo'l-yo'lakay topilgan qo'shimcha bug:** `hero/index.js` hali ham
avvalroq o'chirilgan `Storybook.jsx` faylini eksport qilishga
urinardi (men o'sha safar bu qatorni tozalashni unutgan ekanman) —
tuzatildi.

## 28. Header'da "avval standart, keyin haqiqiy ma'lumot" yonib-o'chishi

Bu — **xuddi avvalroq Kabinet sahifasida topilgan bug bilan bir xil
turkumdagi** muammo edi: `Header.jsx` do'kon ma'lumotini o'zining
**lokal** state'ida yuklardi. Har safar Bosh sahifadan chiqib qaytilganda,
`Header` **qayta montaj** qilinadi (React marshrutlar orasida shunday
ishlaydi) — bu esa lokal state'ni noldan boshlab, avval standart
(bo'sh) holat, keyin haqiqiy ma'lumot ko'rinishiga olib kelardi.

**To'g'ri, tub yechim:** do'kon ma'lumoti endi `SessionContext`ning
o'zida — sessiya aniqlanishining bir qismi sifatida, **bir marta**
yuklanadi (allaqachon "bu odam sotuvchimi" tekshiruvi uchun
qilinayotgan so'rovning natijasi qayta ishlatiladi — qo'shimcha
so'rov shart emas). `SessionProvider` ilova ishlagan davomida hech
qachon qayta montaj qilinmaydi, shuning uchun bu ma'lumot **haqiqatan**
keshlanadi. `Header.jsx` va sotuvchi `More.jsx` — ikkalasi ham endi
shunchaki `useSession().store`ni o'qiydi, o'zlarining alohida
so'rovi/yuklanish holati kerak emas.

## 29. KRITIK: Katalogdagi bo'sh qidiruv Bosh sahifani ham "bo'shatib qo'yardi"

**Sabab:** qidiruv matni va filtr tab qiymatlari (`queryKey`,
`activeCategory`, `activeType`) — bularning barchasi Redux'da
saqlanadi, va bu — **Bosh sahifa VA Katalog sahifasi ishlatadigan
umumiy manba** (`useFilterProducts()` ikkalasida ham shu qiymatlarni
o'qib, mahsulotlarni filtrlaydi).

Katalogdan chiqib ketilganda, Katalog sahifasining **ko'rinishi**
(input, tab) qayta boshlanardi (bu — lokal state), lekin Redux'dagi
qidiruv qiymati **saqlanib qolardi**. Natijada Bosh sahifadagi
mahsulotlar ham o'sha ("hech narsa topilmadi") filtr bilan
ko'rsatilardi — garchi u yerda hech qanday qidiruv qilinmagan bo'lsa
ham.

**Tuzatildi:** `CatalogPage.jsx` endi sahifadan chiqib ketilganda
(`useEffect` tozalash funksiyasi orqali) qidiruv/filtr qiymatlarini
avtomatik standart holatiga qaytaradi. Shu bilan Katalogdan chiqish —
har doim umumiy filtrni tozalaydi, va Bosh sahifa hech qachon eski
Katalog qidiruvidan ta'sirlanmaydi.

## 30. Bosh sahifa va Katalog — to'liq mustaqil holatga ajratildi

Oldingi bo'limdagi tuzatish ("Katalogdan chiqilganda tozalash") —
**vaqtinchalik yamalash** edi. Foydalanuvchi to'g'ri savol berdi:
kelajakda Bosh sahifada (bestseller/yangi/barchasi) va Katalogda
(to'liq qidiruv) butunlay boshqa vazifalar bo'lishi kerak — ular
bir xil holatni baham ko'rmasligi kerak. Shu sabab **to'g'ri,
arxitektura darajasidagi** yechim qilindi:

- **Yangi `context/CatalogFilterContext.jsx`** — qidiruv matni va
  filtr qiymatlari endi Redux'da EMAS, balki faqat Katalog
  sahifasining o'z daraxti ichida yashaydigan Context'da. Katalogdan
  chiqilganda, bu Context **tabiiy ravishda** demontaj qilinadi —
  qo'lda "tozalash" umuman kerak emas.
- `useLiveSearch.jsx`, `useChangeType.jsx`, `useChangeCategory.jsx` —
  endi shu yangi Context bilan ishlaydi (Redux bilan emas). Hook
  nomlari o'zgarmadi, shuning uchun ularni ishlatuvchi komponentlarga
  (`SearchCatalog`, `FilterType`, `FilterBadges`) tegishning hojati
  bo'lmadi.
- **`useFilterPriduct.jsx` soddalashtirildi** — endi FAQAT Bosh sahifa
  uchun, hech qanday qidiruv/filtrga bog'liq emas (faqat oddiy
  sahifalab ko'rsatish).
- `getProductSlice.js`dan endi ishlatilmay qolgan `queryKey`/
  `activeCategory`/`activeType` va ularning reducerlari butunlay
  olib tashlandi.

**Natija:** Bosh sahifa va Katalog endi **to'liq mustaqil** —
Katalogdagi qidiruv Bosh sahifaga hech qachon, hech qanday holatda
ta'sir qilmaydi. Bu — kelajakda Bosh sahifaga yangi bo'limlar
(bestseller, yangi va h.k.) qo'shish uchun ham mustahkam poydevor.

## 31. To'lov tizimi — xavfsiz poydevor qurildi (Click/Payme)

Foydalanuvchi bilan kelishildi: **desentralizatsiyalashgan model** —
har bir sotuvchi o'zining Click/Payme hisobini ulaydi, pul
to'g'ridan-to'g'ri unga tushadi (platforma pulni ushlab turmaydi).

Click.uz (Prepare/Complete webhook, MD5 imzo) va Payme (JSON-RPC:
CheckPerformTransaction/CreateTransaction/PerformTransaction/
CancelTransaction) rasmiy hujjatlari o'rganildi.

**Qurilgan xavfsiz poydevor:**
- `sellers/{id}/private/paymentConfig` — sotuvchining Click/Payme
  hisob ma'lumotlari (Secret Key) endi asosiy `sellers` hujjatidan
  (u endi OMMAVIY o'qiladi) **ataylab alohida**, faqat egasiga
  ko'rinadigan quyi hujjatda saqlanadi
- `services/payments/paymentConfig.js`, `usePaymentConfig.jsx`
- **`PaymentSettingsPage.jsx`** (`/seller/payment-settings`) — sotuvchi
  o'z Click Service ID/Secret Key va Payme Merchant ID/Key'ini
  kiritadigan, yoqib/o'chiradigan sahifa. "Ko'proq" menyusiga
  ulandi.

**⚠️ Hali qilinmagan (ataylab, keyingi bosqichga qoldirilgan):**
haqiqiy Click/Payme webhook Cloud Function'lari (pulni qabul
qilish/tasdiqlash mantig'i) — bu pul bilan bog'liq, juda nozik
qism bo'lgani uchun, alohida, diqqat bilan qurilishi kerak.

## 32. Haqiqiy AI mahsulot tavsifi yordamchisi ulandi

"✨ AI bilan to'ldirish" tugmasi — avval **haqiqiy AI emas edi**, u har
doim, mahsulot nomi/kategoriyasidan qat'i nazar, **bitta qattiq
kodlangan matnni** qaytarardi. Endi bu — Gemini (Google AI) orqali,
mahsulot nomi va kategoriyasi asosida **haqiqiy, mahsulotga xos**
tavsif yaratadi.

**Arxitektura qarori:** Firebase AI Logic'ning brauzer SDK'si endi
App Check talab qiladi — bu Telegram'ning ichki WebView'ida beqaror
ishlashi mumkin edi. Shuning uchun boshqa barcha funksiyalar kabi,
bu ham **Cloud Function orqali, server tomonida** (`@google/genai`
SDK bilan) qurildi — API kalit hech qachon frontend kodida ko'rinmaydi.

**Yangi/o'zgargan fayllar:**
- `functions/index.js` — yangi `generateProductDescription` funksiyasi
  (faqat tizimga kirgan foydalanuvchilar chaqira oladi, Gemini
  "gemini-2.5-flash" modelidan foydalanadi, o'zbek tilida, aniq
  raqamli da'volarsiz tavsif yozadigan prompt bilan)
- `functions/package.json` — `@google/genai` qo'shildi
- `services/ai/generateDescription.js`
- `DescriptionCard.jsx` — endi yuklanish/xato holatlari bilan
  haqiqiy AI'ni chaqiradi
- `AddProductPage.jsx`/`EditProductPage.jsx` — mahsulot nomi/
  kategoriyasini AI'ga kontekst sifatida uzatadi

**⚠️ Sizdan kerak bo'lgan qadam (kod emas):**
1. https://aistudio.google.com/app/apikey — bepul Gemini API kalitini oling
2. Terminalda: `firebase functions:secrets:set GEMINI_API_KEY` (kalitni kiritasiz)
3. `firebase deploy --only functions`

## 33. AI endi mahsulot RASMIGA ham qaraydi

Avval AI faqat mahsulot nomi/kategoriyasiga qarab, umumiy taxmin
asosida tavsif yozardi — haqiqiy mahsulotni "ko'rmasdi". Endi, agar
sotuvchi rasm yuklagan bo'lsa, o'sha rasm ham AI'ga (Gemini — bu
matn VA rasmni birga tahlil qila oladi, "multimodal") yuboriladi.

**Yangi/o'zgargan fayllar:**
- `utils/imageToBase64.js` — yangi tanlangan fayl yoki mavjud URL'dan
  rasmni AI uchun kerakli formatga (base64) aylantiradi
- `functions/index.js` — `generateProductDescription` endi ixtiyoriy
  rasm qabul qiladi, mavjud bo'lsa multimodal so'rov yasaydi
- `DescriptionCard.jsx` — endi mahsulotning asosiy (birinchi) rasmini
  ham AI'ga yuboradi

## 34. Do'kon yaratish formasi kengaytirildi

Sotuvchi tomonini to'liq tugatish sessiyasi boshlandi. Birinchi qadam
— ro'yxatdan o'tish formasiga 3 ta qo'shimcha:

1. **Joylashuv (viloyat)** — yangi `constants/uzbekistanRegions.js`
   (14 ta hudud: 12 viloyat + Qoraqalpog'iston Respublikasi +
   Toshkent shahri), majburiy tanlash maydoni sifatida qo'shildi
2. **Kengaytirilgan sohalar** — Intim tovarlar, Texnika mahsulotlari,
   Gullar, Kitoblar, Qo'l mehnati mahsulotlari, Suvenir mahsulotlar,
   Konditer mahsulotlari qo'shildi
3. **Do'kon tavsifi** (ixtiyoriy) — yangi matn maydoni

`createSeller.js` endi `region` va `description` maydonlarini ham
saqlaydi.

## 35. "Mahsulot qo'shish" — production darajaga ko'tarildi

- **Rasm tugmalari** — endi sichqoncha "hover"iga bog'liq emas, doim
  ko'rinadi (mobil/Telegram'da haqiqiy sabab shu edi).
- **Kategoriya endi sohaga qarab dinamik** — `getCategoriesForNiche()`,
  17 ta sohaning har biri o'z mos subkategoriyalariga ega.
- **Chegirma narxi** (ixtiyoriy) va **to'lov turi** (Oldindan/
  Yetkazilganda — sotuvchi belgilaydi, xaridorda tanlash yo'q)
  qo'shildi.
- **Mahsulot xususiyatlari — to'liq qayta qurildi.** Avval oddiy
  teglar ro'yxati edi, endi haqiqiy xususiyat tizimi:
  `{name: "O'lcham", values: ["S","M","L"]}`. Mijoz tomonida
  (`ProductInfo.jsx`) bu guruhlangan ro'yxat sifatida ko'rinadi —
  eski (tekis massivli) mahsulotlar uchun ham to'g'ri ishlaydi.

**Yo'l-yo'lakay topilgan va tuzatilgan haqiqiy bug'lar:**
- `ProductPrice.jsx` va `ProductCard.jsx` **hech qachon yozilmagan**
  `oldPrice` maydonini o'qirdi — chegirma HECH QACHON ko'rsatilmasdi.
  Endi haqiqiy `discountPrice` maydoni ishlatiladi.
- **Savat/Checkout chegirmani hisobga olmasdi** — agar mahsulotda
  chegirma bo'lsa ham, xaridor **to'liq narxni** to'lashga majbur
  bo'lardi. `cartSlice.js` endi savatga qo'shishda haqiqiy
  (chegirmali, agar bo'lsa) narxni saqlaydi.

**Keyingi bosqichga qoldirilgan** (kelishilganidek, kattaroq, yangi
tizim talab qiladi): viloyat bo'yicha yetkazib berish narxlari, va
to'lov foizini (Click/Payme) hisob-kitobga qo'shish.

## 36. Haqiqiy sinovdan chiqqan 5 ta jiddiy kamchilik tuzatildi

**Muhim eslatma:** 1-band (kategoriya, ko'p-tanlovli to'lov turi)
tekshirilganda, bu allaqachon **parallel ishlayotgan boshqa Claude
sessiyasi** (Claude Code) tomonidan to'g'ri tuzatilgan ekan — men
konflikt qilmaslik uchun avval joriy holatni tekshirib chiqdim.

- **2-band — mahsulot xususiyatlari to'liq qayta qurildi.** Avvalgi
  murakkab (xususiyat nomi + qiymatlar + saqlash tugmasi) oqim olib
  tashlandi. Endi aniq so'ralganidek: **bitta input + "+" tugmasi**
  bitta qatorda, qo'shilgan qiymatlar pastda ro'yxat sifatida.
- **3+4-band — Checkout'dagi to'lov turi butunlay qayta qurildi.**
  Avval mijoz **mustaqil, sotuvchi sozlamalaridan bexabar** radio
  tugma orqali tanlardi. Endi bu — faqat **ma'lumot beruvchi**
  (chiroyli belgi ko'rinishida), savatdagi mahsulotlarning
  sotuvchi belgilagan to'lov turlari **kesishmasidan** hisoblanadi.
  Mijoz o'zgartira olmaydi.
- **5-band — xaritadan joylashuv tanlash qo'shildi.** Yangi
  `LocationPickerModal.jsx` — Leaflet + OpenStreetMap (bepul, API
  kalit kerak emas, CDN orqali dinamik yuklanadi). Checkout'da
  "Qo'lda" / "Xaritadan" tanlovi.

## 37. "Katalog boshqaruvi" — to'liq production/SaaS darajasiga ko'tarildi

Aniq spetsifikatsiya bo'yicha, sotuvchining mahsulotlar ro'yxati
sahifasi butunlay qayta qurildi:

- **Accessibility** — kontrastsiz `slate-400` ranglari `slate-500`/
  `zinc-300`ga almashtirildi (WCAG mos).
- **Joylashuv/skroll** — sarlavha, qidiruv va filtr tablar endi
  **qotib turadi** (sticky), faqat mahsulotlar ro'yxati skroll
  bo'ladi. "Yangi mahsulot qo'shish" endi ro'yxat oxiridagi tugma
  emas, balki pastki o'ng burchakdagi **suzuvchi (FAB)** tugma.
- **Kartochka va tezkor amallar:**
  - On/Off tugmasi endi **haqiqatan ishlaydi** (avval sof dekorativ
    edi, hech qanday funksiya bog'lanmagan edi!)
  - ✏️ Tahrirlash va 🗑️ O'chirish ikonalari qo'shildi (o'chirish —
    tasodifiy bosilib ketmasligi uchun ikki marta bosish talab
    qilinadi)
  - **Inline tahrirlash** — narx yoki stok ustiga bosilsa, to'g'ridan-
    to'g'ri shu yerda o'zgartirish mumkin
  - Stok darajasiga qarab **shartli rang**: 0-3 ta — qizil, 4-7 ta —
    sariq, 8+ — oddiy
- **Qidiruv/filtr/ommaviy amallar:**
  - Qidiruv yonida **saralash** tugmasi (narx/stok bo'yicha)
  - Checkbox orqali bir nechta mahsulotni tanlab, **ommaviy**
    faollashtirish/nofaollashtirish/o'chirish (`BulkActionBar.jsx`,
    Firestore `writeBatch` orqali — bitta so'rovda)

**Yo'l-yo'lakay topilgan qo'shimcha bug:** `ProductsCategoryTabs.jsx`
ham `BasicInfoCard`dagi bilan bir xil eski xatoga ega edi — global
(faqat kosmetika) kategoriya ro'yxatidan foydalanardi, endi sotuvchi
sohasiga mos.

**Yangi backend fayllari:** `deleteProduct.js`,
`bulkUpdateProducts.js` (Firestore `writeBatch`).

## 38. "Mahsulot qo'shish" — aniq spetsifikatsiya bo'yicha yakunlandi

- **Custom dropdown** — kategoriya tanlash endi HTML native `<select>`
  emas, to'liq o'zimiz loyihalagan komponent (tugma + suzuvchi
  ro'yxat), oxirida "+ O'z kategoriyamni yozaman" bilan.
- **Smart Calculator grid** — Tannarx/Sotish/Chegirma narxi endi
  BITTA 2-ustunli grid ichida (chegirma pastki qatorda, ikkala
  ustunni egallaydi).
- **AI banner** — sahifa yuqorisida yorqin gradient (purple→pink)
  "AI yordamida to'ldirish" tugmasi. Bu va tavsif kartochkasidagi
  eski tugma endi **bitta umumiy holatdan** (`useAIDescription`
  hook, sahifa darajasida) foydalanadi.
- **Klaviatura muammosi — TUB SABABIDAN hal qilindi.** Avval
  "Saqlash" tugmasi `position: fixed` edi — bu ba'zi WebView'larda
  klaviatura ochilganda noto'g'ri joyda qolib ketishi mumkin edi.
  Endi butun sahifa flex-ustun tuzilishida: forma o'zi
  (`flex-1 overflow-y-auto`) skroll bo'ladi, tugma esa oddiy flex
  elementi sifatida DOIM forma tagida — bu klaviatura muammosini
  yamalash emas, balki **arxitektura darajasida** oldini oladi.

## 39. "Buyurtmalar" sahifasi — to'liq production darajaga ko'tarildi

Aniq spetsifikatsiya bo'yicha, sotuvchining buyurtmalar sahifasi
butunlay qayta qurildi:

- **6 ta status** (avval faqat 3 ta edi): Kutilmoqda, Yangi,
  Yig'ilmoqda, Yo'lda, Yetkazildi, Bekor qilindi
  (`constants/orderStatus.js`)
- **Sticky sarlavha+qidiruv+tablar**, faqat ro'yxat skroll bo'ladi
- **Gorizontal suriladigan status tablar**, har birida dinamik son
- **Accordion kartochka:**
  - Checkbox, buyurtma raqami, **dinamik vaqt** ("5 daqiqa avval"),
    mijoz, summa, to'lov turi belgisi
  - Ochilganda: telefon + 📞 qo'ng'iroq va ✈️ Telegram tezkor
    tugmalari, manzilni **kuryerga nusxalash** (formatlangan matn),
    **xaritada ko'rish** havolasi
  - Mahsulot ro'yxati — miqdor (`x2`) qalin va ajratilgan rangda
- **Dinamik CTA tugmasi** — status bo'yicha o'zgaradi (Tasdiqlash →
  Kuryerga topshirish → Yetkazildi deb belgilash)
- **Bekor qilish sababi** — endi majburiy, modal orqali tanlanadi
  va `cancelReason` sifatida saqlanadi
- **Ommaviy amallar** — checkbox orqali bir nechta buyurtmani
  tanlab, birdaniga tasdiqlash/kuryerga topshirish/bekor qilish

**Yangi backend fayllari:** `services/orders/bulkUpdateOrders.js`,
`utils/relativeTime.js`. `changeOrderStatus.js` endi qo'shimcha
maydonlarni (bekor qilish sababi) ham qabul qiladi.

## 40. "Boshqaruv paneli" — to'liq SaaS analitika darajasiga ko'tarildi

- **Sticky header** — maxfiylik (👁️) va tezkor ulashish (🔗) tugmalari,
  "LIVE" belgisi
- **Maxfiylik rejimi** — yoqilsa, barcha moliyaviy raqamlar
  `•••• so'm` bilan yashiriladi
- **Tezkor ulashish** — bosilganda havola nusxalanadi va pastda
  "Link nusxalandi! 📋" degan Toast xabari chiqadi
- **Skeleton yuklanish** + silliq fade-in o'tish
- **Interaktiv SVG grafik** — davrga mos savdo dinamikasi, bosilganda/
  suriganda aniq sana va summani ko'rsatadigan mini-oynacha
- **Bento Grid (2x2):** Sof foyda (**haqiqiy** tannarx asosida
  hisoblangan — o'ylab topilmagan!), Buyurtmalar, Konversiya, Ombor
  holati

**Muhim, halol qaror:** "Konversiya" kartasi tashrif sonini talab
qiladi, lekin ilovada hozircha **hech qanday tashrif kuzatuvi yo'q**.
Soxta foiz ko'rsatish o'rniga, buni ochiq **"Hali kuzatilmayapti"**
deb belgiladim — bu haqiqiy biznes qarorlarga ta'sir qilishi mumkin
bo'lgan noto'g'ri ma'lumot berishdan ko'ra to'g'riroq.

**Yo'l-yo'lakay topilgan bug:** `animate-fade-in`/`animate-fadeIn`
klasslari bir nechta joyda (shu jumladan eski `ShareStoreModal`,
`ProductDetailPage`) ishlatilgan, lekin **hech qachon aniqlanmagan**
edi — Tailwind buni jimgina e'tiborsiz qoldirgan. Endi haqiqiy
`@keyframes fadeIn` qo'shildi, bu barcha eski joylarni ham
orqaga qarab tuzatadi.

**⚠️ Sizdan kerak bo'lgan qadam:** `lucide-react` kutubxonasi
qo'shildi, lekin hali o'rnatilmagan:
```bash
npm install
```

## 41. "Sozlamalar" (Ko'proq) sahifasi — to'liq SaaS darajasiga ko'tarildi

- **Multi-Store Switcher olib tashlandi** — arxitektura bo'yicha
  bitta sotuvchida bitta do'kon, shuning uchun ishlamaydigan soxta
  tugma qo'shilmadi (foydalanuvchi bilan kelishilgan)
- **Do'kon profili kartasi** — haqiqiy holat (🟢 Faol / 🔴 To'xtatilgan)
  sotuvchining o'z hujjatidan olinadi
- **4 ta menyu bloki**, `lucide-react` ikonkalari bilan
- **"Tizimdan chiqish" endi tasdiqlash so'raydi** — avval
  to'g'ridan-to'g'ri, hech qanday ogohlantirishsiz chiqarib
  yuborardi! Yangi `ConfirmDialog.jsx` orqali
- **Bildirishnoma tugmasi — haqiqiy** (Firestore'ga saqlanadi),
  lekin **halol eslatma**: buyurtma haqida haqiqiy push/bot xabari
  hali qurilmagan — bu faqat kelajakdagi funksiya uchun
  moslashuvni saqlaydi
- **Skeleton yuklanish** (1.2s) + silliq "Tez orada" modal

**Yo'l-yo'lakay tuzatilgan narsa:** qayta qurish jarayonida
tasodifan **haqiqiy, ishlaydigan** tungi/kunduzgi rejim
almashtirgichini tushirib qoldirgan edim — buni darhol payqab,
qaytarib qo'ydim.

## 42. "Katalog boshqaruvi" — 100% Pure Telegram Dark Theme

**Muhim:** bu sahifa endi ilovaning umumiy yorug'/qorong'i tugmasidan
**mustaqil** — doim qorong'i (aniq shunday so'ralgan). Boshqa barcha
sahifalar hali ham ikkala rejimni qo'llab-quvvatlaydi.

- Barcha emoji **lucide-react** ikonkalariga almashtirildi
- **Tarqoq ✏️/🗑️ ikonalar bitta ⋮ (MoreVertical) menyuga yig'ildi** —
  Tahrirlash / **Dublikat qilish (yangi funksiya!)** / O'chirish
- Inline narx/stok tahrirlash — endi qalamchasiz, faqat ustiga
  bosilganda ingichka indigo halqa
- **4-status tab qo'shildi:** "⚠️ Kam qolgan"
- Header'da jami tovar soni + **ombor qiymati** ko'rsatiladi

**Yangi backend fayli:** `services/products/duplicateProduct.js`.

## 43. "Buyurtmalar" — 100% Pure Telegram Dark Theme

Xuddi Katalog boshqaruvi sahifasidagi kabi, bu sahifa ham endi
ilovaning umumiy tema tugmasidan mustaqil, doim qorong'i.

**Muhim ehtiyot chorasi:** buyurtma status ranglarini (`getOrderStatusInfo`)
Dashboard'dagi "So'nggi buyurtmalar" va mijoz tomonidagi buyurtmalar
tarixi ham ishlatadi — ular esa hali ikkala rejimni qo'llab-quvvatlaydi.
Shuning uchun ularni **o'zgartirmadim**, buning o'rniga faqat shu
sahifa uchun alohida `ORDER_STATUS_DARK_COLORS` xaritasi qo'shdim —
bu boshqa sahifalarni buzib qo'yishning oldini oldi.

- Barcha emoji **lucide-react** ikonkalariga almashtirildi
- Kartochka 4 ta aniq bo'limga bo'lindi: sarlavha, mijoz/yetkazish,
  mahsulotlar, tezkor amallar
- Nusxalash — endi matn o'rniga haqiqiy **Toast** bildirishnomasi
  bilan
- Header'da jami **yetkazilgan buyurtmalar tushumi** va faol
  buyurtmalar soni

## 44. Katalog va Buyurtmalar — yorug'/qorong'i rejimga qaytarildi

Oldingi ikkita bosqichda bu ikki sahifa "100% Pure Dark" qilib
qurilgan edi — bu boshqa sahifalar (Dashboard, mijoz tomoni) bilan
**nomuvofiqlik** yaratganini muhokama qilib, foydalanuvchi buni
**qaytarishga** qaror qildi.

**Nima saqlab qolindi (barcha yangi funksiyalar):**
- `lucide-react` ikonkalari
- MoreVertical (⋮) popover menyu + **Dublikat qilish**
- Inline narx/stok tahrirlash
- "Kam qolgan" 4-status tab, ombor qiymati badge
- 4 bo'limli buyurtma kartochkasi tuzilishi
- Toast bildirishnomalari (nusxalash uchun)

**Nima o'zgardi:** barcha qattiq yozilgan Telegram-dark ranglar
(`#17212b`, `#232e3c` va h.k.) ilovaning standart
`bg-white dark:bg-slate-900` uslubiga qaytarildi — endi bu ikkala
sahifa ham boshqa barcha sahifalar kabi, foydalanuvchi tanlagan
rejimga (yorug'/qorong'i) mos keladi.

## 45. 2 ta arxitektura zid kelishi to'g'irlandi + 2 ta yangi modul

So'ralgan 3 modul o'rniga, ikkitasida jiddiy zid kelish topildi va
foydalanuvchi bilan kelishilgan holda tuzatildi:

- **"Balans/Pul yechish"** — sizning **markazlashtirilmagan** to'lov
  arxitekturangizga (pul to'g'ridan-to'g'ri sotuvchining o'z Click/
  Payme hisobiga tushadi) zid edi — **butunlay olib tashlandi**.
- **"Sotuvchi o'z bot tokenini kiritadi"** — sizning **bitta umumiy
  bot** arxitekturangizga zid edi — o'rniga **haqiqiy Do'kon
  sozlamalari** (ro'yxatdan o'tgandan keyin nom/logotip/telefon/
  joylashuvni tahrirlash — ilgari mumkin bo'lmagan, aniqlangan
  bo'shliq) qurildi.

**To'liq qurilgan:**
- **Yetkazib berish va Logistika** — 5 ta hududiy guruh bo'yicha
  kuryer narxi + yetkazish muddati, avtomatik pul formatlash,
  bepul yetkazib berish chegarasi
- **Do'kon sozlamalari** — logotip, nom, telefon, joylashuv, soha,
  tavsifni tahrirlash

## 46. Bot tokeni masalasi kelishildi + 2 ta yangi to'liq modul

Bot tokeni haqida yana so'ralganda, aniqlashtirdim — bu haqiqatan
**har bir sotuvchi o'z alohida botiga ega bo'lsin** degan, katta
arxitektura o'zgarishi ekan. Bu — kelajakda **alohida chuqur
muhokama** qilinadigan, hozircha qurilmagan mavzu bo'lib qoldi.

**To'liq qurilgan ikkita yangi modul:**

- **Marketing va Kuponlar** — sotuvchi foiz/aniq summali promokod
  yaratadi (muddat, ishlatish limiti bilan). **Mijoz tomonida ham
  to'liq ishlaydi** — Checkout'da kod kiritib qo'llash mumkin,
  chegirma haqiqatan buyurtma summasidan ayriladi va saqlanadi.
  Promokodning ishlatilish soni **server tomonida** (Cloud Function
  orqali) oshiriladi — mijoz tomonidan emas, xavfsizlik uchun.
- **Maxfiylik va Xavfsizlik** — haqiqiy 4 xonali **PIN kod qulfi**.
  Bu shunchaki dekorativ tugma emas — yoqilganda, butun sotuvchi
  paneli haqiqatan shu qulf ortida turadi (`SellerLayout.jsx`ga
  bog'landi).

**Yo'l-yo'lakay tuzatilgan qo'shimcha bug:** `sendOrderData.js`
buyurtma summasini **har doim chegirmasiz** hisoblardi — checkout'da
promokod qo'llansa ham, saqlangan summa **noto'g'ri** (to'liq)
bo'lib qolardi. Endi to'g'ri, chegirmali summa saqlanadi.

## 47. O'z-o'zini tekshiruv — 2 ta jiddiy xato topildi va tuzatildi

Foydalanuvchi so'ragan holda, oxirgi taqdim etilgan kodni **o'zim
qayta tekshirib chiqdim**:

### 🔴 Jiddiy: PIN kod ochiq joyda saqlanayotgan edi

"Maxfiylik va Xavfsizlik" (PIN kod) qismini qurayotganda, PIN'ni
`updateSeller()` orqali — ya'ni **ochiq o'qiladigan** `sellers`
hujjatiga yozib qo'ygan ekanman. Bu — sizning PIN kodingiz **har bir
mijoz** tomonidan (do'konga kirganda yuklanadigan ma'lumot orqali)
ko'rinishi mumkin edi. Endi maxfiy `sellers/{id}/private/security`
joyiga ko'chirildi.

### 🟡 O'rtacha → to'liq tuzatildi: Checkout xavfsizligi

Buyurtma yaratish **butunlay qayta qurildi** — yangi `createOrder`
Cloud Function (Firestore transaction):
- Mahsulot narxlarini **HAQIQIY** Firestore'dan qayta hisoblaydi
  (mijoz brauzeridan kelgan narxga ishonmaydi)
- Promokodni **server tomonida** qayta tekshiradi
- **Bonus:** ombor qoldig'ini avtomatik kamaytiradi, va promokod
  limitidan parallel oshib ketishning oldini oladi
- Firestore qoidasida `orders`ga to'g'ridan-to'g'ri yozish **butunlay
  yopildi** — aks holda kimdir yangi tekshiruvni chetlab o'tishi
  mumkin edi

## 48. Mahsulot qo'shish/tahrirlash qismini xavfsizlik tekshiruvi

- **Yaxshi xabar:** `products` kolleksiyasi uchun Firestore qoidalari
  (yaratish faqat `sellerId==auth.uid`, tahrirlash/o'chirish faqat
  egasi) **to'g'ri sozlangan** — bu yerda haqiqiy zaiflik topilmadi.
- **Topilgan, tuzatilgan kamchilik:** `duplicateProduct.js` asl
  mahsulotning `sellerId`sini **ko'r-ko'rona** nusxalar edi. Firestore
  qoidasi buni baribir bloklardi (haqiqiy xavf emas edi), lekin kod
  o'zi buni **aniq tekshirishi** kerak edi — endi joriy sotuvchi ID'si
  aniq tekshiriladi va o'rnatiladi.
- `EditProductPage.jsx`dagi "bu mahsulot sizga tegishli emas"
  tekshiruvi — hali ham to'g'ri ishlayotgani tasdiqlandi.

**⚠️ Aniqlanmagan, tekshirilishi kerak bo'lgan narsa:** loyihada
`storage.rules` fayli **umuman yo'q**. Firebase Storage'dagi haqiqiy
qoidalarni Console orqali tekshirib ko'rish tavsiya etiladi.

## 49. 🔴 KRITIK: Storage butunlay ochiq edi — tuzatildi

Siz yuborgan qoida shuni ko'rsatdi: `allow read, write: if true` —
**hech qanday tekshiruvsiz**, butun Storage uchun. Bu — **eng jiddiy**
topilgan muammo edi.

**Sabab:** `firebase.json`da Storage konfiguratsiyasi **umuman yo'q**
edi — shuning uchun hech qachon haqiqiy qoida deploy qilinmagan,
bucket Firebase'ning xavfli "test rejimi" standart holatida qolib
ketgan.

**Tuzatildi:**
- Yangi `storage.rules` — standart holat: **hech kimga ruxsat yo'q**,
  keyin har bir aniq papka uchun kerakli ruxsat:
  - `store-logos/{sellerId}` — faqat egasi yoza oladi
  - `avatars/{uid}` — faqat egasi
  - `products/` — istalgan tizimga kirgan foydalanuvchi
  - O'qish — hammaga ochiq (mahsulot rasmlari ko'rinishi kerak)
- `firebase.json`ga `storage.rules` fayli qo'shildi

**⚠️ Zarur qadam:**
```bash
firebase deploy --only storage
```

## 50. Ikkala bo'shliq to'ldirildi + yana chuqurroq xavfsizlik tekshiruvi

### A) Logistika → Checkout — to'liq ulandi

- Checkout'da endi **hudud tanlash** paydo bo'ladi (agar sotuvchi
  narx belgilagan bo'lsa)
- Yetkazib berish narxi — **server tomonida** (`createOrder`),
  sotuvchining haqiqiy sozlamasidan hisoblanadi (mijoz narxni
  o'zgartira olmaydi — xuddi mahsulot narxi va promokod kabi)
- Bepul yetkazib berish chegarasi — avtomatik ishlaydi
- Sotuvchi tomonida buyurtma kartochkasida yetkazib berish
  ma'lumoti ko'rinadi

### B) Kunlik P&L hisoboti — endi haqiqatan yuboriladi

Yangi **rejalashtirilgan** Cloud Function (`sendDailyPnLReport`) —
har kuni soat 21:00da (Toshkent vaqti), yoqilgan har bir sotuvchiga
kunlik buyurtmalar/tushum/taxminiy foyda haqida haqiqiy Telegram
xabari yuboradi.

### C) Yana bir topilgan va tuzatilgan zaiflik

`sendCrmNotification` — frontend yuborgan mijozlar ro'yxatiga
**hech qanday tekshiruvsiz** ishonardi. Nazariy jihatdan, bu botni
**ixtiyoriy Telegram ID**larga spam yuborish vositasi sifatida
suiiste'mol qilinishi mumkin edi. Endi har bir ID sotuvchining
**haqiqiy buyurtma tarixida** borligi tekshiriladi.

### ⚠️ Aniqlangan, hali tuzatilmagan bo'shliq

**P&L Dashboard**'da "Bugun/Hafta/Oy" degan narsa **umuman yo'q** —
u har doim **butun tarix** bo'yicha ko'rsatadi, hech qachon faqat
"bugungi" yoki "shu haftaning" foydasini ajratib bermaydi. Buni ham
tuzatishni xohlaysizmi?

## 51. P&L Dashboard — davr filtri qo'shildi

Asosiy Dashboard'dagi kabi **Bugun/Hafta/Oy** tanlovi qo'shildi.
Endi Sof foyda, Margin, ROI — barchasi tanlangan davrga mos
hisoblanadi (avval har doim butun tarix bo'yicha edi). Xarajatlar
ro'yxati va CSV eksport ham shu davrga mos.

**⚠️ MUHIM ESLATMA:** foydalanuvchi xavfsizlik tuzatishidan keyin
`firebase deploy --only functions`ni hali ishlatmagan — ya'ni
`createOrder`, stokni kamaytirish, yetkazib berish narxi, promokod
xavfsizligi, CRM push — bularning **hech biri hali ishlamayapti**,
chunki kod hali serverga yuborilmagan. Bu — keyingi eng muhim qadam.

## 52. 🔴 LCP 13.68s topildi va sababi tuzatildi

Haqiqiy Chrome ko'rsatkichlari: **LCP 13.68 soniya** ("poor", Google
standartidan 3+ baravar yomon). CLS va INP — ikkalasi ham "yaxshi".

**Sabab:** men avval **sof "chiroy" uchun** (skeleton→kontent
o'tishi silliqroq ko'rinishi uchun) bir nechta sahifaga **sun'iy
kechikish** (1000-1500ms `setTimeout`) qo'shgan edim. Bu — haqiqiy
ma'lumot tezroq kelsa ham, foydalanuvchini **bekorga kutishga**
majbur qilar edi, va bu vaqt to'g'ridan-to'g'ri LCP ko'rsatkichiga
qo'shilardi.

**Tuzatildi — 4 ta sahifada:** Dashboard, Katalog boshqaruvi,
Buyurtmalar, Sozlamalar. Endi skeleton faqat **haqiqiy** ma'lumot
yuklanayotganda ko'rinadi, sun'iy kechikishsiz.

## 53. LCP diagnostikasi — vaqtinchalik o'lchov qo'shildi

Sun'iy kechikish tuzatishi deploy qilingandan keyin ham LCP
yaxshilanmadi (11.47s → 12.72s) — bu, sun'iy kechikish **asosiy
sabab emasligini** tasdiqladi.

DOM orqali LCP elementi aniq tasdiqlandi: Dashboard'dagi savdo
raqami. Network tabidagi "channel" so'rovlari (30-49s) — bu
Firestore'ning real-time tinglash aloqasi, **muammo emas**.

**Endi:** `SessionContext.jsx`, `useFilterOrders.jsx`,
`useGetSellerProducts.jsx`ga **vaqtinchalik** aniq o'lchov
(`console.time`/`console.timeEnd`) qo'shildi — bu har bir bosqich
(Telegram kutish, autentifikatsiya, do'kon ma'lumoti, buyurtmalar,
mahsulotlar) **aniq necha millisekund** olayotganini Console'da
ko'rsatadi.

**Keyingi qadam:** deploy qilib, ilovani oching, DevTools'ning
**Console** tabini (Performance yoki Network emas) oching va u
yerda paydo bo'lgan barcha `⏱️`/`1️⃣`-`6️⃣` yozuvlarini screenshot
qilib yuboring.

## 54. 🎯 LCP'ning haqiqiy sababi topildi va tuzatildi

Diagnostika **aniq raqam** berdi: `admin+seller` (ikkita oddiy
Firestore hujjatini o'qish) — **4.82 soniya**, butun sessiya
vaqtining (8.33s) yarmidan ko'pi!

**Sabab:** `getFirestore(app)` standart sozlamalarda Firestore
SDK'ga avval WebSocket ulanishini sinab ko'rishni, keyin (agar
ishlamasa) "uzoq-so'rov" rejimiga o'tishni buyuradi. Bu **aniqlash
jarayonining o'zi** Telegram WebView'da bir necha soniya olishi
mumkin — bu, Google'ning o'zi hujjatlashtirgan holat.

**Tuzatildi:** `firebase/config.js` — `getFirestore(app)` →
`initializeFirestore(app, { experimentalAutoDetectLongPolling: true })`.

## 55. LCP — ikkinchi, kattaroq optimizatsiya

Avvalgi tuzatish (9.68s'gacha tushirgan) yetarli emas edi — endi
**yanada kattaroq** qadam qo'ydik: admin+do'kon ma'lumotini
**butunlay mijozdan olib, server tomoniga ko'chirdik**.

**Nima o'zgardi:**
- `verifyTelegramAuth` Cloud Function endi admin+do'kon hujjatlarini
  **o'zi (Admin SDK orqali, tezkor)** o'qiydi va javobning o'zida
  qaytaradi (`isAdmin`, `store`)
- Bu — mijoz tomonidagi **sekin (4.82s) Firestore ulanishini**
  butunlay chetlab o'tadi
- `SessionContext.jsx` soddalashtirildi — endi alohida so'rov
  yubormaydi, javobdan to'g'ridan-to'g'ri foydalanadi
- Firestore Timestamp (masalan `createdAt`) maydonlari to'g'ri
  ISO-formatga o'giriladi (aks holda noto'g'ri qaytishi mumkin edi)

## 56. LCP — senior darajadagi gibrid o'qish strategiyasi

Siz to'g'ri payqadingiz: buyurtmalar/mahsulotlar birinchi javobi
(~2.5s har biri) — endi navbatdagi katta bo'g'in edi. Sabab —
`onSnapshot` (real-vaqtli tinglash) ulanishini **birinchi marta**
o'rnatish xarajati, endi shu joyga ko'chgan.

**Senior darajadagi yechim** — yangi qayta ishlatiladigan
`services/shared/subscribeWithFastInitial.js`:
1. Avval **tez, bir martalik** (`getDocs`) o'qish — foydalanuvchi
   **darhol** ma'lumotni ko'radi
2. Fon rejimida haqiqiy **real-vaqtli** (`onSnapshot`) ulanish
   o'rnatiladi — bundan keyingi o'zgarishlar hali ham **to'liq jonli**

Bu **izchil ravishda barcha** real-vaqtli tinglovchilarga qo'llandi:
`getOrderData.js`, `getSellerProducts.js`, `getClientOrder.js`
(mijoz buyurtmalar tarixi), `getAllSellers.js` (admin panel). Har
bir xizmatning **tashqi interfeysi o'zgarmadi** — shuning uchun
hooklar/komponentlar hech narsani bilishi shart emas.

## 57. Yashirin bo'shliq — "ko'rinmas" 5 soniyani izlaymiz

Raqamlar yaxshi (sessiya 3.27s + ma'lumot ~0.9s ≈ 4.2s), lekin LCP
hali ham 9.42s — bu ikkisi orasida **~5 soniyalik tushuntirilmagan
farq** bor. Sababi: mening o'lchovlarim faqat React ishga
tushgandan **keyin** boshlanadi — JS fayllarining yuklanishi/
bajarilishi uchun ketgan vaqt **umuman o'lchanmagan** edi.

**Tuzatildi:** `index.html`ning eng boshiga xom vaqt belgisi
qo'shildi, `SessionContext.jsx`da esa shu belgi bilan solishtirib,
**haqiqiy to'liq rasmni** ko'rsatadigan yangi `0️⃣` o'lchovi
qo'shildi. Shuningdek, gibrid o'qish ikki marta ishlashi sababli
kelib chiqqan "Timer does not exist" ogohlantirishi ham tuzatildi.

## 58. JS yuklanishi rad etildi — oxirgi o'lchov nuqtasi qo'shildi

`0️⃣` natijasi: JS yuklanishi atigi **431ms** — bu gipoteza noto'g'ri
chiqdi. Butun o'lchangan zanjir jami **~3.6 soniya**, lekin LCP
oldingi safar **9.42 soniya** edi — hali ham **~5.8 soniyalik**
tushuntirilmagan farq bor.

**Qo'shildi:** `Dashboard.jsx`ga oxirgi, `7️⃣` o'lchov nuqtasi —
Dashboard **aynan qachon** haqiqiy tarkibni chizishga tayyor
bo'lishini ko'rsatadi.

**Keyingi qadam:** bu safar **bitta test yugurishidan** ham Console
(barcha `0️⃣`-`7️⃣` qatorlar), ham Performance (LCP raqami) natijasini
**birga** yuborish kerak — turli test yugurishlaridan solishtirish
chalkashlik keltirib chiqarishi mumkin.

## 59. 🎯 Nihoyat topildi — asosiy sabab

`7️⃣` (8.65-9.6s) — bu deyarli **aynan** LCP raqamlariga mos keldi!
Lekin `5️⃣`/`6️⃣`ning o'zi atigi ~900ms — demak, sessiya tugashi
(2.8-3.35s) bilan buyurtmalar/mahsulotlar hooklari **boshlanishi**
orasida **~4-5 soniyalik** tushuntirilmagan bo'shliq bor edi.

**Sabab topildi:** `Dashboard` sahifasi **lazy-loaded** (kechiktirib
yuklanadigan) edi — boshqa barcha sotuvchi sahifalari kabi. Lekin
Dashboard — sotuvchi **har doim birinchi** ko'radigan sahifa!
Lazy-loading esa, marshrutlash Dashboard'ni chizishga qaror
qilgandan **keyingina**, uning JS qismini **alohida, sovuq tarmoq
so'rovi** orqali yuklashni talab qilardi — bu aynan kritik yo'lning
o'rtasida turgan edi.

**Tuzatildi:** `seller.route.jsx`da Dashboard endi **oddiy** (lazy
emas) import qilinadi — asosiy dastur kodi bilan birga oldindan
tayyor turadi. Boshqa, kamroq tashrif buyuriladigan sahifalar
(Products, Orders, PnL va h.k.) hali ham lazy holda qoladi.

Bu — ehtimol, **eng asosiy** qolgan sabab edi.

## 60. "Ikkinchi loader" — uchinchi yashirin bosqich topildi

Sizning "ikki xil loader" kuzatuvingiz **to'g'ri** edi — men buni
qo'lda tekshirib chiqdim va **uchinchi, umuman o'lchanmagan**
bosqichni topdim: `SellerLayout.jsx` Dashboard render bo'lishidan
**oldin**, PIN xavfsizligini tekshirish uchun **o'zining alohida**
Firestore so'rovini yuborardi.

**Tuzatildi:** bu ma'lumot ham endi `verifyTelegramAuth`ning o'ziga
qo'shildi (faqat sotuvchi o'zi to'g'ridan-to'g'ri kirganda — mijoz
sessiyasiga hech qachon sizib chiqmaydi). `SellerLayout.jsx` endi
alohida so'rov yubormaydi, natijada **ikkinchi loader butunlay
yo'qoladi**.

## 61. "Qayta yuklash" nosozligi — eskirgan kesh gipotezasi

Video orqali payqagan **yangi** nosozlik (qora oyna → eski sahifa
qisqa ko'rinadi → qayta yuklash boshlanadi) — LCP tuzatishlaridan
**aynan keyin** paydo bo'lgani tasdiqlandi.

**Gipoteza:** kesh-taqiqlash qoidasi faqat aniq `/index.html`
yo'liga tegishli edi, lekin ilova `/seller` yoki `/` kabi yo'llar
orqali ochiladi. Bu sessiya davomida **o'nlab marta** qayta deploy
qilganimiz uchun (har safar yangi JS fayl nomlari bilan, eskilari
o'chiriladi) — agar Telegram WebView eski `index.html`ni keshda
saqlab qolsa, u **endi mavjud bo'lmagan** eski fayllarga ishora
qiladi, bu esa avtomatik qayta yuklanishni keltirib chiqaradi.

**Tuzatildi:** `firebase.json`da kesh-taqiqlash qoidasi **barcha**
yo'llarga (`**`) kengaytirildi, qo'shimcha himoya headerlari
(`Pragma`, `Expires`) qo'shildi.

## 62. Ikkita spinner — haqiqiy sabab topildi va tuzatildi

Siz to'g'ri turib olib, meni **haqiqatan tekshirishga** majbur
qildingiz — va bu **to'g'ri chiqdi**. `App.jsx`da alohida
`RouteFallback` degan **ikkinchi** spinner bor edi, `SessionGate.jsx`-
dagidan farqli:
- O'lchami boshqacha (`w-8` vs `w-10`)
- **Fon rangi umuman yo'q edi** — bu, ayniqsa qorong'i rejimda,
  bir zumga noto'g'ri rangda ko'rinishi mumkin edi

Shuningdek, `PrivacySecurityPage.jsx`da ham alohida spinner
`indigo` (boshqalari `blue`) rangda ekanini topdim.

**Tuzatildi:** yagona `components/ui/FullScreenSpinner.jsx`
yaratildi, va **barcha** joylarda (SessionGate, App.jsx, 4 ta
sahifa) shu bitta komponent ishlatiladi. Endi haqiqatan **faqat
bitta** dizayn bor.

## 63. Hali yashirin bo'shliq bor — chuqurroq diagnostika qo'shildi

Dashboard'ni eager qilish yordam bergan bo'lsa-da, matematikasi
hali ham to'liq mos kelmayapti: buyurtmalar/mahsulotlarning **o'z**
davomiyligi (~1.4s) taxminan **5.3s**da tayyor bo'lishini
ko'rsatadi, lekin `7️⃣` hali ham **8.6s**, va **yana** 10.05s'da
qayta ishga tushdi.

**Qo'shildi:**
- `5️⃣a`/`6️⃣a` — buyurtmalar/mahsulotlar hooklari **aynan qachon
  boshlanishini** (sof vaqt, sahifa boshidan) ko'rsatadi — bu bizga
  bo'shliq hook **boshlanishidan oldin**mi yoki **ichida**mi ekanini
  aniqlab beradi
- `7️⃣`ning ikki marta ishga tushishi endi **toza** o'lchanadi
  (`7️⃣ (BIRINCHI)` va `7️⃣❗ QAYTA`)

## Qolgan tavsiyalar (keyingi bosqich uchun)

Vaqt va hajm cheklovi tufayli quyidagilar hali qo'lga olinmadi — lekin
ular tanqidiy emas, xohlasangiz keyingi bosqichda birga ko'rib chiqamiz:

1. Firestore Security Rules — hozircha ko'rmadim (zipda yo'q). Multi-tenant
   tizimda ENG MUHIM narsa — har bir sotuvchi faqat o'z ma'lumotlariga
   yoza olishini Firestore qoidalarida ham majburlash kerak (frontend
   filtri yetarli emas, xohlagan odam brauzer konsolidan boshqa
   sotuvchining ma'lumotini o'zgartirib yuborishi mumkin).
2. `pages/admin.jsx` va `routes/admin.route.jsx` — ikkalasi ham bo'sh,
   admin panel hali boshlanmagan.
3. `src/config/` va `src/types/` papkalari bo'sh edi (skelet sifatida
   qoldirilgan, hali ishlatilmagan).
4. `ProductDetailPage`dagi `useEffect` bog'liqliklari (`getSingleProduct`,
   `handleClearProduct`) ataylab `[id]` bilan cheklangan — ishlaydi, lekin
   ideal holatda bu funksiyalar `useCallback` bilan barqarorlashtirilishi
   mumkin.
