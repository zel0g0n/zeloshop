# Firestore zaxira nusxalash (backup) — sozlash yo'riqnomasi

**Nega kerak:** hozircha `commerce-zelo` loyihasida Firestore uchun avtomatik
zaxira nusxalash (backup) sozlanmagan. Agar kimdir (xato bilan yoki
niyatan) muhim ma'lumotni o'chirib yuborsa yoki buzsa — uni qaytarib
bo'lmaydi. Bu — 2026-09 auditida topilgan "o'rtacha darajadagi" xavf.

**Nega bu faylni MEN o'zim bajarolmayapman:** bu amal sizning haqiqiy
Google Cloud loyihangizga (`commerce-zelo`) administrator huquqi bilan
kirishni talab qiladi — menda bunday jonli (live) kirish yo'q. Shuning
uchun quyidagi buyruqlarni **siz o'zingiz**, terminal orqali (yoki
Google Cloud Console'da) bir marta bajarishingiz kerak. Bir marta
sozlangandan keyin, bu butunlay **avtomatik** ishlayveradi — hech qanday
qo'shimcha kod yoki funksiya yozish shart emas edi (Google Firestore'ning
tayyor, rasmiy funksiyasi — "Scheduled Backups").

---

## 1-qadam: tayyorgarlik

Kompyuteringizda [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
o'rnatilgan bo'lishi kerak. So'ng loyihani tanlang:

```sh
gcloud config set project commerce-zelo
```

---

## 2-qadam: kunlik (daily) zaxira jadvalini yaratish

```sh
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d
```

Bu — HAR KUNI avtomatik zaxira oladi, va har bir zaxira nusxasi **7 kun**
saqlanadi (shundan eski nusxalar avtomatik o'chadi). Xohlasangiz
`--retention` qiymatini oshirishingiz mumkin (masalan `14d`) — MUHIM:
maksimal ruxsat etilgan muddat **14 hafta** (`14w`).

---

## 3-qadam: haftalik (weekly) zaxira jadvalini yaratish (tavsiya etiladi)

Kunlik zaxiraga qo'shimcha, uzoqroq muddatga saqlanadigan haftalik nusxa
ham tavsiya etiladi (masalan, birov OYLAR o'tib bir xatoni payqasa):

```sh
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=weekly \
  --retention=8w \
  --day-of-week=SUN
```

**MUHIM CHEKLOV:** bitta Firestore ma'lumotlar bazasi uchun eng ko'pi
bilan **bitta kunlik va bitta haftalik** jadval yaratish mumkin — bundan
ortig'ini Google qabul qilmaydi.

---

## 4-qadam: tekshirish (jadvallar to'g'ri sozlanganini ko'rish)

```sh
gcloud firestore backups schedules list --database='(default)'
```

Buyruq ikkita jadvalni (`daily`, `weekly`) va ularning saqlash muddatini
ko'rsatishi kerak. Shu bilan bir qatorda, Firebase konsolida ham
tekshirishingiz mumkin: **Firebase Console → Firestore Database →
Backups** bo'limi.

---

## 5-qadam (faqat ZARURAT tug'ilganda): zaxiradan tiklash

Agar kelajakda ma'lumot buzilib, zaxiradan tiklash zarurati tug'ilsa
(bu — **YANGI, ALOHIDA ma'lumotlar bazasi** yaratadi, mavjudini ustidan
YOZIB YUBORMAYDI — shuning uchun xavfsiz):

```sh
gcloud firestore databases restore \
  --source-backup=projects/commerce-zelo/locations/LOCATION/backups/BACKUP_ID \
  --destination-database='tiklangan-nusxa'
```

`LOCATION` va `BACKUP_ID` qiymatlarini 4-qadamdagi `list` buyrug'i
natijasidan olasiz. Tiklangandan keyin, ma'lumotni tekshirib, kerak
bo'lsa qo'lda asosiy bazaga (`(default)`) ko'chirasiz — bu qasddan
qo'shimcha xavfsizlik qadami (tasodifan ustidan yozib yuborishning
oldini olish uchun).

---

## Xarajat haqida (ochiq, halol ma'lumot)

Google zaxira nusxalarni saqlash uchun alohida haq oladi (ma'lumot
hajmiga qarab, odatiy Firestore saqlash narxidan biroz farqli tarif
bo'yicha) — bu, ma'lumot yo'qolishi xavfidan ancha arzon, lekin **butunlay
BEPUL EMAS**. Aniq narxni loyihangizning joriy ma'lumot hajmiga qarab
[Google Cloud narxlar sahifasidan](https://cloud.google.com/firestore/pricing)
tekshirishingizni tavsiya qilaman.

---

## Nega maxsus kod yozilmadi

Firestore Admin API orqali qo'lda "export" qiladigan alohida Cloud
Function yozish ham mumkin edi, lekin bu — ortiqcha murakkablik
(qo'shimcha kod, qo'shimcha IAM ruxsatlari, qo'shimcha xatolik nuqtasi)
bo'lar edi. Google'ning yuqoridagi **tayyor, rasmiy** "Scheduled Backups"
xizmati aynan shu vazifa uchun yaratilgan — hech qanday ilova kodi talab
qilmaydi va Google tomonidan boshqariladi/kafolatlanadi. Shuning uchun
shu yo'l tanlandi.

---

**Manbalar:**
- [Firestore backup/restore rasmiy hujjati](https://docs.cloud.google.com/firestore/native/docs/backups)
- [Firestore narxlari](https://cloud.google.com/firestore/pricing)
