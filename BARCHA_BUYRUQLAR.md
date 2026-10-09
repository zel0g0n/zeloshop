# ZeloShop — barcha zarur buyruqlar (konsolidatsiyalangan)

Bu fayl loyiha bo'yicha kerak bo'ladigan BARCHA terminal buyruqlarini bir joyga jamlaydi — hammasi Windows'da Git Bash orqali ishga tushiriladi. Har bir bo'lim qachon kerakligini ko'rsatadi: **[BIR MARTA]** — faqat birinchi sozlashda, **[HAR DEPLOY'DA]** — kod o'zgargan sari, **[KERAK BO'LGANDA]** — vaziyatga qarab.

Batafsil tushuntirishlar alohida fayllarda: `CI_CD_VA_STAGING_SOZLASH.md` (GitHub/CI-CD), `FIRESTORE_BACKUP_SOZLASH.md` (zaxira nusxa).

> **Muhim (2026-10):** ATMOS to'lov shlyuzi loyihadan butunlay olib tashlandi. Platformada pul aylanmasi yo'q:
> - tarif to'lovi — sotuvchi ZeloShop kartasiga o'tkazadi, chek rasmini yuklaydi, admin tasdiqlaydi;
> - do'kondagi "karta" to'lovi — mijoz sotuvchining o'z kartasiga o'tkazadi va chek yuboradi;
> - Yandex Delivery — har bir sotuvchi o'z tokenini ulaydi va yetkazib berish haqini o'zi to'laydi.
>
> Shuning uchun ATMOS sekretlari, proksi-VM va `ATMOS_*` sozlamalari endi KERAK EMAS (pastda 11-bo'limga qarang).

---

## 1. Loyihani birinchi marta sozlash **[BIR MARTA]**

```bash
# Loyiha papkasiga kirib, frontend paketlarini o'rnatish
npm install

# Backend (Cloud Functions) paketlarini o'rnatish
cd functions
npm install
cd ..

# Firebase CLI o'rnatilmagan bo'lsa
npm install -g firebase-tools

# Firebase hisobingizga kirish (brauzer ochiladi)
firebase login

# Qaysi Firebase loyihasi bilan ishlashni tanlash
firebase use commerce-zelo
```

Node.js 20 kerak (`functions/package.json` da `"node": "20"`).

---

## 2. Maxfiy kalitlar (secrets) — birinchi sozlash yoki yangilash **[BIR MARTA / KERAK BO'LGANDA]**

Har birini alohida ishga tushiring — terminal qiymatni so'raydi, uni yozib Enter bosing (ekranda ko'rinmaydi, bu normal).

### Telegram botlar
```bash
firebase functions:secrets:set BOT_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set COURIER_BOT_TOKEN
firebase functions:secrets:set COURIER_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set STAFF_BOT_TOKEN
firebase functions:secrets:set STAFF_TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set CUSTOM_BOT_WEBHOOK_SECRET
```

### AI (Gemini)
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

### Xato kuzatuvi (Sentry)
```bash
firebase functions:secrets:set SENTRY_DSN
```

### Sozlangan sekretlarni ko'rish
```bash
firebase functions:secrets:access BOT_TOKEN
```

---

## 3. Oddiy sozlamalar (maxfiy emas) **[KERAK BO'LGANDA]**

Maxfiy bo'lmagan qiymatlar `functions/.env.commerce-zelo` faylida oddiy qator sifatida yoziladi (kodda ishlatiladiganlari):

```
COURIER_BOT_USERNAME=<kuryer_bot_username>
STAFF_BOT_USERNAME=<xodim_bot_username>
```

Frontend uchun ochiq qiymatlar (Sentry manzili va h.k.) ildizdagi `.env` faylida turadi. `.env` fayllar `.gitignore` da — repo'ga tushmaydi.

---

## 4. Deploy qilish **[HAR DEPLOY'DA]**

### Hammasini birdan (odatiy holat)
```bash
npm run build
firebase deploy
```

### Faqat Cloud Functions
```bash
firebase deploy --only functions
```

### Faqat bitta funksiya (tezroq, kichik tuzatishda)
```bash
firebase deploy --only functions:dispatchYandexDelivery
```

### Faqat frontend (Hosting)
```bash
npm run build
firebase deploy --only hosting
```

### Faqat Firestore xavfsizlik qoidalari va indexlar
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Faqat Storage qoidalari
```bash
firebase deploy --only storage
```

---

## 5. Test, lint, build — deploy'dan OLDIN tekshirish **[HAR DEPLOY'DA TAVSIYA]**

```bash
# Frontend
npm run lint
npm run test
npm run build

# Backend (functions papkasidan)
cd functions
npm test
cd ..
```

Joriy holat: frontend testlari 713 ta, backend testlari 1555 ta (85 to'plam) o'tadi. `npm run lint` da 11 ta eski xato bor (react-refresh qoidasi: contexts, AiCeoInfoPage, ProductDraftReview) — ular yangi o'zgarishlarga bog'liq emas.

---

## 6. Firestore zaxira nusxa (backup) **[BIR MARTA sozlash]**

```bash
# Kunlik zaxira (7 kun saqlanadi)
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project=commerce-zelo

# Haftalik zaxira (8 hafta saqlanadi, yakshanba kuni)
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=weekly \
  --day-of-week=SUN \
  --retention=8w \
  --project=commerce-zelo

# Mavjud zaxira jadvallarini ko'rish
gcloud firestore backups schedules list --database='(default)' --project=commerce-zelo

# Mavjud zaxiralarni ko'rish
gcloud firestore backups list --project=commerce-zelo
```

---

## 7. Git / GitHub / CI-CD — asosiylari **[BIR MARTA / KUNDALIK]**

To'liq jarayon `CI_CD_VA_STAGING_SOZLASH.md`da. Eng ko'p ishlatiladiganlari:

```bash
# O'zgarishlarni ko'rish
git status
git diff

# Yangi branch ochib, o'zgarish qilish
git checkout -b feature/nom
git add .
git commit -m "tavsif"
git push -u origin feature/nom
# (keyin GitHub'da Pull Request oching → develop'ga)

# develop'dan main'ga chiqarish (production'ga deploy uchun)
git checkout main
git pull
git merge develop
git push
```

---

## 8. Kuzatuv va diagnostika **[KERAK BO'LGANDA]**

```bash
# Cloud Functions loglarini ko'rish (jonli)
firebase functions:log

# Muayyan funksiya logi
firebase functions:log --only dispatchYandexDelivery

# Lokal test muhiti (emulator)
firebase emulators:start

# Lokal frontend (dev server)
npm run dev

# Qaysi Firebase loyihasi faol ekanini tekshirish
firebase use
```

---

## 9. Veb kirish (brauzerda login/parol bilan) **[BIR MARTA deploy]**

Sotuvchi paneli Telegramsiz, oddiy brauzerda (kompyuter/telefon) ham ochiladi. Kirish uchun sotuvchi zeloshop_bot'dagi **"Veb login/parol"** tugmasini bosadi va kelgan login+parol bilan saytga kiradi. Veb parol sessiyasi hech qachon admin huquqini olmaydi.

```bash
cd functions && npm install && cd ..
firebase deploy --only functions:webAppLogin,functions:getWebSession,functions:telegramCallbackWebhook
firebase deploy --only firestore:rules,storage

npm run build
firebase deploy --only hosting
```
> Agar oldin `mobileAppLogin` deploy qilingan bo'lsa, uni olib tashlang: `firebase functions:delete mobileAppLogin --region asia-south1`

---

## 10. Tarif to'lovi (qo'lda, chek orqali) **[sozlash]**

Sotuvchi tariflar sahifasida "To'lash" tugmasini bosadi, ZeloShop kartasiga o'tkazadi va chek rasmini yuklaydi. Admin panelda chekni ko'rib tasdiqlaydi (`reviewManualTariffPayment`) — tarif shu zahoti faollashadi.

Tugma faqat admin karta ma'lumotlarini kiritgan bo'lsa ko'rinadi. Ma'lumot Firestore'da `settings/manualTariffPayment` hujjatida turadi (admin panelidan kiritiladi).

Tarif haqida eslatmalar (muddat tugashi arafasida) `sendTariffPaymentReminders` rejalashtirilgan funksiyasi orqali yuboriladi. To'lov holatini `getTariffPaymentStatus` qaytaradi.

> Firestore kolleksiyasi nomi `atmosPayments` ataylab o'zgartirilmagan — qo'lda to'lovlar ham shu yerda (`method: "manual"`, `status: "pending_review"`) saqlanadi; mavjud ma'lumotlar, qoidalar va indekslar shunga bog'liq.

---

## 11. ATMOS qoldiqlarini tozalash **[BIR MARTA, ATMOS olib tashlangandan keyin]**

Kod papkasidan o'chirilishi kerak bo'lgan fayllar (loyiha ZIP'ida allaqachon yo'q, lekin eski papkangizda qolgan bo'lsa o'chiring):

```bash
rm -f functions/atmosPayments.js functions/atmosProxyTest.js
rm -f functions/lib/atmosClient.js atmos-secure-proxy-server.js
rm -f functions/__tests__/atmosPayments.test.js functions/__tests__/atmosProxyTest.test.js
rm -f functions/__tests__/lib/atmosClient.test.js
rm -f src/services/tariffs/createTariffPayment.js

cd functions && npm install && cd ..    # undici endi kerak emas
```

Keyin deploy qiling; Firebase endi kodda yo'q eski funksiyalarni (`createTariffPayment`, `atmosPaymentCallback`, `testAtmos*` va h.k.) o'chirishni so'raydi — tasdiqlang (`y`):

```bash
npm run build
firebase deploy --only functions,hosting,firestore:rules,storage
```

Ishlatilmay qolgan ATMOS sekretlarini ham o'chirib tashlash mumkin (ixtiyoriy):

```bash
firebase functions:secrets:destroy ATMOS_CONSUMER_KEY
firebase functions:secrets:destroy ATMOS_CONSUMER_SECRET
firebase functions:secrets:destroy ATMOS_STORE_ID
firebase functions:secrets:destroy ATMOS_API_KEY
firebase functions:secrets:destroy ATMOS_PROXY_TOKEN
```

Va `functions/.env.commerce-zelo` ichidagi `ATMOS_ENV` / `ATMOS_PROXY_URL` qatorlarini o'chiring. GCP'dagi statik-IP proksi VM'ini (`35.211.129.224`) hamda `allow-atmos-proxy` firewall qoidasini ham o'chirsangiz bo'ladi (pul to'lanmasligi uchun).

---

## 12. Yandex Delivery **[ma'lumot]**

- Sotuvchi sozlamalarda "Yandex Delivery ulash" bo'limida O'Z tokenini kiritadi. Token `sellers/{id}/private/yandexDelivery` da saqlanadi; yetkazib berish haqini sotuvchining o'z hisobi to'laydi.
- "Yandex orqali yuborish" tugmasi buyurtma "jarayonda" holatida, mijoz lokatsiyasi bor, kuryer biriktirilmagan va Yandex da'vosi hali yaratilmagan bo'lsa ko'rinadi.
- Xodimlar ham (kuryerlarni boshqarish huquqi bo'lsa) yuborishi mumkin; server `dispatchYandexDelivery` da huquqni tekshiradi.
- Platforma darajasidagi yoqish/yashirish: `src/config/platformFlags.js` → `YANDEX_DISPATCH_VISIBLE`.

---

## Qisqa eslatma — qaysi buyruq qachon kerak

| Vaziyat | Buyruq |
|---|---|
| Yangi kod yozdim, productionga chiqaraman | `npm run build && firebase deploy` |
| Faqat bitta funksiyani tuzatdim | `firebase deploy --only functions:funksiyaNomi` |
| Firestore qoidasini o'zgartirdim | `firebase deploy --only firestore:rules` |
| Yangi maxfiy kalit qo'shdim | `firebase functions:secrets:set NOM` so'ng `firebase deploy --only functions` |
| Xatoni tekshirmoqchiman | `firebase functions:log` |
| Eski funksiyani o'chirmoqchiman | `firebase functions:delete funksiyaNomi --region asia-south1` |
| Deploy'dan oldin hammasini tekshirish | `npm run lint && npm test && npm run build && (cd functions && npm test)` |
