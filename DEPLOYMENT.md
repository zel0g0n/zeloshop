# ZeloShop — to'liq ishga tushirish (deploy) qo'llanmasi

> **Muhim eslatma:** bu qo'llanma kodni **sizning haqiqiy Firebase
> loyihangizga (`commerce-zelo`) ulanmasdan** yozildi — buyruqlarning
> hech biri bu sandbox ichida sizning haqiqiy loyihangizga qarshi ishga
> tushirilgan emas. Quyidagi qadamlarni siz o'zingizning terminalingizda
> bajarishingiz kerak.

Platformada **3 ta Telegram bot** bor (asosiy bot — sotuvchi/mijoz,
xodim boti, kuryer boti) va ular uchun jami **8 ta maxfiy kalit
(secret)** kerak. Eski qo'llanmada faqat 1 tasi (`BOT_TOKEN`) bor edi —
bu versiya hammasini o'z ichiga oladi.

## Tezkor xulosa — to'liq buyruqlar ketma-ketligi

```bash
# 1) Vositalarni o'rnatish va loyihaga ulanish
npm install -g firebase-tools
firebase login
firebase use commerce-zelo

# 2) 8 ta maxfiy kalitni sozlash (har birida token/qiymatni so'raydi)
firebase functions:secrets:set BOT_TOKEN
firebase functions:secrets:set STAFF_BOT_TOKEN
firebase functions:secrets:set COURIER_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set STAFF_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set COURIER_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set SENTRY_DSN

# 3) Backend: paketlar, qoidalar, indexlar, funksiyalar
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes

# 4) Frontend: build va hosting
npm install
npm run build
firebase deploy --only hosting
```

Shundan keyin **Admin panel**ga kirib, 3 ta webhook tugmasini bosish va
BotFather'da asosiy botning Mini App URL'ini sozlash kerak — bular
pastda 6- va 7-bo'limlarda batafsil.

---

## 1. Talab qilinadigan vositalar

- Node.js 20 (`functions/package.json`da `"engines": {"node": "20"}`
  qat'iy talab qilingan — boshqa versiyada `firebase deploy --only
  functions` xato berishi mumkin)
- `npm install -g firebase-tools`, so'ng `firebase login`

## 2. Loyihani ulash

Loyiha ildizida (`package.json` yonida):

```bash
firebase use commerce-zelo
```

(`.firebaserc` fayli allaqachon shu loyiha ID'siga sozlangan — bu
buyruq shunchaki joriy terminalni o'sha loyihaga "ko'rsatadi".)

## 3. 8 ta maxfiy kalit (secrets) — MAJBURIY

Bular kodga **hech qachon** yozilmaydi, faqat Google Cloud Secret
Manager'da saqlanadi. Har birini alohida sozlash kerak — biror
funksiya kodida `secrets: [...]` ro'yxatida ishlatilgan sekret
Secret Manager'da mavjud bo'lmasa, `firebase deploy --only functions`
xato berib to'xtaydi.

```bash
firebase functions:secrets:set BOT_TOKEN
firebase functions:secrets:set STAFF_BOT_TOKEN
firebase functions:secrets:set COURIER_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set STAFF_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set COURIER_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set SENTRY_DSN
```

Har biri nima uchun kerak:

| Sekret | Nima uchun | Qayerdan olinadi |
|---|---|---|
| `BOT_TOKEN` | Asosiy bot (sotuvchi + mijoz) | @BotFather → `/newbot` |
| `STAFF_BOT_TOKEN` | Xodim boti | @BotFather → alohida `/newbot` |
| `COURIER_BOT_TOKEN` | Kuryer boti | @BotFather → alohida `/newbot` |
| `TELEGRAM_WEBHOOK_SECRET` | Asosiy bot webhook so'rovini tekshirish uchun maxfiy satr | O'zingiz o'ylab topgan istalgan uzun tasodifiy satr (masalan `openssl rand -hex 32`) |
| `STAFF_TELEGRAM_WEBHOOK_SECRET` | Xodim boti webhooki uchun xuddi shunday | O'zingiz o'ylab topasiz |
| `COURIER_TELEGRAM_WEBHOOK_SECRET` | Kuryer boti webhooki uchun xuddi shunday | O'zingiz o'ylab topasiz |
| `GEMINI_API_KEY` | AI tavsif, AI CEO, narx tavsiyalari va h.k. barcha AI funksiyalari | [Google AI Studio](https://aistudio.google.com/apikey) — bepul kalit |
| `SENTRY_DSN` | Backend xatolarini kuzatish (Sentry) | [sentry.io](https://sentry.io) loyihasidan DSN. **Agar Sentry kerak bo'lmasa ham, bu qadamni o'tkazib bo'lmaydi** — kod sekret bo'sh bo'lsa xato kuzatuvini jim o'chiradi (xavfsiz), lekin sekretning o'zi Secret Manager'da **mavjud** bo'lishi shart, aks holda deploy xato beradi. Sentry ishlatmoqchi bo'lmasangiz, so'ralganda istalgan joyboshi (masalan `not-configured`) yozib qo'ying |

`openssl rand -hex 32` — webhook maxfiy satrlarini generatsiya qilish
uchun qulay buyruq (uch marta ishlatib, uchta har xil qiymat oling).

## 4. Ixtiyoriy sozlamalar (agar bot username'lari standartdan farq qilsa)

Kodda 2 ta bot username qattiq yozilgan standart qiymatga ega:
`zeloshop_xodim_bot` (xodim boti) va `zeloshop_kuryer_bot` (kuryer
boti). Agar botlaringizni BotFather'da BOSHQA username bilan
yaratgan bo'lsangiz, `functions/.env.commerce-zelo` faylini yarating:

```
STAFF_BOT_USERNAME=sizning_xodim_bot_username
COURIER_BOT_USERNAME=sizning_kuryer_bot_username
```

Agar username'lar standart bilan bir xil bo'lsa, bu faylni yaratish
shart emas.

(Frontendning o'zi uchun `.env` fayli shart emas — Firebase
konfiguratsiyasi `src/firebase/config.js`da tayyor yozilgan. Yagona
ixtiyoriy frontend o'zgaruvchisi — `VITE_SENTRY_DSN` — bo'lmasa ham
ilova ishlayveradi, faqat frontend xato kuzatuvi o'chiq turadi.)

## 5. Backendni deploy qilish (Functions + Firestore qoidalari/indexlar)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Bu birinchi marta bir necha daqiqa vaqt olishi mumkin (yangi
composite index'lar Firestore'da "building" holatida bo'ladi —
Firebase Console → Firestore → Indexes'da holatini kuzatish mumkin,
index tayyor bo'lmaguncha o'sha index kerak bo'lgan so'rovlar xato
berishi mumkin).

## 6. Frontendni build qilish va Hosting'ga joylashtirish

```bash
npm install
npm run build
firebase deploy --only hosting
```

Deploy tugagach, terminalda https havola beriladi — odatda
`https://commerce-zelo.web.app`. Shu havola — Mini App manzilingiz.

## 7. Uchta botni Telegram tomonida sozlash

**Asosiy bot** (sotuvchi/mijoz) — Mini App URL'i BotFather orqali
QO'LDA sozlanishi kerak:

- @BotFather → botingiz → **Bot Settings → Menu Button** (yoki
  `/newapp`) → 6-bo'limda olingan https havolangizni kiriting.

**Xodim boti** va **kuryer boti** — bularga BotFather'da alohida Mini
App URL sozlash **shart emas**: ular ilovani ochish tugmasini
o'zlari, xabar ichida (`web_app` inline tugma) yuboradi va URL'ni
hosting domeningizdan avtomatik quradi.

**Uchala bot uchun ham webhook'ni ro'yxatdan o'tkazish** — bu
BotFather orqali emas, balki Admin panel orqali, bitta marta:

1. Admin panelga kiring (asosiy botdagi admin akkaunt bilan)
2. "Webhook sozlash" bo'limida 3 ta tugmani birma-bir bosing:
   - Asosiy bot webhookini ro'yxatdan o'tkazish
   - Xodim boti webhookini ro'yxatdan o'tkazish
   - Kuryer boti webhookini ro'yxatdan o'tkazish

Har bir tugma mos `register*Webhook` Cloud Function'ini chaqiradi —
u Telegram'ga "endi shu manzilga xabar yubor" deb aytadi. **Funksiyalar
deploy qilinmasdan turib bu tugmalarni bosishning foydasi yo'q** —
tartib doim shunday: sekretlar sozlanadi → funksiyalar deploy
qilinadi → admin panel tugmasi bosiladi → shundan keyingina botda
`/start` ishlay boshlaydi.

## 8. Telegram'da sinab ko'rish

- Asosiy botni to'g'ridan-to'g'ri (start_param'siz) ochsangiz —
  **sotuvchi** sifatida `/seller` panelga yo'naltirilishingiz kerak
- Do'kon havolasi orqali (`t.me/asosiy_bot?start=SOTUVCHI_ID`)
  ochsangiz — **mijoz** sifatida katalogni ko'rishingiz kerak
- Xodim va kuryer botlarida `/start` — mos web_app tugmasi chiqishi
  kerak

## 9. Lokal ishlab chiqish (development) buyruqlari

```bash
npm run dev              # frontend dev-server (Vite)
npm run build             # production build
npm run lint               # ESLint
npm run test                # frontend testlari (Vitest)

cd functions
npm install
npm test                    # backend testlari (Jest)
```

## ⚠️ Lokal test qilishda muhim eslatma

`npm run dev` bilan localhost'da ochganingizda, ilova Telegram'da
emasligini aniqlaydi va **haqiqiy autentifikatsiyasiz** ishlaydi
(zaxira test ID'lar bilan). Lekin Firestore Security Rules
`create`/`update` amallari uchun **haqiqiy** `request.auth` talab
qiladi — shuning uchun localhost'da **yozish amallari** (mahsulot
qo'shish, buyurtma berish va h.k.) ishlamaydi, faqat o'qish ishlaydi.

Buni to'liq lokal sinash uchun ikkita yo'l bor:

1. **Firebase Emulator Suite** (`firebase emulators:start`) — bu
   holda Auth/Firestore/Functions barchasi lokal simulyatsiya qilinadi
   va real tokensiz ham yozish ishlaydi. (Bu loyihada hozircha
   emulator konfiguratsiyasi alohida sozlanmagan.)
2. Yoki har safar Telegram (yoki Telegram Web) orqali ochib sinash —
   eng ishonchli yo'l, chunki productionga eng yaqin muhit.

---

## ⚠️ "INTERNAL" xatosi chiqsa (Kirishda xatolik yuz berdi)

Bu — Cloud Function ichida kutilmagan xato yuz berganini bildiradi.
Xavfsizlik uchun aniq sababi frontend'ga ko'rsatilmaydi. Sababni
bilish uchun:

```bash
firebase functions:log
```

yoki Firebase Console → Functions → funksiya nomi → Logs.

**Eng ko'p uchraydigan sabablar:**

1. **Firestore ma'lumotlar bazasi hali yaratilmagan.** Firebase
   Console → Firestore Database → agar "Create database" tugmasi
   ko'rinsa, demak baza hali yaratilmagan. **Native mode**da yarating
   (Datastore mode emas).

2. **Xizmat hisobida (service account) ruxsat yetishmayapti.**
   `admin.auth().createCustomToken()` ishlashi uchun Cloud Functions
   ishlatadigan xizmat hisobida **"Service Account Token Creator"**
   IAM roli bo'lishi kerak — standart holatda bu rol ko'pincha yo'q
   bo'ladi. Tuzatish:
   - Google Cloud Console → IAM & Admin → IAM
   - Ro'yxatdan `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
     (yoki `commerce-zelo@appspot.gserviceaccount.com`) hisobini
     toping
   - "Edit" (qalam belgisi) → "Add another role" → **"Service
     Account Token Creator"** ni qo'shing → Save

3. **Sekret (secret) sozlanmagan yoki noto'g'ri.** 3-bo'limdagi 8 ta
   sekretning barchasi sozlanganini tekshiring:
   ```bash
   firebase functions:secrets:access BOT_TOKEN
   ```
   (har bir sekret nomi bilan alohida tekshiring — qiymatning o'zi
   ko'rsatiladi, mavjud bo'lmasa xato beradi)

Shu sabablarni tekshirib, kerak bo'lsa tuzatgandan so'ng:

```bash
firebase deploy --only functions
```

qayta ishga tushiring.
