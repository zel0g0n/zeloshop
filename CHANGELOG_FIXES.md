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
