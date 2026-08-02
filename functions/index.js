const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");
const { verifyTelegramInitData } = require("./telegramAuth");

admin.initializeApp();
const db = admin.firestore();

// Bot tokenini Cloud Functions "secret" sifatida saqlaymiz — kodda,
// .env faylida yoki Git'da HECH QACHON ko'rinmaydi. Terminalda:
//   firebase functions:secrets:set BOT_TOKEN
// deb, so'ralganda BotFather bergan tokenni kiritasiz.
const BOT_TOKEN = defineSecret("BOT_TOKEN");

// Gemini (Google AI Studio) kaliti — https://aistudio.google.com/app/apikey
// dan olinadi (bepul tarifi bor). Terminalda:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/**
 * Frontend (SessionContext) shu funksiyani chaqiradi:
 *   const result = await verifyTelegramAuth({ initData });
 *
 * Natija: { token, telegramUser, startParam }
 *   - token        → signInWithCustomToken(auth, token) uchun
 *   - telegramUser → { id, first_name, username, ... }
 *   - startParam   → bot start param (masalan sotuvchining ID'si,
 *                     agar foydalanuvchi sotuvchining do'kon havolasi
 *                     orqali kirgan bo'lsa)
 */
/**
 * Firestore hujjatidagi Timestamp maydonlarini (masalan `createdAt`)
 * oddiy, JSON orqali xavfsiz uzatiladigan ISO-sana matniga aylantiradi.
 * Buni qilmasak, Cloud Function javobi noto'g'ri (frontend'da
 * ishlatib bo'lmaydigan) shaklda qaytishi mumkin edi.
 */
function sanitizeFirestoreData(data) {
  if (!data) return data;
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value.toDate === "function") {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

exports.verifyTelegramAuth = onCall(
  { secrets: [BOT_TOKEN], region: "asia-south1" },
  async (request) => {
    const { initData } = request.data || {};

    let verified;
    try {
      verified = verifyTelegramInitData(initData, BOT_TOKEN.value());
    } catch (err) {
      // Xato sababini logga yozamiz, lekin chaqiruvchiga faqat umumiy
      // xabar qaytaramiz — nima aniq tekshiruvdan o'tmaganini oshkor
      // qilish shart emas.
      console.error("Telegram auth tekshiruvi muvaffaqiyatsiz:", err.message);
      throw new HttpsError("unauthenticated", "Telegram autentifikatsiyasi tasdiqlanmadi.");
    }

    const { user, startParam } = verified;
    if (!user || !user.id) {
      throw new HttpsError("unauthenticated", "Telegram foydalanuvchi ma'lumoti topilmadi.");
    }

    const uid = String(user.id);

    // OLDIN: bu yerda `clients/{uid}` HAR DOIM (kim bo'lishidan qat'i
    // nazar — admin, sotuvchi, yangi foydalanuvchi) yaratilardi. Bu
    // sinov paytida chalkashlik keltirib chiqargan: Firestore'da hamma
    // "mijoz" sifatida ko'rinardi, garchi ilova ularni to'g'ri
    // (sotuvchi/admin/yangi) deb aniqlagan bo'lsa ham. Endi bu yozuv
    // FAQAT haqiqatan mijoz sifatida kirganda (start_param bor —
    // sotuvchining do'kon havolasi orqali) amalga oshadi.
    if (startParam) {
      try {
        await db.collection("clients").doc(uid).set(
          {
            telegramId: uid,
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
            username: user.username ? `@${user.username}` : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        // OLDIN: bu yerda try/catch yo'q edi — xato sodir bo'lsa, Cloud
        // Functions uni umumiy "INTERNAL" xatosiga aylantirib, haqiqiy
        // sababni yashirardi. Eng ko'p uchraydigan sabab: Firestore
        // ma'lumotlar bazasi hali "Native mode"da yaratilmagan.
        console.error("Firestore'ga yozishda xatolik:", err);
        throw new HttpsError(
          "internal",
          "Ma'lumotlar bazasiga yozishda xatolik. Firestore Console'da baza yaratilganini tekshiring."
        );
      }
    }

    let customToken;
    try {
      customToken = await admin.auth().createCustomToken(uid, {
        // Firestore Security Rules ichida `request.auth.token.startParam`
        // orqali foydalanish mumkin bo'lgan qo'shimcha claim.
        startParam: startParam || null,
      });
    } catch (err) {
      // Eng ko'p uchraydigan sabab: Cloud Functions ishlatadigan
      // xizmat hisobida (service account) "Service Account Token
      // Creator" IAM roli yo'q — shu rolsiz custom token yaratib
      // bo'lmaydi.
      console.error("Custom token yaratishda xatolik:", err);
      throw new HttpsError(
        "internal",
        "Token yaratishda xatolik. Xizmat hisobida 'Service Account Token Creator' roli borligini tekshiring."
      );
    }

    // OLDIN: frontend token olgandan KEYIN, o'zining Firestore SDK'i
    // orqali admin+do'kon hujjatlarini ALOHIDA so'rar edi. Diagnostika
    // shuni ko'rsatdiki, mijoz tomonidagi Firestore SDK'ning BIRINCHI
    // ulanishni o'rnatishi (WebSocket/uzoq-so'rov aniqlash) Telegram
    // WebView'da ~4.8 soniya olishi mumkin edi. Bu yerda, server
    // tomonida (Admin SDK), bunday muammo yo'q — shuning uchun
    // natijani token bilan BIRGA, shu javobning o'zida qaytaramiz.
    //
    // KEYINGI TUZATISH: shu bilan bir vaqtda, PIN xavfsizlik holatini
    // ham (agar bu chaqiruv MIJOZ emas, balki potensial SOTUVCHINING
    // O'ZI bo'lsa — ya'ni start_param yo'q bo'lsa) olib qo'yamiz.
    // OLDIN, bu ma'lumot `SellerLayout.jsx`da ALOHIDA, Dashboard
    // render bo'lishidan OLDIN kutiladigan uchinchi Firestore
    // so'rovi orqali olinardi — bu diagnostikada aniqlanmagan,
    // qo'shimcha kechikish manbai edi.
    const sellerIdToFetch = startParam || uid;
    const shouldFetchOwnSecurity = !startParam;
    const [adminSnap, sellerSnap, securitySnap] = await Promise.all([
      db.collection("admins").doc(uid).get(),
      db.collection("sellers").doc(sellerIdToFetch).get(),
      shouldFetchOwnSecurity
        ? db.collection("sellers").doc(uid).collection("private").doc("security").get()
        : Promise.resolve(null),
    ]);

    return {
      token: customToken,
      telegramUser: {
        id: uid,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        username: user.username || null,
      },
      startParam: startParam || null,
      isAdmin: adminSnap.exists,
      store: sellerSnap.exists ? { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) } : null,
      security: securitySnap?.exists ? sanitizeFirestoreData(securitySnap.data()) : null,
    };
  }
);

/**
 * Sotuvchi "Mahsulot qo'shish" formasida "✨ AI bilan to'ldirish"
 * tugmasini bosganda chaqiriladi. Mahsulot nomi va kategoriyasi
 * asosida, Gemini (Google AI) yordamida haqiqiy, mahsulotga xos
 * tavsif matnini yaratadi.
 *
 * OLDIN: "AI bilan to'ldirish" tugmasi HAQIQIY AI emas edi — u har
 * doim bitta, qattiq kodlangan matnni qaytarardi, mahsulot nomi yoki
 * kategoriyasidan qat'i nazar.
 */
exports.generateProductDescription = onCall(
  { secrets: [GEMINI_API_KEY], region: "asia-south1" },
  async (request) => {
    // Faqat tizimga kirgan (haqiqiy Telegram orqali tasdiqlangan)
    // foydalanuvchilar chaqira oladi — bu AI so'rovi pullik bo'lgani
    // uchun, tasodifiy/anonim suiiste'molning oldini olish uchun kerak.
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
    }

    const { productName, category, imageBase64, imageMimeType } = request.data || {};
    const name = (productName || "").trim();

    if (!name) {
      throw new HttpsError("invalid-argument", "Mahsulot nomi ko'rsatilishi shart.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

      // OLDIN: AI faqat mahsulot NOMI va kategoriyasiga qarab, umumiy
      // taxmin asosida tavsif yozardi — haqiqiy mahsulotni "ko'rmasdi".
      // Endi, agar sotuvchi rasm yuklagan bo'lsa, o'sha rasm ham AI'ga
      // yuboriladi (Gemini multimodal — matn VA rasmni birga tahlil
      // qila oladi) — natijada tavsif haqiqiy mahsulotning ko'rinishiga
      // (rangi, shakli, turi) asoslanadi, faqat nomga emas.
      const hasImage = Boolean(imageBase64 && imageMimeType);

      const textPrompt = `Sen — onlayn do'kon uchun mahsulot tavsifi yozuvchi yordamchisan.
${hasImage ? "Ilova qilingan RASMga qarab va" : "Quyidagi"} mahsulot nomi/kategoriyasi asosida, O'ZBEK TILIDA, jozibali, ishonchli va qisqa (2-3 gap, 40-60 so'z) tavsif yoz.

Mahsulot nomi: ${name}
${category ? `Kategoriya: ${category}` : ""}

Qoidalar:
- Faqat tavsif matnini yoz, boshqa hech narsa (sarlavha, izoh, tirnoq belgisi) qo'shma.
${hasImage ? "- Rasmda haqiqatan ko'rinib turgan narsalar (rang, shakl, material) haqida yoz." : ""}
- Aniq raqamli da'volar (masalan "99% samarali", sertifikat nomlari) ISHLATMA — bular haqiqiy bo'lmasligi mumkin.
- Tabiiy, sotuvga undaydigan, lekin ishonchli ohangda yoz.`;

      const contents = hasImage
        ? [
            {
              role: "user",
              parts: [
                { text: textPrompt },
                { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
              ],
            },
          ]
        : textPrompt;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents,
      });

      const description = (response.text || "").trim();
      if (!description) {
        throw new Error("AI bo'sh javob qaytardi.");
      }

      return { description };
    } catch (err) {
      console.error("AI tavsif yaratishda xatolik:", err);
      throw new HttpsError("internal", "Tavsif yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
    }
  }
);

/**
 * Telegram Bot API orqali xabar yuborish yordamchisi. Node 20'da
 * `fetch` allaqachon mavjud (qo'shimcha kutubxona kerak emas).
 */
async function sendTelegramMessage(token, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    return { chatId, ok: Boolean(data.ok), description: data.description };
  } catch (err) {
    return { chatId, ok: false, error: err.message };
  }
}

/**
 * XAVFSIZ BUYURTMA YARATISH.
 *
 * OLDIN: buyurtma to'g'ridan-to'g'ri klient tomonidan (frontend'dan)
 * Firestore'ga yozilardi — mahsulot narxlari, promokod chegirmasi,
 * hatto umumiy summaning o'zi ham MIJOZ BRAUZERIDA hisoblanib,
 * hech qanday tekshiruvsiz saqlanardi. Nazariy jihatdan, texnik
 * bilimga ega mijoz bu qiymatlarni o'zgartirib, o'ziga noto'g'ri
 * (masalan sun'iy past) narx yoki chegirma bera olardi.
 *
 * ENDI: mijoz faqat mahsulot ID'lari va sonini yuboradi. Narxlar,
 * promokod haqiqiyligi va chegirma — barchasi shu yerda, Firestore
 * TRANSACTION ichida, HAQIQIY (server tomonidagi) ma'lumotdan qayta
 * hisoblanadi. Bonusda: ombor qoldig'i ham avtomatik kamayadi, va
 * promokod ishlatilish soni bir vaqtning o'zida (parallel) ikkita
 * mijoz tomonidan limitdan oshib ketishining oldi olinadi.
 */
exports.createOrder = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  const { sellerId, customerData, items, couponCode, deliveryZoneKey } = request.data || {};
  const clientId = request.auth.uid; // HECH QACHON mijoz o'zi yubormaydi — sessiyadan olinadi.

  if (!sellerId) throw new HttpsError("invalid-argument", "Sotuvchi ko'rsatilmagan.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Savat bo'sh.");
  }
  if (!customerData?.fullName?.trim() || !customerData?.phone?.trim()) {
    throw new HttpsError("invalid-argument", "Mijoz ma'lumotlari to'liq emas.");
  }

  const firestore = admin.firestore();

  try {
    const result = await firestore.runTransaction(async (transaction) => {
      // 1) Har bir mahsulotni HAQIQIY Firestore'dan o'qiymiz (mijoz
      // yuborgan narx/nom/rasmga ISHONMAYMIZ).
      const productRefs = items.map((item) => firestore.collection("products").doc(item.productId));
      const sellerRef = firestore.collection("sellers").doc(sellerId);
      const [productSnaps, sellerSnap] = await Promise.all([
        Promise.all(productRefs.map((ref) => transaction.get(ref))),
        transaction.get(sellerRef),
      ]);

      const orderItems = [];
      let subtotal = 0;

      for (let i = 0; i < items.length; i++) {
        const snap = productSnaps[i];
        const requestedQty = Number(items[i].quantity) || 0;

        if (!snap.exists) {
          throw new HttpsError("not-found", `Mahsulot topilmadi (${items[i].productId}).`);
        }
        const product = snap.data();

        if (product.sellerId !== sellerId) {
          throw new HttpsError("invalid-argument", "Savatda boshqa do'konning mahsuloti bor.");
        }
        if (requestedQty <= 0) {
          throw new HttpsError("invalid-argument", "Mahsulot soni noto'g'ri.");
        }
        if (Number(product.stock) < requestedQty) {
          throw new HttpsError("failed-precondition", `"${product.name}" omborda yetarli emas (qoldiq: ${product.stock}).`);
        }

        const hasDiscount = product.discountPrice && Number(product.discountPrice) > 0 && Number(product.discountPrice) < Number(product.price);
        const unitPrice = hasDiscount ? Number(product.discountPrice) : Number(product.price) || 0;

        orderItems.push({
          id: productRefs[i].id,
          name: product.name,
          image: product.image || (product.images && product.images[0]) || null,
          price: unitPrice,
          quantity: requestedQty,
        });
        subtotal += unitPrice * requestedQty;
      }

      // 2) Promokodni — agar berilgan bo'lsa — HAQIQIY qoidalar
      // bo'yicha qayta tekshiramiz (mijoz "discountAmount"iga
      // ishonmaymiz).
      let appliedCoupon = null;
      let discountAmount = 0;
      let couponRef = null;

      if (couponCode) {
        const normalizedCode = String(couponCode).trim().toUpperCase();
        couponRef = firestore.collection("sellers").doc(sellerId).collection("coupons").doc(normalizedCode);
        const couponSnap = await transaction.get(couponRef);

        if (!couponSnap.exists) {
          throw new HttpsError("not-found", "Bunday promokod topilmadi.");
        }
        const coupon = couponSnap.data();

        if (!coupon.isActive) {
          throw new HttpsError("failed-precondition", "Bu promokod faol emas.");
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
          throw new HttpsError("failed-precondition", "Bu promokodning muddati tugagan.");
        }
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          throw new HttpsError("failed-precondition", "Bu promokodning ishlatish limiti tugagan.");
        }

        discountAmount = coupon.discountType === "percent"
          ? Math.round((subtotal * coupon.discountValue) / 100)
          : Math.min(coupon.discountValue, subtotal);

        appliedCoupon = { code: normalizedCode, discountAmount };
      }

      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      const amountAfterDiscount = Math.max(0, subtotal - discountAmount);

      // 3) Yetkazib berish narxini HAQIQIY sotuvchi sozlamasidan
      // hisoblaymiz (mijoz hech qanday narx yubormaydi — faqat
      // tanlagan hudud kalitini).
      let deliveryZone = null;
      let deliveryFee = 0;

      if (deliveryZoneKey && seller.deliveryZones?.[deliveryZoneKey]) {
        const zoneConfig = seller.deliveryZones[deliveryZoneKey];
        const isFreeDelivery = seller.freeDeliveryEnabled &&
          seller.freeDeliveryThreshold &&
          amountAfterDiscount >= Number(seller.freeDeliveryThreshold);

        deliveryFee = isFreeDelivery ? 0 : (Number(zoneConfig.price) || 0);
        deliveryZone = {
          key: deliveryZoneKey,
          price: deliveryFee,
          days: zoneConfig.days || null,
          isFree: isFreeDelivery,
        };
      }

      const totalAmount = amountAfterDiscount + deliveryFee;

      // 4) Ombor qoldig'ini kamaytiramiz (HAR BIR mahsulot uchun).
      productRefs.forEach((ref, i) => {
        const newStock = Number(productSnaps[i].data().stock) - orderItems[i].quantity;
        transaction.update(ref, { stock: Math.max(0, newStock) });
      });

      // 5) Promokod ishlatilish sonini oshiramiz (agar bo'lsa).
      if (couponRef) {
        transaction.update(couponRef, { usedCount: admin.firestore.FieldValue.increment(1) });
      }

      // 6) Buyurtmani yaratamiz.
      const orderRef = firestore.collection("orders").doc();
      transaction.set(orderRef, {
        sellerId,
        clientId,
        customer: {
          fullName: customerData.fullName.trim(),
          phone: customerData.phone.trim(),
          address: customerData.address || "",
          location: customerData.location || null,
          paymentTypes: Array.isArray(customerData.paymentTypes) ? customerData.paymentTypes : [],
        },
        orders: orderItems,
        status: "new",
        subtotal,
        appliedCoupon,
        deliveryZone,
        totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { orderId: orderRef.id, subtotal, discountAmount, deliveryZone, totalAmount, appliedCoupon };
    });

    return result;
  } catch (err) {
    console.error("Xavfsiz buyurtma yaratishda xatolik:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Buyurtma yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
});
exports.sendCrmNotification = onCall(
  { secrets: [BOT_TOKEN], region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
    }

    const { sellerId, targetClientIds, channel, title, message } = request.data || {};

    if (request.auth.uid !== String(sellerId)) {
      throw new HttpsError("permission-denied", "Faqat o'z do'koningiz nomidan xabar yubora olasiz.");
    }
    if (!title?.trim() || !message?.trim()) {
      throw new HttpsError("invalid-argument", "Sarlavha va matn kiritilishi shart.");
    }

    const token = BOT_TOKEN.value();
    const text = `📢 ${title.trim()}\n\n${message.trim()}`;

    let clientResults = [];
    if ((channel === "client" || channel === "both") && Array.isArray(targetClientIds) && targetClientIds.length > 0) {
      // OLDIN: `targetClientIds` frontend'dan kelgan ro'yxatga
      // ko'r-ko'rona ishonilardi — hech qanday server tomonidagi
      // tekshiruv yo'q edi. Bu — botni ISTALGAN Telegram ID'ga
      // (haqiqiy mijoz bo'lmasa ham) spam yuborish vositasi sifatida
      // suiiste'mol qilinishiga yo'l ochardi. Endi har bir ID ushbu
      // sotuvchining HAQIQIY buyurtma tarixida borligi tekshiriladi.
      const firestore = admin.firestore();
      const verifiedIds = new Set();
      const CHUNK_SIZE = 30; // Firestore "in" so'rovi cheklovi

      for (let i = 0; i < targetClientIds.length; i += CHUNK_SIZE) {
        const chunk = targetClientIds.slice(i, i + CHUNK_SIZE);
        const ordersSnap = await firestore.collection("orders")
          .where("sellerId", "==", sellerId)
          .where("clientId", "in", chunk)
          .get();
        ordersSnap.forEach((doc) => verifiedIds.add(doc.data().clientId));
      }

      const safeClientIds = targetClientIds.filter((id) => verifiedIds.has(id));
      clientResults = await Promise.all(safeClientIds.map((id) => sendTelegramMessage(token, id, text)));
    }

    let sellerResult = null;
    if (channel === "seller" || channel === "both") {
      sellerResult = await sendTelegramMessage(token, sellerId, text);
    }

    return {
      clientsSent: clientResults.filter((r) => r.ok).length,
      clientsTotal: clientResults.length,
      sellerNotified: sellerResult ? sellerResult.ok : null,
    };
  }
);

/**
 * Yangi buyurtma kelganda sotuvchiga HAQIQIY Telegram xabari
 * yuboriladi (agar `notifyNewOrder` sozlamasi yoqilgan bo'lsa —
 * standart holatda yoqilgan hisoblanadi).
 */
exports.onNewOrderNotifySeller = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [BOT_TOKEN], region: "asia-south1" },
  async (event) => {
    const order = event.data.data();
    if (!order?.sellerId) return;

    // Agar buyurtmada promokod ishlatilgan bo'lsa, uning
    // `usedCount`ini shu yerda (Admin SDK orqali) oshiramiz — mijoz
    // tomonidan to'g'ridan-to'g'ri emas, chunki Firestore qoidalari
    // promokodni faqat egasi (sotuvchi) o'zgartira olishini talab
    // qiladi. Admin SDK bu qoidalardan mustasno.
    if (order.appliedCoupon?.code) {
      try {
        const couponRef = admin.firestore()
          .collection("sellers").doc(order.sellerId)
          .collection("coupons").doc(order.appliedCoupon.code);
        await couponRef.update({ usedCount: admin.firestore.FieldValue.increment(1) });
      } catch (err) {
        console.error("Promokod hisoblagichini yangilashda xatolik:", err);
      }
    }

    try {
      const sellerSnap = await admin.firestore().collection("sellers").doc(order.sellerId).get();
      const seller = sellerSnap.data();
      if (!seller || seller.notifyNewOrder === false) return; // standart holatda yoqilgan

      const text = `🛍️ Yangi buyurtma!\n\nMijoz: ${order.customer?.fullName || "Noma'lum"}\nSumma: ${Number(order.totalAmount || 0).toLocaleString()} so'm\n\nBatafsil ma'lumot uchun "Buyurtmalar" bo'limini oching.`;
      await sendTelegramMessage(BOT_TOKEN.value(), order.sellerId, text);
    } catch (err) {
      console.error("Yangi buyurtma bildirishnomasida xatolik:", err);
    }
  }
);

/**
 * Mahsulot stogi kritik darajaga (3 tagacha) tushganda sotuvchiga
 * HAQIQIY ogohlantirish yuboriladi (agar `notifyLowStock` sozlamasi
 * yoqilgan bo'lsa — standart holatda yoqilgan).
 */
exports.onLowStockNotifySeller = onDocumentUpdated(
  { document: "products/{productId}", secrets: [BOT_TOKEN], region: "asia-south1" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after?.sellerId) return;

    const beforeStock = Number(before?.stock ?? 999);
    const afterStock = Number(after?.stock ?? 0);

    // Faqat stok ENDIGINA kritik chegaradan (3) o'tganda yuboriladi —
    // har safar sahifa yangilanganda emas, faqat HAQIQIY o'zgarishda.
    if (afterStock > 3 || beforeStock <= 3) return;

    try {
      const sellerSnap = await admin.firestore().collection("sellers").doc(after.sellerId).get();
      const seller = sellerSnap.data();
      if (!seller || seller.notifyLowStock === false) return;

      const text = `⚠️ Omborda tovar kamaymoqda!\n\n"${after.name}" — atigi ${afterStock} ta qoldi.\n\nVaqtida to'ldirib qo'ying.`;
      await sendTelegramMessage(BOT_TOKEN.value(), after.sellerId, text);
    } catch (err) {
      console.error("Kam qolgan tovar bildirishnomasida xatolik:", err);
    }
  }
);

/**
 * KUNLIK P&L HISOBOTI — har kuni (Toshkent vaqti bilan soat 21:00da)
 * ishga tushadi, `notifyDailyReport` yoqilgan har bir sotuvchiga
 * o'sha kunning buyurtmalari/tushumi/taxminiy sof foydasi haqida
 * HAQIQIY Telegram xabari yuboradi.
 *
 * MUHIM, HALOL IZOH: bu — buyurtma "bugun BERILGAN" (createdAt)
 * bo'yicha hisoblanadi, "bugun YETKAZILGAN" emas — chunki hozirgi
 * ma'lumot tuzilmasida alohida "yetkazilgan sana" maydoni saqlanmaydi.
 * Aksariyat holatlar uchun bu yetarlicha aniq taxmin. Shuningdek,
 * sof foyda faqat mahsulot tannarxini hisobga oladi — P&L
 * Dashboard'da qo'lda kiritilgan OPEX/marketing xarajatlari bu yerda
 * KIRITILMAGAN (chunki ular kunlik emas, umumiy xarajat sifatida
 * saqlanadi) — xabar matnida bu ochiq aytiladi.
 */
exports.sendDailyPnLReport = onSchedule(
  { schedule: "0 21 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN] },
  async () => {
    const firestore = admin.firestore();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTimestamp = admin.firestore.Timestamp.fromDate(dayStart);

    const sellersSnap = await firestore.collection("sellers").get();

    for (const sellerDoc of sellersSnap.docs) {
      const seller = sellerDoc.data();
      if (seller.notifyDailyReport === false) continue;
      const sellerId = sellerDoc.id;

      try {
        const ordersSnap = await firestore.collection("orders")
          .where("sellerId", "==", sellerId)
          .where("createdAt", ">=", dayStartTimestamp)
          .get();

        const todaysOrders = ordersSnap.docs.map((d) => d.data());
        if (todaysOrders.length === 0) continue; // hech narsa bo'lmasa, xabar yuborilmaydi

        const deliveredToday = todaysOrders.filter((o) => o.status === "delivered");
        const revenue = deliveredToday.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

        const productsSnap = await firestore.collection("products").where("sellerId", "==", sellerId).get();
        const costPriceMap = new Map();
        productsSnap.forEach((p) => costPriceMap.set(p.id, Number(p.data().costPrice) || 0));

        let cogs = 0;
        deliveredToday.forEach((order) => {
          (order.orders || []).forEach((item) => {
            cogs += (costPriceMap.get(item.id) || 0) * (Number(item.quantity) || 0);
          });
        });

        const netProfit = revenue - cogs;

        const text = `📊 Kunlik hisobot\n\nBugungi buyurtmalar: ${todaysOrders.length} ta\nYetkazilganlar: ${deliveredToday.length} ta\nTushum: ${revenue.toLocaleString()} so'm\nTaxminiy sof foyda: ${netProfit.toLocaleString()} so'm\n\n(Faqat mahsulot tannarxi hisobga olindi — OPEX/marketing xarajatlari kirmagan, ularni "Foyda-Zarar" bo'limida ko'ring)`;
        await sendTelegramMessage(BOT_TOKEN.value(), sellerId, text);
      } catch (err) {
        console.error(`Kunlik hisobot xatosi (sotuvchi ${sellerId}):`, err);
      }
    }
  }
);
