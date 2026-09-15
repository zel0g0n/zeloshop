# ZeloShop — barcha zarur buyruqlar (konsolidatsiyalangan)

Bu fayl loyiha bo'yicha kerak bo'ladigan BARCHA terminal buyruqlarini bir joyga jamlaydi — hammasi Windows'da Git Bash orqali ishga tushiriladi. Har bir bo'lim qachon kerakligini ko'rsatadi: **[BIR MARTA]** — faqat birinchi sozlashda, **[HAR DEPLOY'DA]** — kod o'zgargan sar safar, **[KERAK BO'LGANDA]** — vaziyatga qarab.

Batafsil tushuntirishlar alohida fayllarda: `CI_CD_VA_STAGING_SOZLASH.md` (GitHub/CI-CD), `FIRESTORE_BACKUP_SOZLASH.md` (zaxira nusxa).

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

### ATMOS to'lov shlyuzi (4 ta + yangi proksi tokeni)
```bash
firebase functions:secrets:set ATMOS_CONSUMER_KEY
firebase functions:secrets:set ATMOS_CONSUMER_SECRET
firebase functions:secrets:set ATMOS_STORE_ID
firebase functions:secrets:set ATMOS_API_KEY
firebase functions:secrets:set ATMOS_PROXY_TOKEN
```
> `ATMOS_PROXY_TOKEN` — VM'dagi `atmos-secure-proxy-server.js`ni ishga tushirganda bergan `PROXY_AUTH_TOKEN` bilan **AYNAN BIR XIL** qiymat bo'lishi shart.

### Qaysi sekretlar sozlanganini ko'rish
```bash
firebase functions:secrets:access ATMOS_CONSUMER_KEY
firebase functions:secrets:list
```

---

## 3. Oddiy sozlamalar (maxfiy emas) **[BIR MARTA / KERAK BO'LGANDA]**

Bular `firebase functions:secrets:set` bilan EMAS — `functions/.env.commerce-zelo` faylida oddiy qator sifatida yoziladi:

```
ATMOS_ENV=production
ATMOS_PROXY_URL=http://35.211.129.224:3128
```

> Sandbox rejimida sinash uchun `ATMOS_ENV=sandbox` qiling. Statik-IP proksi hali sozlanmagan bo'lsa, `ATMOS_PROXY_URL` qatorini butunlay o'chirib qo'ying (yoki bo'sh qoldiring) — kod avtomatik to'g'ridan-to'g'ri ishlaydi.

---

## 4. Deploy qilish **[HAR DEPLOY'DA]**

### Hammasini birdan (odatiy holat)
```bash
firebase deploy
```

### Faqat Cloud Functions
```bash
firebase deploy --only functions
```

### Faqat bitta funksiya (tezroq, kichik tuzatishda)
```bash
firebase deploy --only functions:createTariffPayment
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

---

## 6. Statik-IP proksi — VM tomonidagi sozlash **[BIR MARTA / YANGILAGANDA]**

GCP konsolida VM'ning "SSH" tugmasi orqali brauzerda terminal oching, so'ng:

```bash
# 1) Eski (faqat /whoami) test-serverni to'xtatish
pkill -f test-server.js

# 2) Kuchli, tasodifiy token yaratish (buni saqlab qo'ying — Firebase'ga ham shu qiymatni kiritasiz)
openssl rand -hex 32

# 3) atmos-secure-proxy-server.js faylini VM'ga joylashtirish
nano atmos-secure-proxy-server.js
# (kodni joylashtiring: Ctrl+Shift+V yoki o'ng tugma → Paste)
# Saqlash: Ctrl+O → Enter → Ctrl+X

# 4) Serverni ishga tushirish (2-qadamdagi tokenni shu yerga qo'ying)
PROXY_AUTH_TOKEN="<2-qadamdagi_token>" nohup node atmos-secure-proxy-server.js > proxy.log 2>&1 &

# Tekshirish
curl http://localhost:3128/whoami
cat proxy.log
```

### Firewall (agar 3128-port hali ochilmagan bo'lsa)
GCP konsoli → VPC network → Firewall → "Create Firewall Rule":
- Name: `allow-atmos-proxy`
- Targets: All instances in the network
- Source IPv4 ranges: `0.0.0.0/0`
- Protocols/ports: TCP, port `3128`

### Tashqi tomondan tekshirish (brauzerda yoki terminalda)
```bash
curl http://35.211.129.224:3128/whoami
```

---

## 7. Firestore zaxira nusxa (backup) **[BIR MARTA sozlash]**

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

## 8. Git / GitHub / CI-CD — asosiylari **[BIR MARTA / KUNDALIK]**

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

## 9. Kuzatuv va diagnostika **[KERAK BO'LGANDA]**

```bash
# Cloud Functions loglarini ko'rish (jonli)
firebase functions:log

# Muayyan funksiya logi
firebase functions:log --only createTariffPayment

# Lokal test muhiti (emulator)
firebase emulators:start

# Qaysi Firebase loyihasi faol ekanini tekshirish
firebase use
```

---

## Qisqa eslatma — qaysi buyruq qachon kerak

| Vaziyat | Buyruq |
|---|---|
| Yangi kod yozdim, productionga chiqaraman | `npm run build && firebase deploy` |
| Faqat bitta funksiyani tuzatdim | `firebase deploy --only functions:funksiyaNomi` |
| Firestore qoidasini o'zgartirdim | `firebase deploy --only firestore:rules` |
| Yangi maxfiy kalit qo'shdim | `firebase functions:secrets:set NOM` so'ng `firebase deploy --only functions` |
| Xatoni tekshirmoqchiman | `firebase functions:log` |
| Atmos productionga o'tdi (haqiqiy kalit keldi) | 5 ta `ATMOS_*` sekretni qayta `secrets:set` qiling, `ATMOS_ENV=production` qiling, `firebase deploy --only functions` |
