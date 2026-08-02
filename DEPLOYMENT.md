# Telegram autentifikatsiyasini joylashtirish (deploy) qo'llanmasi

## ⚠️ "INTERNAL" xatosi chiqsa (Kirishda xatolik yuz berdi)

Bu — Cloud Function ichida kutilmagan xato yuz berganini bildiradi.
Xavfsizlik uchun aniq sababi frontend'ga ko'rsatilmaydi. Sababni bilish
uchun:

```bash
firebase functions:log
```

yoki Firebase Console → Functions → `verifyTelegramAuth` → Logs.

**Eng ko'p uchraydigan ikkita sabab:**

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
     (yoki `commerce-zelo@appspot.gserviceaccount.com`) hisobini toping
   - "Edit" (qalam belgisi) → "Add another role" → **"Service Account
     Token Creator"** ni qo'shing → Save

Shu ikkalasini tekshirib, kerak bo'lsa tuzatgandan so'ng:

```bash
firebase deploy --only functions
```

qayta ishga tushiring.

## Tezkor xulosa — to'liq buyruqlar ketma-ketligi

```bash
npm install -g firebase-tools
firebase login
firebase use commerce-zelo

firebase functions:secrets:set BOT_TOKEN
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes

npm install
npm run build
firebase deploy --only hosting
```

Keyin BotFather'da Mini App URL'ini shu hosting havolasiga sozlang
(7-bo'lim). Har bir qadam haqida batafsil tushuntirish pastda.

Bu qism `functions/`, `firestore.rules`, `firestore.indexes.json` va
yangilangan `SessionContext.jsx` bilan bog'liq. Men bu kodni **sizning
haqiqiy Firebase loyihangizga (`commerce-zelo`) ulanmasdan** yozdim —
ya'ni hech qanday buyruqni o'zim ishga tushirib sinab ko'ra olmadim.
Quyidagi qadamlarni siz o'zingiz bajarishingiz kerak.

## 1. Firebase CLI o'rnatish (agar hali yo'q bo'lsa)

```bash
npm install -g firebase-tools
firebase login
```

## 2. Loyihani ulash

Loyiha papkasi ildizida (`New folder/` ichida, `package.json` yonida):

```bash
firebase use commerce-zelo
```

(`.firebaserc` fayli allaqachon shu loyiha ID'siga sozlangan.)

## 3. Bot tokenini xavfsiz saqlash

**Hech qachon** tokenni kodga yozmang. Terminalda:

```bash
firebase functions:secrets:set BOT_TOKEN
```

So'ralganda, BotFather sizga bergan tokenni kiriting (masalan
`123456789:AAExample-Token`).

## 4. Cloud Function'ni deploy qilish

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Deploy tugagach, terminalda funksiya URL'i ko'rinadi — bu shart emas,
chunki frontend uni to'g'ridan-to'g'ri (callable SDK orqali) chaqiradi.

## 5. Firestore qoidalari va index'larni deploy qilish

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 6. Frontend'ni build qilish va Firebase Hosting'ga joylashtirish

```bash
npm install
npm run build
firebase deploy --only hosting
```

Deploy tugagach, terminalda sizga https havola beriladi — odatda
`https://commerce-zelo.web.app` yoki `https://commerce-zelo.firebaseapp.com`
ko'rinishida. Shu havola — Mini App URL'ingiz.

## 7. BotFather'da Mini App URL'ini sozlash

@BotFather → botingiz → **Bot Settings → Menu Button** (yoki
`/newapp`) → 6-qadamda joylashtirgan https havolangizni kiriting.

## 8. Telegram'da sinab ko'rish

- Botni oching → agar to'g'ridan-to'g'ri (start_param'siz) ochsangiz —
  siz **sotuvchi** sifatida `/seller` panelga yo'naltirilishingiz kerak
- Do'kon havolasi orqali (`t.me/sizning_bot?start=SOTUVCHI_ID`)
  ochsangiz — **mijoz** sifatida katalogni ko'rishingiz kerak

## ⚠️ Lokal test qilishda muhim eslatma

`npm run dev` bilan localhost'da ochganingizda, ilova Telegram'da
emasligini aniqlaydi va **haqiqiy autentifikatsiyasiz** ishlaydi (avval
qo'shilgan zaxira ID'lar bilan). Lekin endi Firestore Security Rules
yozish (`create`/`update`) uchun **haqiqiy** `request.auth` talab qiladi
— shuning uchun localhost'da **yozish amallari** (mahsulot qo'shish,
buyurtma berish va h.k.) endi ishlamaydi, faqat o'qish ishlaydi.

Buni to'liq lokal sinash uchun ikkita yo'l bor:
1. **Firebase Emulator Suite** ishlatish (`firebase emulators:start`) —
   bu holda Auth/Firestore/Functions barchasi lokal simulyatsiya qilinadi
   va real tokensiz ham yozish ishlaydi.
2. Yoki har safar Telegram (yoki Telegram Web) orqali ochib sinash.

Men hozircha Emulator Suite konfiguratsiyasini alohida sozlamadim —
xohlasangiz keyingi bosqichda shuni ham qo'shib beraman.
