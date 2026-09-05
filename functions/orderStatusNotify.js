const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { BOT_TOKEN } = require("./lib/admin");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { logNotification } = require("./lib/dailyStats");
const { enqueueRetry } = require("./lib/notificationRetryQueue");
const { SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");

/**
 * Sof funksiya — sotuvchi buyurtmani tasdiqlaganda ("Yangi" →
 * "Yig'ilmoqda"/`processing`) mijozga yuboriladigan xabar matni.
 *
 * 2026-09 punkt-royxati, 14-band: aynan shu shablon (foydalanuvchi
 * bergan matn asosida) — TO'LOV USULIDAN QAT'IY NAZAR (naqd YOKI
 * karta) bir xil, chunki karta orqali to'langan buyurtmalar UCHUN HAM
 * "tasdiqlash" bosqichi AYNAN shu — sotuvchi chekni tekshirib,
 * "tasdiqlash" tugmasini bosgan payt (alohida qo'shimcha bosqich shart
 * emas — batafsil izoh: `orders.js`dagi `paymentMethod`/
 * `paymentReceiptUrl`).
 */
function buildOrderConfirmedMessage(fullName) {
  const name = fullName?.trim() || "";
  return [
    `✅ Hurmatli ${name || "mijoz"}, sizning buyurtmangiz tasdiqlandi!`,
    "",
    "🚚 Buyurtmani kuryerga topshirganimizda sizga alohida xabar beramiz.",
    "",
    "🙏 Xaridingiz uchun rahmat!",
  ].join("\n");
}

/**
 * Buyurtma "new" → "processing" holatiga o'tganda (sotuvchi yoki
 * ruxsatli xodim tomonidan tasdiqlanganda) mijozga AVTOMATIK xabar
 * yuboradi. OLDIN bu umuman mavjud emas edi — mijoz buyurtmasi
 * tasdiqlanganini FAQAT ilovani o'zi ochib tekshirsagina bilardi.
 *
 * Nega Firestore TRIGGER (onDocumentUpdated), Cloud Function CHAQIRUV
 * emas: sotuvchi/xodim buyurtma holatini ko'pincha to'g'ridan-to'g'ri
 * Firestore yozuvi orqali o'zgartiradi (`firestore.rules`dagi
 * `orders/{orderId}` yangilash qoidasi — Cloud Function orqali emas),
 * shuning uchun BARCHA yo'llarni (Mini App, xodim boti tugmasi va h.k.)
 * qamrab olishning yagona ishonchli yo'li — trigger.
 */
exports.onOrderConfirmedNotifyClient = onDocumentUpdated(
  { document: "orders/{orderId}", secrets: [BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;
    if (before.status !== "new" || after.status !== "processing") return;
    if (!after.clientId || !after.sellerId) return;

    try {
      const customBotToken = await getSellerCustomBotToken(after.sellerId);
      const text = buildOrderConfirmedMessage(after.customer?.fullName);
      const result = await sendCustomerNotification(customBotToken, after.clientId, text);
      await logNotification({
        sellerId: after.sellerId,
        clientId: after.clientId,
        type: "orderConfirmed",
        title: "Buyurtma tasdiqlandi",
        message: result?.ok ? text : `${text}\n\n[Yetkazilmadi: ${result?.description || result?.error || "noma'lum sabab"}]`,
        delivered: Boolean(result?.ok),
      });

      // 4-BOT EKOTIZIM AUDITI (P2) — bu, mijoz oladigan ENG asosiy
      // xabarlardan biri (buyurtma tasdiqlandi), shuning uchun
      // `sendTelegramMessage`ning o'z ICHKI qayta urinishlari (429/5xx)
      // TUGAGANDAN keyin ham muvaffaqiyatsiz bo'lsa, uni butunlay
      // tashlab yubormaymiz — birozdan keyin qayta urinish uchun
      // navbatga qo'shamiz (batafsil: `lib/notificationRetryQueue.js`).
      if (!result?.ok) {
        await enqueueRetry({
          kind: "customerNotification",
          payload: { sellerId: after.sellerId, clientId: after.clientId, text },
          reason: result?.description || result?.error || "noma'lum sabab",
        });
      }
    } catch (err) {
      console.error("Buyurtma tasdiqlangani haqida mijozga xabar yuborishda xatolik:", err);
      initSentry();
      Sentry.captureException(err, { extra: { orderId: event.params?.orderId } });
    }
  }
);

exports._testables = { buildOrderConfirmedMessage };
