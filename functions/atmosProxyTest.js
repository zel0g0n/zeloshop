const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI — ATMOS uchun tayyorlangan
 * statik-IP proksi-server (Oracle/GCP VM) ishlab turganini va Cloud
 * Function undan haqiqatan ham shu STATIK IP orqali chiqayotganini
 * tasdiqlash uchun.
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
 * MUHIM: ATMOS integratsiyasi PRODUCTION kodga (haqiqiy to'lov
 * so'rovlarini proksi orqali yuborish) o'tkazilgandan so'ng, bu vaqtinchalik
 * fayl butunlay OLIB TASHLANISHI kerak — bu faqat qurish bosqichidagi
 * diagnostika vositasi, doimiy funksionallik emas.
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
