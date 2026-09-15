# CI/CD va Staging (sinov) muhiti — to'liq sozlash qo'llanmasi

**Nima uchun bu kerak edi:** hozirgacha har qanday o'zgarish
to'g'ridan-to'g'ri, HECH QANDAY avtomatik tekshiruvsiz, sizning
kompyuteringizdan JONLI production'ga (`commerce-zelo`) deploy
qilinardi. Testlarni ishga tushirish — faqat men (yoki siz) qo'lda
bajargan ish edi, avtomatik emas. Bu qo'llanma ikkita narsani hal
qiladi:

1. **CI (Continuous Integration)** — har bir o'zgarish `main`ga
   tushishidan OLDIN, GitHub avtomatik ravishda testlar+lint+build'ni
   ishga tushiradi. Xato bo'lsa — deploy UMUMAN boshlanmaydi.
2. **Staging (sinov) muhiti** — production'dan BUTUNLAY ALOHIDA,
   ikkinchi Firebase loyihasi. Yangi funksiyani avval shu yerda sinab
   ko'rasiz — xato chiqsa, haqiqiy mijozlarga HECH QANDAY ta'sir
   qilmaydi.

**Men (Claude) nimani qildim, nimani SIZ bajarishingiz kerak:**
Men — 4 ta GitHub Actions workflow faylini (`.github/workflows/*.yml`)
tayyorladim, ular sizning repo'ingizga tushgach avtomatik ishlaydi.
LEKIN quyidagilarni FAQAT siz o'zingiz qila olasiz (menda bu sandbox
ichidan sizning haqiqiy GitHub/Google Cloud hisobingizga jonli kirish
yo'q): GitHub repo yaratish, ikkinchi Firebase loyihasini yaratish,
xizmat hisoblari (service account) kalitlarini generatsiya qilish, va
ularni GitHub'ning "Secrets" bo'limiga qo'shish. Pastda — HAR BIR
qadam, buyruqma-buyruq.

---

## 0-qism: Loyihani Git'ga ulash (hozircha git repo UMUMAN yo'q)

Loyihada hali git tarixi yo'q. Avval buni sozlaymiz:

```bash
cd /yoli/loyihangizga   # masalan: cd C:\Users\SizningIsm\commerce-zelo

git init
git add .
git commit -m "Boshlang'ich commit"
```

So'ng [github.com](https://github.com)da **bo'sh** (README'siz) yangi
**PRIVATE** repozitoriy yarating (masalan `zeloshop`), va:

```bash
git remote add origin https://github.com/SIZNING_USERNAME/zeloshop.git
git branch -M main
git push -u origin main
```

Endi **`develop`** branch'ini ham yarating (staging shu branch'ga
push qilinganda ishlaydi):

```bash
git checkout -b develop
git push -u origin develop
```

**Branch strategiyasi (tavsiya etiladi):**
- `main` — HAR DOIM production holatida, faqat tasdiqlangan (CI
  o'tgan) o'zgarishlar shu yerga tushadi → **production**ga avtomatik
  deploy qilinadi.
- `develop` — ishlab chiqilayotgan/sinovdagi kod → **staging**ga
  avtomatik deploy qilinadi.
- Yangi funksiya uchun — `develop`dan yangi branch (`feature/...`)
  oching, tugagach `develop`ga Pull Request oching (CI avtomatik
  tekshiradi), birlashtiring (merge). Sinab ko'rilgach, `develop`dan
  `main`ga Pull Request — shu orqali production'ga chiqadi.

---

## 1-qism: Staging (sinov) Firebase loyihasini yaratish

1. [Firebase Console](https://console.firebase.google.com) → **Add
   project** → nom bering, masalan **`commerce-zelo-staging`**
   (aniq shu nomni eslab qoling — pastda kerak bo'ladi).
2. Loyiha ichida yoqing: **Firestore Database** (Native mode, xuddi
   production'dagidek), **Storage**, **Functions**, **Hosting**.
3. Terminalda:

   ```bash
   firebase use --add
   ```

   Yangi (staging) loyihani tanlang, alias sifatida `staging` deb
   nomlang. Bu `.firebaserc` faylingizga staging loyihasini
   qo'shadi (production alias — `default`, o'zgarishsiz qoladi).

4. **8 ta sekretni staging loyihasida ham sozlang** (production bilan
   BIR XIL ro'yxat — `DEPLOYMENT.md`ning 3-bo'limiga qarang, faqat
   endi `--project staging` bilan):

   ```bash
   firebase functions:secrets:set BOT_TOKEN --project staging
   firebase functions:secrets:set STAFF_BOT_TOKEN --project staging
   firebase functions:secrets:set COURIER_BOT_TOKEN --project staging
   firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET --project staging
   firebase functions:secrets:set STAFF_TELEGRAM_WEBHOOK_SECRET --project staging
   firebase functions:secrets:set COURIER_TELEGRAM_WEBHOOK_SECRET --project staging
   firebase functions:secrets:set GEMINI_API_KEY --project staging
   firebase functions:secrets:set SENTRY_DSN --project staging
   ```

   **Tavsiya:** `BOT_TOKEN`/`STAFF_BOT_TOKEN`/`COURIER_BOT_TOKEN` uchun
   production botlaringizdan **BUTUNLAY BOSHQA**, yangi test botlar
   yarating (@BotFather → `/newbot`, masalan `zeloshop_test_bot`) —
   aks holda staging'ni sinaganingizda HAQIQIY mijozlarga xabar ketib
   qolishi mumkin. `GEMINI_API_KEY` — xohlasangiz productiondagi bilan
   bir xil kalitni ishlatishingiz mumkin (Google AI Studio'da bepul
   kvota bor). `SENTRY_DSN` — yangi, alohida Sentry loyihasi
   yaratsangiz, staging xatolari production xatolaridan ARALASHMAY
   ko'rinadi (tavsiya etiladi, lekin majburiy emas — bo'sh
   qoldirsangiz ham deploy ishlaydi, xato kuzatuvi shunchaki o'chiq
   turadi).

5. Birinchi marta **qo'lda** deploy qilib, hammasi ishlashini
   tekshiring (keyingi safar bu avtomatik bo'ladi):

   ```bash
   cd functions && npm install && cd ..
   npm install && npm run build
   firebase deploy --project staging
   ```

---

## 2-qism: GitHub Actions uchun "kalit" (service account) yaratish

CI/CD sizning nomingizdan Firebase'ga deploy qilishi uchun, GitHub'ga
**xizmat hisobi (service account) kaliti** berish kerak — bu sizning
shaxsiy Google login parolingiz EMAS, faqat shu ANIQ vazifa uchun
maxsus, cheklangan "robot" hisob.

**Har ikkala loyiha (staging va production) uchun ALOHIDA-ALOHIDA
bajaring:**

1. [Google Cloud Console → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   ga o'ting, yuqorida loyihani tanlang (avval `commerce-zelo-staging`,
   keyin `commerce-zelo`).
2. **+ Create Service Account** → nom bering (masalan
   `github-actions-deployer`) → **Create and Continue**.
3. Quyidagi rollarni qo'shing (**Add another role** tugmasi bilan
   bittalab):
   - **Firebase Admin** (`roles/firebase.admin`)
   - **Cloud Build Service Account** (`roles/cloudbuild.builds.builder`)
   - **Service Account User** (`roles/iam.serviceAccountUser`)
   - **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`)
   - **Artifact Registry Administrator** (`roles/artifactregistry.admin`)
   - **Cloud Run Admin** (`roles/run.admin`) — 2-avlod (Gen2) Cloud
     Functions "kaputi ostida" Cloud Run sifatida ishga tushadi,
     shuning uchun bu rol ham kerak.

   > **Halol ogohlantirish:** men bu ro'yxatni Google'ning rasmiy
   > hujjatlari asosida tuzdim, lekin buni sizning HAQIQIY loyihangizga
   > qarshi bu sandbox ichida sinab ko'ra olmadim (live kirish yo'q).
   > Agar birinchi CI deploy urinishida "permission denied"/"missing
   > permission" xatosi chiqsa — bu ODATIY holat: xato xabarining
   > o'zi odatda ANIQ qaysi rol yetishmayotganini yozadi, o'shani
   > qo'shib, workflow'ni GitHub "Actions" bo'limidan qayta ishga
   > tushirsangiz kifoya (kodni qayta push qilish shart emas).

4. **Done**. Endi yaratilgan hisobni ro'yxatdan toping → **Keys**
   tab → **Add Key → Create new key → JSON** → yuklab oling. Bu fayl —
   **maxfiy**, hech kimga bermang, git'ga HECH QACHON qo'shmang.

---

## 3-qism: GitHub repo'ga sekretlarni qo'shish

GitHub repo sahifangizda: **Settings → Secrets and variables →
Actions**.

**"Secrets" tab'ida** (yashiringan qiymatlar) — **New repository
secret**:

| Nomi | Qiymati |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | 2-qismda staging uchun yuklab olingan JSON faylning **TO'LIQ matni** (faylni ochib, hammasini nusxalab joylashtiring) |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Xuddi shunday, lekin production uchun yaratilgan JSON |

**"Variables" tab'ida** (yashirilmagan, oddiy matn) — **New repository
variable**:

| Nomi | Qiymati |
|---|---|
| `STAGING_FIREBASE_PROJECT_ID` | staging loyihangizning ANIQ ID'si (masalan `commerce-zelo-staging`) |

(Production loyiha ID'si — `commerce-zelo` — workflow faylining ichida
to'g'ridan-to'g'ri yozilgan, chunki u allaqachon ochiq ma'lum, alohida
sozlash shart emas.)

---

## 4-qism: `main`ni himoyalash (branch protection) — TAVSIYA ETILADI

Bu qadam bo'lmasa ham workflow'lar ishlayveradi, lekin bu qadam
BO'LMASA — hech kim (siz ham) `main`ga to'g'ridan-to'g'ri, testsiz
push qilib qo'yishning oldi olinmaydi. Sozlash:

1. GitHub repo → **Settings → Branches → Add branch ruleset** (yoki
   eski interfeysda "Add rule").
2. Branch nomi: `main`.
3. Yoqing: **Require a pull request before merging**, **Require
   status checks to pass before merging** → qidiruvda CI
   workflow'ining tekshiruvlarini tanlang (`tests / frontend`,
   `tests / backend` kabi nomlar bilan ko'rinadi — birinchi CI
   ishga tushgandan keyin ro'yxatda paydo bo'ladi).
4. Xohlasangiz, xuddi shu qoidani `develop` uchun ham qo'shing.

---

## 5-qism: Bularning hammasi qanday ishlaydi (yakuniy oqim)

```
Siz "feature/yangi-narsa" branch'ida ishlaysiz
        │
        ▼
   Pull Request → develop        ← CI (lint+test+build) AVTOMATIK ishga tushadi
        │  (CI yashil bo'lsa) merge
        ▼
   develop branch'ga push        ← testlar QAYTA tekshiriladi → STAGING'ga avtomatik deploy
        │
        ▼   (staging'da qo'lda sinab ko'rasiz - haqiqiy Telegram test-bot orqali)
        │
   Pull Request → main            ← CI yana ishga tushadi
        │  (CI yashil bo'lsa) merge
        ▼
   main branch'ga push            ← testlar QAYTA tekshiriladi → PRODUCTION'ga avtomatik deploy
```

Har bir bosqichda — agar test/lint/build XATO bersa, keyingi qadam
(deploy) **UMUMAN boshlanmaydi**. Bu — aynan siz so'ragan narsa:
"har qanday o'zgarish avtomatik tekshiruvsiz jonli production'ga
tushmasligi" kerak edi.

---

## 6-qism: Birinchi marta ishga tushirishda nimalarga tayyor turish

- Birinchi `develop`/`main` push'idan keyin GitHub'ning **Actions**
  tab'ida workflow bajarilishini KUZATIB TURING — birinchi urinishda
  IAM ruxsat xatosi chiqishi ODATIY (2-qismdagi ogohlantirishga
  qarang).
- `firebase deploy` birinchi marta yangi composite index'lar bo'lsa,
  "building" holatida biroz kutishi mumkin — bu xato emas.
- Staging'dagi test-botlaringiz production botlaridan ALOHIDA
  ekanini yana bir bor tekshiring (1-qism) — aks holda sinovlaringiz
  haqiqiy mijozlarga ko'rinishi mumkin.

---

**Manbalar:**
- [google-github-actions/auth (GitHub Actions'dan Google Cloud'ga ulanish)](https://github.com/google-github-actions/auth)
- [Firebase Hosting — GitHub integratsiyasi (rasmiy)](https://firebase.google.com/docs/hosting/github-integration)
- [Cloud Build orqali Firebase'ga deploy qilish uchun kerakli rollar (rasmiy)](https://docs.cloud.google.com/build/docs/deploying-builds/deploy-firebase)
