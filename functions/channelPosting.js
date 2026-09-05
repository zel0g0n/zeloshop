const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * AI CEO — KANALGA POST QO'SHISH ("10-band": sotuvchi so'ragan
 * "kanalga admin qo'shilganda ishlaydigan funksiyalar" qismidan
 * BIRINCHISI - "post qo'shish").
 *
 * MUHIM CHEKLOV (halol, ochiq aytilgan): bu yerda faqat
 * "post qo'shish" (bot kanalga ONE-WAY xabar yuboradi) qurilgan.
 * "Javob berish" (kanal/guruhdagi izohlarga AVTOMATIK javob berish)
 * — BUTUNLAY BOSHQA, ANCHA MURAKKAB infratuzilma talab qiladi
 * (Telegram WEBHOOK'i - bot Telegram'dan kiruvchi xabarlarni
 * QABUL QILISHI kerak, hozircha tizimda bunday HECH QANDAY
 * mexanizm yo'q). Bu - alohida, kattaroq loyiha sifatida
 * REJALASHTIRILGAN, hozircha QURILMAGAN.
 *
 * OQIM: sotuvchi (1) o'z botini allaqachon ulagan bo'lishi kerak
 * (`connectCustomBot`), (2) o'sha botni O'Z KANALIGA ADMIN qilib
 * qo'shadi (kamida "Xabar yuborish" huquqi bilan), (3) shu yerda
 * kanal username'ini kiritadi - biz Telegram API orqali botning
 * HAQIQATAN o'sha kanalda admin ekanini TEKSHIRAMIZ, keyingina
 * ulanadi.
 */
async function handleConnectChannel(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`connectChannel:${request.auth.uid}`, 10, 3600);

  const uid = request.auth.uid;
  const { channelUsername } = request.data || {};
  const rawUsername = (channelUsername || "").trim();
  if (!rawUsername) {
    throw new HttpsError("invalid-argument", "Kanal username'ini kiriting.");
  }
  // Foydalanuvchi "@" bilan yoki bilansiz kiritishi mumkin - ikkalasini
  // ham qabul qilamiz.
  const normalizedUsername = rawUsername.startsWith("@") ? rawUsername : `@${rawUsername}`;

  const customBotSnap = await db.collection("sellers").doc(uid).collection("private").doc("customerBot").get();
  if (!customBotSnap.exists || !customBotSnap.data().botToken) {
    throw new HttpsError("failed-precondition", "Avval o'z botingizni ulang (Sozlamalar → O'z botingizni ulash).");
  }
  const token = customBotSnap.data().botToken;

  let botInfo;
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) throw new Error(meData.description);
    botInfo = meData.result;
  } catch (err) {
    console.error("Bot ma'lumotini olishda xatolik:", err);
    throw new HttpsError("internal", "Bot ma'lumotini olib bo'lmadi.");
  }

  // MUHIM: bot HAQIQATAN o'sha kanalda ADMIN ekanini, va "Xabar
  // yuborish" (`can_post_messages`) huquqiga ega ekanini TEKSHIRAMIZ -
  // aks holda, keyinchalik "post qo'shish" so'ralganda, tushunarsiz
  // Telegram xatosi bilan muvaffaqiyatsiz tugardi.
  let memberInfo;
  try {
    const memberRes = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(normalizedUsername)}&user_id=${botInfo.id}`
    );
    const memberData = await memberRes.json();
    if (!memberData.ok) {
      throw new Error(memberData.description || "Kanal topilmadi yoki bot u yerga qo'shilmagan.");
    }
    memberInfo = memberData.result;
  } catch (err) {
    throw new HttpsError(
      "failed-precondition",
      `Botni tekshirib bo'lmadi: ${err.message}. Botingizni (@${botInfo.username}) kanalingizga ADMIN sifatida qo'shganingizni tekshiring.`
    );
  }

  const isAdmin = memberInfo.status === "administrator" || memberInfo.status === "creator";
  const canPost = memberInfo.status === "creator" || memberInfo.can_post_messages === true;

  if (!isAdmin) {
    throw new HttpsError("failed-precondition", `Bot (@${botInfo.username}) bu kanalda admin emas. Iltimos, uni kanal sozlamalaridan "Administrator" qilib qo'shing.`);
  }
  if (!canPost) {
    throw new HttpsError("failed-precondition", `Bot admin, lekin unga "Xabar yuborish" huquqi berilmagan. Kanal admin sozlamalaridan shu huquqni yoqing.`);
  }

  await db.collection("sellers").doc(uid).collection("private").doc("customerBot").set(
    { connectedChannelUsername: normalizedUsername },
    { merge: true }
  );

  // MUHIM: kanal USERNAME'i o'zi (bot TOKENIDAN farqli) MAXFIY EMAS -
  // shuning uchun `customBotUsername` bilan BIR XIL naqshda, ASOSIY
  // (ommaviy) hujjatga ham yoziladi - shu orqali frontend (`useSession`
  // orqali `store` obyektini o'qiydigan) ulanish holatini KO'RA OLADI,
  // maxfiy `private/customerBot` qismini alohida o'qishga hojat
  // qolmaydi.
  await db.collection("sellers").doc(uid).set(
    { connectedChannelUsername: normalizedUsername },
    { merge: true }
  );

  return { channelUsername: normalizedUsername };
}

/**
 * Kanal ulanishini bekor qilish.
 */
async function handleDisconnectChannel(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const uid = request.auth.uid;
  await db.collection("sellers").doc(uid).collection("private").doc("customerBot").set(
    { connectedChannelUsername: null },
    { merge: true }
  );
  await db.collection("sellers").doc(uid).set(
    { connectedChannelUsername: null },
    { merge: true }
  );
  return { success: true };
}

/**
 * Kanalga post joylashtiradi (rasm + izoh, yoki faqat matn).
 *
 * MUHIM: bu — sotuvchi tomonidan, ANIQ BOSISH orqali (masalan
 * `SocialPostGeneratorCard.jsx`dagi "Kanalga joylashtirish" tugmasi)
 * ISHGA TUSHADI - HECH QACHON avtomatik, so'ralmasdan ishlamaydi.
 */
async function handlePostToChannel(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`postToChannel:${request.auth.uid}`, 20, 3600);

  const uid = request.auth.uid;
  const { caption, imageUrl } = request.data || {};
  const trimmedCaption = (caption || "").trim();
  if (!trimmedCaption && !imageUrl) {
    throw new HttpsError("invalid-argument", "Post matni yoki rasm kerak.");
  }

  const customBotSnap = await db.collection("sellers").doc(uid).collection("private").doc("customerBot").get();
  const customBotData = customBotSnap.exists ? customBotSnap.data() : null;
  if (!customBotData?.botToken || !customBotData?.connectedChannelUsername) {
    throw new HttpsError("failed-precondition", "Avval botingizni va kanalingizni ulang.");
  }

  const { botToken: token, connectedChannelUsername: channelUsername } = customBotData;

  try {
    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const body = imageUrl
      ? { chat_id: channelUsername, photo: imageUrl, caption: trimmedCaption.slice(0, 1024) } // Telegram: rasm sarlavhasi eng ko'pi 1024 belgi
      : { chat_id: channelUsername, text: trimmedCaption.slice(0, 4096) }; // Telegram: matn eng ko'pi 4096 belgi

    const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || "Telegram postni rad etdi.");
    }
    return { success: true, messageId: data.result?.message_id || null };
  } catch (err) {
    console.error("Kanalga joylashtirishda xatolik:", err);
    throw new HttpsError("internal", `Kanalga joylashtirib bo'lmadi: ${err.message}`);
  }
}

exports.connectChannel = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleConnectChannel));
exports.disconnectChannel = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleDisconnectChannel));
exports.postToChannel = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handlePostToChannel));

exports._testables = { handleConnectChannel, handleDisconnectChannel, handlePostToChannel };
