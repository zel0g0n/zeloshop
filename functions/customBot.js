const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, CUSTOM_BOT_WEBHOOK_SECRET } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Sotuvchi botini shu YAGONA webhook manziliga ulaydi — `sellerId`
 * URL yo'lida ko'rsatiladi, shu orqali `customBotWebhook.js` qaysi
 * sotuvchiga tegishli ekanini biladi (batafsil izoh: shu fayl,
 * `customBotWebhook.js`ning boshidagi izoh). Xato bo'lsa ham (masalan
 * Telegram vaqtincha ishlamasa) ULASH JARAYONINI TO'XTATMAYDI — bot
 * baribir "Menu tugmasi" orqali ISHLAYDI, faqat kanal postidagi
 * "Sotib olish" tugmasi bosilganda javob bermasligi mumkin (bu —
 * ikkinchi darajali qulaylik, asosiy ulash muvaffaqiyatini
 * to'xtatmasligi kerak).
 */
async function registerCustomBotWebhook(token, sellerId) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) return;
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/customBotWebhook/${sellerId}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: CUSTOM_BOT_WEBHOOK_SECRET.value(),
        allowed_updates: ["message"],
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Sotuvchi boti uchun webhook o'rnatilmadi:", data.description);
    }
  } catch (err) {
    console.error("Sotuvchi boti uchun webhook o'rnatishda xatolik:", err);
  }
}

/**
 * SOTUVCHINING O'Z BOTINI ULASH.
 *
 * Sotuvchi BotFather orqali FAQAT oddiy bot yaratadi (`/newbot`) va
 * tokenini shu yerga kiritadi — `/newapp` kabi qo'shimcha, qo'lda
 * bajariladigan qadamlar SHART EMAS. Bot tokeni — MAXFIY
 * (`sellers/{id}/private/customerBot`) qismda saqlanadi — asosiy
 * `sellers` hujjatida EMAS (u ommaviy o'qiladi).
 *
 * MUHIM: kiritilgan token Telegram'ning o'zidagi `getMe` API'siga
 * so'rov yuborib TEKSHIRILADI — shu orqali (1) token haqiqatan
 * to'g'ri ekanligi, va (2) botning HAQIQIY foydalanuvchi nomi
 * (username) aniqlanadi. Shundan so'ng, botning "Menu tugmasi"
 * to'g'ridan-to'g'ri Bot API orqali AVTOMATIK sozlanadi (pastga
 * qarang) — shuning uchun sotuvchi mustaqil, hech kimning yordamisiz
 * ulay oladi.
 */
exports.connectCustomBot = onCall({ region: "asia-south1", secrets: [SENTRY_DSN, CUSTOM_BOT_WEBHOOK_SECRET] }, withSentry(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  // SO'ROVLARNI CHEGARALASH: bir soatda 10 tadan ortiq urinishga
  // yo'l qo'yilmaydi — bu, Telegram API'sini suiiste'mol qilishning
  // oldini oladi.
  await checkRateLimit(`connectCustomBot:${request.auth.uid}`, 10, 3600);

  const { botToken } = request.data || {};
  const token = (botToken || "").trim();
  if (!token || !token.includes(":")) {
    throw new HttpsError("invalid-argument", "Bot tokeni noto'g'ri formatda.");
  }

  const uid = request.auth.uid;

  let botInfo;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || "Telegram tokenni rad etdi.");
    }
    botInfo = data.result;
  } catch (err) {
    console.error("Bot tokenini tekshirishda xatolik:", err);
    throw new HttpsError("invalid-argument", "Bu token yaroqsiz. Iltimos, BotFather'dan olgan tokenni to'g'ri kiritganingizni tekshiring.");
  }

  if (!botInfo.username) {
    throw new HttpsError("internal", "Bot ma'lumoti to'liq emas — username topilmadi.");
  }

  // MUHIM TUZATISH (haqiqiy, sezilmagan xato): OLDIN bot ulanganda
  // FAQAT "Menu tugmasi" sozlanardi - botning NOMI va TAVSIFI hech
  // qachon do'kon ma'lumotiga MOSLASHTIRILMASDI. Natijada, xaridor
  // sotuvchining shaxsiy botini Telegram'da qidirganda/ochganda,
  // bot HALI HAM "@BotFather bergan standart nom"da ko'rinardi, do'kon
  // nomi/tavsifi bilan HECH QANDAY bog'liqligi yo'q edi. Endi bot
  // ulanganda, uning nomi va tavsifi AVTOMATIK ravishda do'kon
  // ma'lumotiga moslashtiriladi.
  //
  // MUHIM CHEKLOV (Telegram platformasining o'zi): bot PROFIL RASMINI
  // Bot API orqali o'zgartirib bo'lmaydi - bu, faqat BotFather orqali,
  // sotuvchining O'ZI tomonidan qo'lda (`/setuserpic` buyrug'i bilan)
  // qilinishi mumkin. Bu - Telegram'ning texnik cheklovi, bizning
  // kod tomonimizdan tuzatib bo'lmaydigan narsa.
  const sellerDoc = await db.collection("sellers").doc(uid).get();
  const storeName = sellerDoc.exists ? sellerDoc.data().storeName : null;
  const storeDescription = sellerDoc.exists ? sellerDoc.data().description : null;

  if (storeName) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/setMyName`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: storeName.slice(0, 64) }), // Telegram: eng ko'pi 64 belgi
      });
      await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ short_description: (storeDescription || storeName).slice(0, 120) }), // eng ko'pi 120 belgi
      });
      await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: (storeDescription || `${storeName} - rasmiy Telegram do'koni`).slice(0, 512) }), // eng ko'pi 512 belgi
      });
    } catch (err) {
      // MUHIM: bu qadam MUVAFFAQIYATSIZ bo'lsa ham, botning o'zi
      // (Menu tugmasi bilan) TO'LIQ ISHLAYDI - shuning uchun bu
      // yerdagi xatolik BUTUN ULASH JARAYONINI to'xtatmasligi kerak,
      // faqat logga yoziladi.
      console.error("Bot nomi/tavsifini sozlashda xatolik (jarayon davom etadi):", err);
    }
  }

  // MUHIM: `/newapp` (BotFather'da qo'lda) o'rniga, Telegram'ning
  // "Menu tugmasi" (Menu Button) imkoniyatidan foydalanamiz — bu,
  // to'g'ridan-to'g'ri Bot API orqali AVTOMATIK sozlanadi, sotuvchi
  // hech qanday qo'shimcha qadam bosishi shart emas. `chat_id`
  // berilmasa, bu sozlama BOTNING BARCHA foydalanuvchilari uchun
  // standart bo'lib qoladi — ya'ni har bir xaridor (va botni ochgan
  // sotuvchining o'zi ham) botni ochganda, pastki chap burchakdagi
  // tugma to'g'ridan-to'g'ri do'konni ochadi.
  //
  // Web App manziliga sotuvchining O'Z ID'si oldindan yozib
  // qo'yiladi (`?ownerSellerId=...`) — shu orqali, `start_param`siz
  // (oddiy "Start" bilan) ochilganda ham, tizim qaysi sotuvchining
  // shaxsiy tokenini sinash kerakligini biladi.
  const webAppUrl = `https://commerce-zelo.web.app/?ownerSellerId=${uid}`;
  try {
    const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Do'kon", web_app: { url: webAppUrl } },
      }),
    });
    const menuData = await menuRes.json();
    if (!menuData.ok) {
      console.error("Menu tugmasini sozlashda xatolik:", menuData.description);
      throw new HttpsError("internal", "Bot tokeni to'g'ri, lekin Menu tugmasini sozlab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("Menu tugmasini sozlashda xatolik:", err);
    throw new HttpsError("internal", "Bot tokeni to'g'ri, lekin Menu tugmasini sozlab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }

  await db.collection("sellers").doc(uid).collection("private").doc("customerBot").set({
    botToken: token,
    botUsername: botInfo.username,
    connectedAt: new Date().toISOString(),
  });

  // Do'kon havolasi qaysi bot orqali ochilishini frontend biladigan
  // qilish uchun, botning ommaviy username'ini ASOSIY (ommaviy)
  // hujjatga ham yozamiz — token esa HECH QACHON bu yerga tushmaydi.
  await db.collection("sellers").doc(uid).set(
    { customBotUsername: botInfo.username },
    { merge: true }
  );

  // Kanal posti/ulashishdagi "Sotib olish" tugmasi ENDI sellerning
  // shaxsiy botiga (`?start=...`) ishora qiladi — bosilganda bot shu
  // webhookka xabar yuboradi, u esa haqiqiy Mini App tugmasi bilan
  // javob beradi (batafsil: `customBotWebhook.js`).
  await registerCustomBotWebhook(token, uid);

  return { botUsername: botInfo.username };
}));

/**
 * Sotuvchi o'z botini uzish (bekor qilish) imkoniyati.
 */
exports.disconnectCustomBot = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const uid = request.auth.uid;

  // Menu tugmasini asl holatiga qaytarish uchun, avval saqlangan
  // tokenni o'qib olamiz (o'chirishdan OLDIN).
  const customBotSnap = await db.collection("sellers").doc(uid).collection("private").doc("customerBot").get();
  const storedToken = customBotSnap.exists ? customBotSnap.data().botToken : null;

  await db.collection("sellers").doc(uid).collection("private").doc("customerBot").delete();
  await db.collection("sellers").doc(uid).set({ customBotUsername: null }, { merge: true });

  if (storedToken) {
    try {
      await fetch(`https://api.telegram.org/bot${storedToken}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_button: { type: "default" } }),
      });
    } catch (err) {
      // Bu — halokatli emas: token o'chirilgan, faqat Menu tugmasi
      // eskicha ko'rinishda qolishi mumkin. Foydalanuvchini
      // to'xtatmaymiz.
      console.error("Menu tugmasini asl holatga qaytarishda xatolik:", err);
    }
    try {
      await fetch(`https://api.telegram.org/bot${storedToken}/deleteWebhook`, { method: "POST" });
    } catch (err) {
      console.error("Webhookni o'chirishda xatolik (halokatli emas):", err);
    }
  }

  return { success: true };
}));
