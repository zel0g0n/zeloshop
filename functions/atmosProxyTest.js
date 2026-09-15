const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI — ATMOS uchun tayyorlangan
 * statik-IP proksi-server (GCP e2-micro VM, IP: 35.211.129.224,
 * "atmos-static-ip" nomi bilan reserve qilingan) ishlab turganini va
 * Cloud Function undan haqiqatan ham shu STATIK IP orqali chiqayotganini
 * tasdiqlash uchun.
 *
 * TARIX (2026-09 tuzatish): bu fayl bir marta — faqat Atmos'ning
 * OMMAVIY texnik hujjatiga asoslanib ("statik IP shart emas" degan,
 * NOTO'G'RI chiqqan xulosa bilan) — xato ravishda o'chirilgan edi.
 * Aslida Atmos (haqiqiy yozishmada) sotuvchidan aniq statik IP'ni
 * whitelist qilish uchun so'ragan, va bu VM+IP infratuzilmasi
 * ALLAQACHON qurilib, tashqi tomondan ham (brauzerdan
 * `http://35.211.129.224:8080/whoami`) tasdiqlangan edi. Shuning
 * uchun bu fayl qayta tiklandi — ENDI hech qanday "kerak emas" degan
 * keyingi xulosasiz o'chirilmasin.
 *
 * ISHLASH PRINSIPI: bu funksiya proksi-VM'ning `/whoami` endpoint'iga
 * so'rov yuboradi; VM esa o'z navbatida tashqi "IP aniqlash" xizmatiga
 * (ipify.org) so'rov yuborib, o'zining HAQIQIY chiquvchi IP manzilini
 * qaytaradi. Shu tarzda butun zanjir (Cloud Function -> VM -> tashqi
 * internet) bir yo'la tekshiriladi.
 *
 * XAVFSIZLIK: faqat administrator chaqira oladi (`admins/{uid}`
 * tekshiruvi — boshqa admin-only funksiyalar bilan bir xil naqsh,
 * masalan `nicheMigration.js`).
 *
 * MUHIM: hozircha VM'dagi test-server FAQAT diagnostika uchun (8080-
 * port butun internetga ochiq, autentifikatsiyasiz) — bu ATMOS'ning
 * HAQIQIY to'lov so'rovlarini proksi qilish uchun YETARLI EMAS.
 * Productionga chiqishdan oldin: (1) VM'dagi serverni xavfsizlashtirish
 * (firewall manbasini cheklash yoki maxfiy token talab qilish), (2)
 * `lib/atmosClient.js`dagi haqiqiy Atmos so'rovlarini shu proksi orqali
 * yo'naltirish kerak — bularning ikkalasi ham hali qilinmagan.
 * Shu ikki qadam bajarilib, ATMOS integratsiyasi to'liq proksi orqali
 * ishlaydigan bo'lgach, bu VAQTINCHALIK diagnostika fayli olib
 * tashlanishi mumkin (lekin FAQAT o'shanda, va faqat shu sabab bilan).
 */
const PROXY_VM_WHOAMI_URL = "http://35.211.129.224:8080/whoami";
const EXPECTED_STATIC_IP = "35.211.129.224";
const REQUEST_TIMEOUT_MS = 10000;

async function handleTestAtmosProxyIp(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  let response;
  try {
    response = await fetch(PROXY_VM_WHOAMI_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Proksi-VM bilan bog'lanishda xatolik:", err);
    throw new HttpsError(
      "unavailable",
      "Proksi-VM'ga ulanib bo'lmadi. VM ishlab turganini va firewall 8080-portni ochganini tekshiring."
    );
  }

  if (!response.ok) {
    throw new HttpsError("internal", `Proksi-VM ${response.status} status qaytardi.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpsError("internal", "Proksi-VM javobi noto'g'ri formatda (JSON emas).");
  }

  const vmOutboundIp = data && data.vmOutboundIp;
  return {
    vmOutboundIp: vmOutboundIp || null,
    expectedStaticIp: EXPECTED_STATIC_IP,
    matches: vmOutboundIp === EXPECTED_STATIC_IP,
  };
}

exports.testAtmosProxyIp = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleTestAtmosProxyIp));

exports._testables = { handleTestAtmosProxyIp, EXPECTED_STATIC_IP };
