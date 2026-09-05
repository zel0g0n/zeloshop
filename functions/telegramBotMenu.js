const crypto = require("crypto");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { buildDailyReport } = require("./aiCeo");

/**
 * Telegram bot "menyu" - platforma botida ("ZeloShop") ilgari faqat
 * "Do'konni ochish" (BotFather'da sozlangan Menu tugmasi) mavjud edi -
 * do'konni ochmasdan turib bajarish mumkin bo'lgan amal yo'q edi. Bu
 * fayl uchta yangi, Mini App'ni ochishni talab qilmaydigan (yoki
 * minimal talab qiladigan) amalni qo'shadi, hammasi sotuvchiga doimiy
 * ko'rinadigan Telegram "reply keyboard" (xabar kiritish maydoni
 * ustidagi tugmalar qatori, `setChatMenuButton`dan farqli - u yerda
 * faqat bitta tugma bo'lishi mumkin) orqali ishga tushiriladi:
 *
 *   1) "🆕 Yangi buyurtmalar" - "new" holatdagi buyurtmalar sonini
 *      tekshiradi; mavjud bo'lsa, ilovaning "Buyurtmalar" sahifasini
 *      to'g'ridan-to'g'ri ochadigan (`web_app` tugmasi) xabar yuboradi.
 *
 *   2) "📊 AI CEO hisobotlari" - `AiCeoInfoPage.jsx`dagi bilan bir xil,
 *      haqiqiy kunlik hisobotni (`aiCeo.js`dagi `buildDailyReport`,
 *      qayta ishlatiladi - yangi hisoblash yozilmaydi) darhol, Telegram
 *      xabari sifatida yuboradi.
 *
 *   3) "🤖 AI CEO bilan mahsulot qo'shish" - sotuvchi 4 tagacha rasm
 *      yuboradi ("✅ Tayyor" bilan yakunlaydi yoki 4-rasmdan keyin
 *      avtomatik), bir marta yakuniy tasdiqlash so'raladi, va
 *      tasdiqlangach mahsulot qoralamasi `sellers/{id}/productDrafts`
 *      kolleksiyasiga `status:"queued"` bilan yoziladi (bir xil shakl,
 *      `submitProductDraft`/"Tez qo'shish" bilan). Mahsulot darhol
 *      emas, sotuvchining o'zi sozlagan vaqtda (`aiCeoDraftProcessHour`,
 *      standart 21) `productDrafts.js`dagi mavjud, soatlik
 *      `processProductDrafts` jarayoni orqali tayyorlanadi - bu bot
 *      oqimi yangi Gemini chaqiruv mantig'i yozmaydi, faqat mavjud
 *      navbatga qo'shadi. Tayyor bo'lgach (belgilangan vaqtda), o'sha
 *      mavjud jarayonning o'zi bildirishnoma yuboradi; sotuvchi
 *      tasdiqlagach (ilova ichida, "Tasdiqlash kutilmoqda" bo'limida),
 *      mahsulot yaratiladi va (agar kanal ulangan bo'lsa)
 *      `productAutomation.js`dagi mavjud trigger orqali avtomatik
 *      kanal postiga aylanadi - bu yerda ham yangi mantiq yozilmaydi.
 *
 * Suhbat holati (rasm yig'ish/tasdiqlash jarayonining qayerdaligi)
 * sessiya hujjatida saqlanadi: `sellers/{sellerId}/private/aiCeoBotSession`
 * (mavjud "maxfiy" quyi kolleksiya naqshi - `firestore.rules`da
 * allaqachon faqat egasi/admin o'qiy oladigan qilib himoyalangan,
 * yangi qoida shart emas).
 *
 * Xavfsizlik: bu yerdagi har bir funksiya `sellerId`ni Telegram
 * `message.from.id`dan oladi - bu Telegram serveri tomonidan
 * tasdiqlangan (soxtalashtirib bo'lmaydigan) qiymat.
 *
 * Xarajat nazorati: (1) mahsulot qo'shish faqat `aiCeoEnabled === true`
 * sotuvchilar uchun; (2) bir kunda eng ko'pi bilan
 * `MAX_AI_PRODUCTS_PER_DAY` ta mahsulot, `checkRateLimit` orqali,
 * tasdiqlash bosqichida (bekor qilingan/hali tasdiqlanmagan urinishlar
 * chegaraga hisoblanmasligi uchun); (3) hisobot tugmasi ham engil
 * chegaralanadi (soatiga 20 marta).
 */

const MENU_NEW_ORDERS_TEXT = "🆕 Yangi buyurtmalar";
const MENU_REPORT_TEXT = "📊 AI CEO hisobotlari";
const MENU_ADD_PRODUCT_TEXT = "🤖 AI CEO bilan mahsulot qo'shish";
const FINISH_TEXT = "✅ Tayyor";
const CONFIRM_TEXT = "✅ Tasdiqlash";
const CANCEL_TEXT = "❌ Bekor qilish";

const MAX_PHOTOS = 4;
const MAX_AI_PRODUCTS_PER_DAY = 4;
const AI_PRODUCT_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * Asosiy menyu - har doim shu uch tugma ko'rinadi (mavjud "Do'konni
 * ochish" Menu tugmasidan farqli joyda, xabar kiritish maydoni
 * ustida). Sof funksiya.
 */
function buildMainMenuKeyboard() {
  return {
    keyboard: [[{ text: MENU_NEW_ORDERS_TEXT }], [{ text: MENU_REPORT_TEXT }], [{ text: MENU_ADD_PRODUCT_TEXT }]],
    resize_keyboard: true,
  };
}

/**
 * Rasm yig'ish bosqichidagi vaqtinchalik menyu. Sof funksiya.
 */
function buildPhotoCollectionKeyboard() {
  return { keyboard: [[{ text: FINISH_TEXT }, { text: CANCEL_TEXT }]], resize_keyboard: true };
}

/**
 * Yakuniy tasdiqlash bosqichidagi vaqtinchalik menyu. Sof funksiya.
 */
function buildConfirmationKeyboard() {
  return { keyboard: [[{ text: CONFIRM_TEXT }, { text: CANCEL_TEXT }]], resize_keyboard: true };
}

/**
 * Telegram `message.photo` massividan (bir nechta o'lchamdagi nusxa)
 * eng kattasini (eng yuqori sifat) tanlaydi. Sof funksiya.
 */
function pickLargestPhoto(photoSizes) {
  if (!Array.isArray(photoSizes) || photoSizes.length === 0) return null;
  return photoSizes.reduce((best, p) => ((p.width || 0) * (p.height || 0) > (best.width || 0) * (best.height || 0) ? p : best));
}

/**
 * `aiCeo.js`dagi `buildDailyReport()` natijasini Telegram xabari
 * matniga aylantiradi - `AiCeoInfoPage.jsx`dagi kartochkalar bilan bir
 * xil ma'lumot, faqat matn ko'rinishida. Sof funksiya - to'g'ridan-
 * to'g'ri test qilinadi.
 */
function formatDailyReportForTelegram(report, storeName) {
  const f = report.financial;
  const changeText = f.revenueChangePercent === null
    ? "solishtirish uchun yetarli ma'lumot yo'q"
    : `${f.revenueChangePercent >= 0 ? "+" : ""}${f.revenueChangePercent.toFixed(0)}%`;

  const lines = [
    `🤖 *AI CEO — Kunlik hisobot*${storeName ? ` (${storeName})` : ""}`,
    "",
    "💰 *Moliya*",
    `Bugun: ${f.todayRevenue.toLocaleString()} so'm (${f.todayOrderCount} ta buyurtma, ${f.todayDeliveredCount} tasi yetkazilgan)`,
    `Kecha: ${f.yesterdayRevenue.toLocaleString()} so'm`,
    `O'zgarish: ${changeText}`,
  ];

  const { discountCandidates, promoteCandidates } = report.productRecommendations;
  if (discountCandidates.length > 0 || promoteCandidates.length > 0) {
    lines.push("", "🛍 *Mahsulot tavsiyalari*");
    if (discountCandidates.length > 0) lines.push(`Chegirma nomzodlari: ${discountCandidates.map((p) => p.name).join(", ")}`);
    if (promoteCandidates.length > 0) lines.push(`Eng ko'p sotilgan: ${promoteCandidates.map((p) => `${p.name} (${p.soldQty} dona)`).join(", ")}`);
  }

  if (report.productAdditions.addedTodayCount > 0) {
    lines.push("", `🆕 Bugun qo'shilgan: ${report.productAdditions.addedTodayCount} ta mahsulot (${report.productAdditions.salesFromNewProducts.toLocaleString()} so'm sotuv)`);
  }

  const crm = report.crmActivity;
  const totalCrmSent = crm.cartRemindersSent + crm.favoriteRemindersSent + crm.repurchaseRemindersSent + crm.crmMessagesSent;
  lines.push(
    "",
    "📣 *CRM faoliyati*",
    `Yuborilgan xabarlar: ${totalCrmSent} (konversiya: ${crm.convertedCount} ta xarid)`,
    `Faol mijozlar: ${crm.activeCustomers}, Nofaol: ${crm.inactiveCustomers}`,
  );
  if (crm.aiAutoActionsCount > 0) lines.push(`AI CEO avtomatik yuborgan xabarlar: ${crm.aiAutoActionsCount}`);
  if (crm.autoDiscountsIssuedCount > 0) lines.push(`AI CEO avtomatik chegirmalar: ${crm.autoDiscountsIssuedCount}`);

  const { vipCount, churnCount } = report.attentionNeeded;
  if (vipCount > 0 || churnCount > 0) {
    lines.push("", `⚠️ Diqqat talab qiladi: VIP ${vipCount} ta, uxlab qolgan ${churnCount} ta mijoz`);
  }

  if (report.aiActionPlan?.reasoning) {
    lines.push("", `_AI CEO tavsiyasi: ${report.aiActionPlan.reasoning}_`);
  }

  return lines.join("\n");
}

/**
 * Telegram `getFile` + fayl yuklab olish API'si orqali, rasm baytlarini
 * qaytaradi. Telegram fayl havolalari vaqtinchalik (odatda ~1 soat) -
 * shuning uchun darhol yuklab olib, o'zimizning Storage'imizga
 * ko'chirish shart (`downloadUrl`ni to'g'ridan-to'g'ri saqlab
 * bo'lmaydi).
 */
async function downloadTelegramPhoto(token, fileId) {
  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error(fileData.description || "Telegram fayl ma'lumotini olib bo'lmadi.");

  const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
  if (!downloadRes.ok) throw new Error("Telegram'dan rasmni yuklab olib bo'lmadi.");
  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  return buffer;
}

/**
 * Rasm baytlarini Firebase Storage'ga (`products/{sellerId}/...` -
 * `storage.rules`dagi mavjud, mahsulot rasmlari uchun ochilgan yo'l
 * bilan bir xil) yozadi va client SDK bilan mos, ommaviy o'qiladigan
 * havola (`firebaseStorageDownloadTokens` orqali) qaytaradi - xuddi
 * mijoz ilova ichidan rasm yuklaganda olinadigan havola shakli bilan
 * bir xil (shu orqali bu rasm keyinchalik oddiy mahsulot rasmi kabi,
 * hech qanday maxsus holatsiz ishlaydi).
 */
async function uploadPhotoToStorage(sellerId, buffer, index) {
  const bucket = admin.storage().bucket();
  const fileName = `products/${sellerId}/aiceo-bot-${Date.now()}-${index}.jpg`;
  const file = bucket.file(fileName);
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: downloadToken } },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;
}

function sessionRef(sellerId) {
  return db.collection("sellers").doc(sellerId).collection("private").doc("aiCeoBotSession");
}

/**
 * `lib/helpers.js`dagi `sendTelegramMessage`ning qisqa moslamasi -
 * bu fayldagi barcha javoblar doimiy "reply keyboard" (`keyboard`,
 * `inline_keyboard` emas) bilan yuboriladi. `sendTelegramMessage`
 * o'zi allaqachon Markdown xato bo'lsa (masalan sotuvchi/mijoz nomida
 * `*`/`_` kabi belgi bo'lsa) oddiy matn sifatida qayta urinish
 * mexanizmiga ega - shu orqali xabar hech qachon "yo'qolib
 * qolmaydi".
 */
async function sendReply(token, chatId, text, keyboard) {
  await sendTelegramMessage(token, chatId, text, { replyMarkup: keyboard });
}

/**
 * "🆕 Yangi buyurtmalar" tugmasi bosilganda - "new" holatdagi
 * buyurtmalar sonini (`count()` - hujjatlarning o'zini o'qimasdan,
 * arzon) tekshiradi. Mavjud bo'lsa, ilovaning "Buyurtmalar" sahifasini
 * to'g'ridan-to'g'ri ochadigan (Mini App `web_app` tugmasi) xabar
 * yuboradi (chatda har bir buyurtmani alohida ko'rsatish o'rniga).
 *
 * Bu so'rov mavjud `{sellerId ASC, status ASC}` kompozit indeksi
 * bilan qoplanadi (`firestore.indexes.json`da avvaldan bor) - yangi
 * indeks yoki deploy qadami shart emas.
 */
async function handleNewOrdersButton(token, sellerId, chatId) {
  try {
    const countSnap = await db.collection("orders")
      .where("sellerId", "==", sellerId)
      .where("status", "==", "new")
      .count()
      .get();
    const count = countSnap.data().count;

    if (count === 0) {
      await sendReply(token, chatId, "Hozircha yangi buyurtma yo'q.", buildMainMenuKeyboard());
      return;
    }

    await sendTelegramMessage(token, chatId, `🆕 Sizda ${count} ta yangi buyurtma bor.`, {
      inlineKeyboard: [[{ text: "📦 Buyurtmalarni ko'rish", web_app: { url: buildSellerAppLink("/seller/orders") } }]],
    });
  } catch (err) {
    console.error(`Bot orqali yangi buyurtmalar sonini tekshirishda xatolik (sotuvchi ${sellerId}):`, err);
    await sendReply(token, chatId, "Buyurtmalarni tekshirishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", buildMainMenuKeyboard());
  }
}

/**
 * "📊 AI CEO hisobotlari" tugmasi bosilganda.
 */
async function handleReportButton(token, sellerId, chatId) {
  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    await sendReply(token, chatId, "Bu funksiya faqat AI CEO premium mijozlari uchun mavjud.", buildMainMenuKeyboard());
    return;
  }

  try {
    await checkRateLimit(`aiCeoBotReport:${sellerId}`, 20, 3600);
  } catch (err) {
    await sendReply(token, chatId, err.message, buildMainMenuKeyboard());
    return;
  }

  try {
    const report = await buildDailyReport(sellerId, sellerSnap.data());
    const text = formatDailyReportForTelegram(report, sellerSnap.data().storeName);
    await sendReply(token, chatId, text, buildMainMenuKeyboard());
  } catch (err) {
    console.error(`Bot orqali kunlik hisobot xatosi (sotuvchi ${sellerId}):`, err);
    await sendReply(token, chatId, "Hisobotni tayyorlashda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", buildMainMenuKeyboard());
  }
}

/**
 * "🤖 AI CEO bilan mahsulot qo'shish" tugmasi bosilganda - rasm
 * yig'ish sessiyasini boshlaydi. Sotuvchining o'zi sozlagan AI CEO
 * qayta ishlash soatini (`aiCeoDraftProcessHour`) sessiya hujjatiga
 * yozib qo'yamiz - keyingi bosqichlarda (tasdiqlash xabarlarida)
 * qayta Firestore so'rovi qilmasdan ishlatish uchun.
 *
 * Kunlik 4 tagacha cheklov bu yerda emas, faqat haqiqiy tasdiqlashda
 * (`handleConfirmButton`) tekshiriladi - shu orqali sotuvchi boshlab,
 * bekor qilgan yoki hali tasdiqlanmagan urinishlar chegaraga
 * hisoblanmaydi.
 */
async function handleAddProductButton(token, sellerId, chatId) {
  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    await sendReply(token, chatId, "Bu funksiya faqat AI CEO premium mijozilari uchun mavjud.", buildMainMenuKeyboard());
    return;
  }

  const preferredHour = Number.isInteger(sellerSnap.data().aiCeoDraftProcessHour) ? sellerSnap.data().aiCeoDraftProcessHour : 21;

  await sessionRef(sellerId).set({
    mode: "awaiting_photos",
    photoUrls: [],
    preferredHour,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await sendReply(
    token, chatId,
    `Mahsulot rasmlarini yuboring (${MAX_PHOTOS} tagacha). Tugatgach, "${FINISH_TEXT}" tugmasini bosing.`,
    buildPhotoCollectionKeyboard()
  );
}

/**
 * Sotuvchining `aiCeoDraftProcessHour`ini "HH:00" shaklida formatlaydi
 * - frontenddagi `QuickAddAICard.jsx`ning `processHourLabel`i bilan
 * bir xil formatda (izchillik uchun). Sof funksiya.
 */
function formatHourLabel(hour) {
  const h = Number.isInteger(hour) ? hour : 21;
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * Rasm yig'ish tugagach (4-rasmdan keyin avtomatik, yoki "Tayyor"
 * qo'lda bosilganda) - sessiyani "tasdiqlash" bosqichiga o'tkazadi va
 * bir marta, yakuniy tasdiqlash so'raydi. Hali hech narsa (Firestore
 * yozuvi, Gemini) darhol sodir bo'lmaydi - faqat sotuvchi "✅ Tasdiqlash"
 * bosgach (`handleConfirmButton`).
 */
async function promptForConfirmation(token, sellerId, chatId, photoCount, preferredHour) {
  await sessionRef(sellerId).update({ mode: "awaiting_confirmation" });
  await sendReply(
    token, chatId,
    `${photoCount} ta rasm qabul qilindi. AI CEO shu rasmlar asosida mahsulot tayyorlashini boshlashni tasdiqlaysizmi? (Mahsulot bugungi navbatda, soat ${formatHourLabel(preferredHour)} da tayyor bo'ladi.)`,
    buildConfirmationKeyboard()
  );
}

/**
 * Rasm yig'ish jarayonida kelgan har bir rasm uchun. Har bir rasm
 * uchun alohida "qabul qilindi" xabari yuborilmaydi (suhbatni ortiqcha
 * xabarlar bilan to'ldirmaslik uchun) - sotuvchi ketma-ket rasm
 * yuboraveradi; 4-rasmdan keyin (yoki "Tayyor" qo'lda bosilganda)
 * bir marta, yakuniy tasdiqlash so'raladi.
 */
async function handlePhotoMessage(token, sellerId, chatId, message) {
  const ref = sessionRef(sellerId);
  const snap = await ref.get();
  const session = snap.exists ? snap.data() : null;
  if (!session || session.mode !== "awaiting_photos") return; // sessiya yo'q yoki boshqa bosqichda - jim e'tiborsiz qoldiramiz

  // Rasm sonini `ref.update()` chaqirilishidan oldin, bitta mahalliy
  // o'zgaruvchiga ("priorCount") "suratga olamiz" - shu orqali
  // keyingi hisob-kitob (`newCount`) doimo izchil, `session.photoUrls`
  // obyekti keyinroq (masalan sinov mock'ida) o'zgartirilishidan
  // mustaqil bo'ladi.
  const priorCount = (session.photoUrls || []).length;
  if (priorCount >= MAX_PHOTOS) {
    await sendReply(token, chatId, `Eng ko'pi bilan ${MAX_PHOTOS} ta rasm qabul qilinadi. "${FINISH_TEXT}" tugmasini bosing.`, buildPhotoCollectionKeyboard());
    return;
  }

  const largest = pickLargestPhoto(message.photo);
  if (!largest) return;

  try {
    const buffer = await downloadTelegramPhoto(token, largest.file_id);
    const url = await uploadPhotoToStorage(sellerId, buffer, priorCount);
    await ref.update({ photoUrls: admin.firestore.FieldValue.arrayUnion(url) });

    const newCount = priorCount + 1;
    if (newCount >= MAX_PHOTOS) {
      await promptForConfirmation(token, sellerId, chatId, newCount, session.preferredHour);
    }
  } catch (err) {
    console.error(`Bot orqali rasm qabul qilishda xatolik (sotuvchi ${sellerId}):`, err);
    await sendReply(token, chatId, "Rasmni qabul qilishda xatolik yuz berdi. Qaytadan yuborib ko'ring.", buildPhotoCollectionKeyboard());
  }
}

/**
 * "✅ Tayyor" bosilganda - agar kamida bitta rasm bo'lsa, yakuniy
 * tasdiqlash so'raladi (`promptForConfirmation`); aks holda kamida
 * bitta rasm so'raladi.
 */
async function handleFinishButton(token, sellerId, chatId) {
  const ref = sessionRef(sellerId);
  const snap = await ref.get();
  const session = snap.exists ? snap.data() : null;
  if (!session || session.mode !== "awaiting_photos") return; // faqat rasm yig'ish bosqichida ishlaydi

  const photoUrls = session.photoUrls || [];
  if (photoUrls.length === 0) {
    await sendReply(token, chatId, "Hali birorta ham rasm yubormadingiz. Avval kamida bitta rasm yuboring.", buildPhotoCollectionKeyboard());
    return;
  }

  await promptForConfirmation(token, sellerId, chatId, photoUrls.length, session.preferredHour);
}

/**
 * "✅ Tasdiqlash" bosilganda (faqat "awaiting_confirmation" bosqichida
 * ishlaydi) - yig'ilgan rasmlar bilan `sellers/{id}/productDrafts`ga
 * `status:"queued"` qoralama yozadi (bir xil shakl, "Tez qo'shish"
 * bilan) va jarayonni tugatadi. Mahsulot bu yerda darhol ishlanmaydi -
 * `productDrafts.js`dagi mavjud, soatlik `processProductDrafts`
 * jarayoni buni sotuvchining o'zi belgilagan vaqtda
 * (`aiCeoDraftProcessHour`) qayta ishlaydi, o'sha jarayonning o'zi
 * bildirishnoma yuboradi. Shu orqali bu bot oqimi hech qanday yangi
 * Gemini chaqiruv mantig'ini duplikatsiya qilmaydi.
 *
 * Xarajat nazorati: kunlik 4 ta mahsulot chegarasi aynan shu yerda,
 * navbatga qo'shishdan oldin tekshiriladi.
 */
async function handleConfirmButton(token, sellerId, chatId) {
  const ref = sessionRef(sellerId);
  const snap = await ref.get();
  const session = snap.exists ? snap.data() : null;
  if (!session || session.mode !== "awaiting_confirmation") return; // tasodifiy/eskirgan bosishlarni e'tiborsiz qoldiramiz

  const photoUrls = session.photoUrls || [];
  const preferredHour = session.preferredHour;

  try {
    await checkRateLimit(`aiCeoBotProduct:${sellerId}`, MAX_AI_PRODUCTS_PER_DAY, AI_PRODUCT_WINDOW_SECONDS);
  } catch {
    await sendReply(
      token, chatId,
      `🚫 Kunlik chegara: AI CEO orqali bir kunda faqat ${MAX_AI_PRODUCTS_PER_DAY} tagacha mahsulot qo'shish mumkin. Ertaga qayta urinib ko'ring (yoki ilova ichidagi "Tez qo'shish" navbatidan foydalaning).`,
      buildMainMenuKeyboard()
    );
    await ref.delete();
    return;
  }

  await ref.delete(); // sessiya tugadi - keyingi urinish yangi sessiya bilan boshlanadi

  await db.collection("sellers").doc(sellerId).collection("productDrafts").add({
    imageUrls: photoUrls,
    rawHint: "",
    status: "queued",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await sendReply(
    token, chatId,
    `✅ Qabul qilindi! Mahsulotingiz bugungi navbatda, soat ${formatHourLabel(preferredHour)} da AI CEO tomonidan tayyorlanadi va tasdiqlashingizni kutadi.\n\nTayyor bo'lgach, sizga alohida xabar yuboriladi.`,
    buildMainMenuKeyboard()
  );
}

async function handleCancelButton(token, sellerId, chatId) {
  await sessionRef(sellerId).delete();
  await sendReply(token, chatId, "Bekor qilindi.", buildMainMenuKeyboard());
}

/**
 * Telegram webhook'ga kelgan `message` turidagi yangilanish uchun
 * asosiy yo'naltiruvchi - `telegramCallbackWebhook`dan chaqiriladi.
 * Faqat haqiqiy sotuvchilardan (mavjud `sellers/{id}` hujjati bor)
 * kelgan xabarlarga javob beradi - boshqa har qanday xabar jim
 * e'tiborsiz qoldiriladi (masalan, kimdir botga tasodifan yozsa).
 */
async function handleTelegramMessage(token, message) {
  const sellerId = String(message?.from?.id || "");
  const chatId = message?.chat?.id;
  if (!sellerId || !chatId) return;

  if (message.photo) {
    await handlePhotoMessage(token, sellerId, chatId, message);
    return;
  }

  const text = (message.text || "").trim();
  if (!text) return;

  if (text === "/start") {
    const sellerSnap = await db.collection("sellers").doc(sellerId).get();
    if (!sellerSnap.exists) return; // faqat sotuvchilar - mijozlar bu bot bilan gaplashmaydi
    await sendReply(token, chatId, "Assalomu alaykum! Quyidagi tugmalardan birini tanlang.", buildMainMenuKeyboard());
    return;
  }

  if (text === MENU_NEW_ORDERS_TEXT) {
    await handleNewOrdersButton(token, sellerId, chatId);
    return;
  }
  if (text === MENU_REPORT_TEXT) {
    await handleReportButton(token, sellerId, chatId);
    return;
  }
  if (text === MENU_ADD_PRODUCT_TEXT) {
    await handleAddProductButton(token, sellerId, chatId);
    return;
  }
  if (text === FINISH_TEXT) {
    await handleFinishButton(token, sellerId, chatId);
    return;
  }
  if (text === CONFIRM_TEXT) {
    await handleConfirmButton(token, sellerId, chatId);
    return;
  }
  if (text === CANCEL_TEXT) {
    await handleCancelButton(token, sellerId, chatId);
    return;
  }
  // Boshqa erkin matn - sessiya rasm/tasdiqlash kutayotgan bo'lsa, eslatib qo'yamiz.
  const session = await sessionRef(sellerId).get();
  if (session.exists && session.data().mode === "awaiting_photos") {
    await sendReply(token, chatId, `Iltimos, rasm yuboring yoki "${FINISH_TEXT}"/"${CANCEL_TEXT}" tugmasini bosing.`, buildPhotoCollectionKeyboard());
  } else if (session.exists && session.data().mode === "awaiting_confirmation") {
    await sendReply(token, chatId, `Iltimos, "${CONFIRM_TEXT}" yoki "${CANCEL_TEXT}" tugmasini bosing.`, buildConfirmationKeyboard());
  }
}

module.exports = {
  MENU_NEW_ORDERS_TEXT, MENU_REPORT_TEXT, MENU_ADD_PRODUCT_TEXT, FINISH_TEXT, CONFIRM_TEXT, CANCEL_TEXT,
  MAX_PHOTOS, MAX_AI_PRODUCTS_PER_DAY,
  buildMainMenuKeyboard, buildPhotoCollectionKeyboard, buildConfirmationKeyboard, pickLargestPhoto,
  formatDailyReportForTelegram, handleTelegramMessage,
  _testables: {
    downloadTelegramPhoto, uploadPhotoToStorage, formatHourLabel,
    handleReportButton, handleAddProductButton, handlePhotoMessage, handleCancelButton,
    handleNewOrdersButton, handleFinishButton, handleConfirmButton,
  },
};
