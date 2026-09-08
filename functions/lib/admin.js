const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

// MUHIM: bu modul faqat BIR MARTA ishga tushadi (Node'ning require
// keshi tufayli) — boshqa fayllar buni necha marta import qilishidan
// qat'i nazar, `admin.initializeApp()` faqat bir marta chaqiriladi.
admin.initializeApp();
const db = admin.firestore();

// Bot tokenini Cloud Functions "secret" sifatida saqlaymiz — kodda,
// .env faylida yoki Git'da HECH QACHON ko'rinmaydi. Terminalda:
//   firebase functions:secrets:set BOT_TOKEN
const BOT_TOKEN = defineSecret("BOT_TOKEN");

// Gemini (Google AI Studio) kaliti — https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// AI CEO — Telegram orqali "1-tugmali tasdiqlash" (`telegramApproval.js`)
// uchun: Telegram'ga `setWebhook` chaqirilganda shu qiymat
// `secret_token` sifatida beriladi, va HAR BIR kiruvchi webhook
// so'rovida `X-Telegram-Bot-Api-Secret-Token` sarlavhasi shu bilan
// solishtiriladi — shu orqali, HAQIQATAN Telegram'dan (bizning
// tokenimizni bilgan) kelayotgan so'rovларгина qabul qilinadi,
// boshqa hech kim `onRequest` manzilini soxta so'rov bilan
// "chaqirolmaydi". Terminalda: firebase functions:secrets:set
// TELEGRAM_WEBHOOK_SECRET (istalgan uzun, tasodifiy qator).
const TELEGRAM_WEBHOOK_SECRET = defineSecret("TELEGRAM_WEBHOOK_SECRET");

// KURYER BOTI (v39) — foydalanuvchi ATAYLAB, platformaning asosiy
// botidan (BOT_TOKEN) MUSTAQIL, BUTUNLAY ALOHIDA Telegram bot
// ochgan ("zeloshop_kuryer_bot") — barcha sotuvchilarning barcha
// kuryerlari SHU BITTA botdan foydalanadi (har bir sotuvchi uchun
// alohida bot EMAS — xuddi asosiy platforma boti kabi, `customBot.js`
// dagi sotuvchining SHAXSIY boti bilan ADASHTIRMASLIK kerak).
// Terminalda: firebase functions:secrets:set COURIER_BOT_TOKEN
const COURIER_BOT_TOKEN = defineSecret("COURIER_BOT_TOKEN");

// Kuryer boti UCHUN alohida webhook maxfiy kaliti — Telegram HAR BIR
// bot uchun FAQAT BITTA webhook manzilini qo'llab-quvvatlaydi, shuning
// uchun bu ASOSIY botning `TELEGRAM_WEBHOOK_SECRET`idan MUSTAQIL,
// ALOHIDA qiymat bo'lishi SHART. Terminalda: firebase functions:secrets:set
// COURIER_TELEGRAM_WEBHOOK_SECRET (istalgan uzun, tasodifiy qator).
const COURIER_TELEGRAM_WEBHOOK_SECRET = defineSecret("COURIER_TELEGRAM_WEBHOOK_SECRET");

// XODIM (STAFF) BOTI — "Xodimlar" funksiyasi (ZeloShop TOP 15 doirasidan
// TASHQARI, alohida so'ralgan qism) uchun, KURYER BOTI bilan AYNAN BIR
// XIL arxitektura qarori: foydalanuvchi (loyiha egasi) ATAYLAB, asosiy
// platforma botidan (BOT_TOKEN) MUSTAQIL, BUTUNLAY ALOHIDA Telegram bot
// ochadi — barcha sotuvchilarning barcha xodimlari SHU BITTA botdan
// foydalanadi (har bir sotuvchi uchun alohida bot EMAS — xuddi kuryer
// boti kabi, `customBot.js`dagi sotuvchining SHAXSIY boti bilan
// ADASHTIRMASLIK kerak). MUHIM: bu qiymat BotFather'da haqiqiy bot
// yaratilgach, terminalda o'rnatiladi: firebase functions:secrets:set
// STAFF_BOT_TOKEN — botning HAQIQIY username'i esa `functions/staff.js`
// dagi `STAFF_BOT_USERNAME` konstantasida qo'lda yangilanishi kerak.
const STAFF_BOT_TOKEN = defineSecret("STAFF_BOT_TOKEN");

// Xodim boti UCHUN alohida webhook maxfiy kaliti — Telegram HAR BIR bot
// uchun FAQAT BITTA webhook manzilini qo'llab-quvvatlaydi, shuning uchun
// bu boshqa botlarning maxfiy kalitlaridan MUSTAQIL, ALOHIDA qiymat
// bo'lishi SHART. Terminalda: firebase functions:secrets:set
// STAFF_TELEGRAM_WEBHOOK_SECRET (istalgan uzun, tasodifiy qator).
const STAFF_TELEGRAM_WEBHOOK_SECRET = defineSecret("STAFF_TELEGRAM_WEBHOOK_SECRET");

// SOTUVCHINING SHAXSIY BOTI UCHUN UMUMIY WEBHOOK MAXFIY KALITI (2026-09,
// sotuvchi so'roviga ko'ra qo'shildi — "Sotib olish" tugmasi sellerning
// O'ZINING boti orqali ochilishi uchun).
//
// MUHIM FARQ (kuryer/xodim botidan): kuryer va xodim boti — HAR
// IKKALASI HAM bitta, umumiy, doimiy bot (`COURIER_BOT_TOKEN`/
// `STAFF_BOT_TOKEN`) — barcha sotuvchilar SHU BITTA botdan
// foydalanadi. Sotuvchining shaxsiy boti esa HAR BIR SOTUVCHI uchun
// BOSHQA-BOSHQA, sotuvchining o'zi BotFather orqali yaratgan, token
// saqlangan bot (`customBot.js`) — shuning uchun bitta doimiy
// `defineSecret` o'rniga, webhook manzili o'ziga `sellerId`ni URL
// yo'lida oladi (`/customBotWebhook/{sellerId}`) va HAR BIR
// sotuvchining boti `connectCustomBot` chaqirilganda AVTOMATIK shu
// BITTA (umumiy) maxfiy `secret_token` bilan ro'yxatdan o'tkaziladi —
// bitta qiymatni barcha sotuvchi botlari uchun QAYTA ishlatish
// xavfsiz (Telegram bu qiymatni HAR bir botga alohida ro'yxatga
// oladi va har safar o'zi orqali kelgan so'rovda AYNAN shuni
// qaytaradi — soxta so'rov yubormoqchi bo'lgan har qanday kishi bu
// qiymatni bilishi SHART, aks holda 401 bilan rad etiladi). Terminalda:
// firebase functions:secrets:set CUSTOM_BOT_WEBHOOK_SECRET (istalgan
// uzun, tasodifiy qator).
const CUSTOM_BOT_WEBHOOK_SECRET = defineSecret("CUSTOM_BOT_WEBHOOK_SECRET");

module.exports = {
  admin, db, BOT_TOKEN, GEMINI_API_KEY, TELEGRAM_WEBHOOK_SECRET,
  COURIER_BOT_TOKEN, COURIER_TELEGRAM_WEBHOOK_SECRET,
  STAFF_BOT_TOKEN, STAFF_TELEGRAM_WEBHOOK_SECRET,
  CUSTOM_BOT_WEBHOOK_SECRET,
};
