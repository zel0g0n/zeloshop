/**
 * AI CEO — AUDIT LOG.
 *
 * ZeloShop — AI Business Operating System master prompti (AB-bo'lim,
 * "AUDIT LOG"): har bir muhim AI harakati uchun kim/nima/qachon/qaysi
 * do'kon/eski holat/yangi holat/tasdiqlash/ijro/natija/xato
 * yozilishi kerak. `sellers/{sellerId}/aiAuditLog`ga yoziladi -
 * `aiCeoPendingActions`/`aiCeoOutcomes` bilan BIR XIL xavfsizlik
 * naqshi (`firestore.rules`): sotuvchi/admin O'QIY oladi, YOZISH
 * har doim taqiqlangan (faqat Admin SDK orqali, bu qoidalardan
 * mustasno).
 *
 * MUHIM (ataylab qaror): audit yozuvi HECH QACHON asosiy oqimni
 * (harakatni tasdiqlash/rad etish/ijro etish) TO'XTATMASLIGI kerak -
 * shuning uchun `writeAuditLog` XATO TASHLAMAYDI (ichki try/catch).
 * Audit logi - kuzatuv vositasi, u ishlamay qolsa ham, sotuvchi/mijoz
 * uchun HAQIQIY funksionallik (masalan mijozga xabar yuborish)
 * to'xtab qolmasligi kerak - xuddi boshqa "best-effort" yordamchi
 * yozuvlar kabi (`aiCeoLearning.js`dagi kuzatuv yozuvlari bilan bir
 * xil tamoyil).
 */

function safeServerTimestamp(admin) {
  try {
    return admin.firestore.FieldValue.serverTimestamp();
  } catch {
    return null;
  }
}

/**
 * @param {object} db - Firestore instance (yoki mos mock)
 * @param {object} admin - `lib/admin.js`dan `admin` (FieldValue uchun)
 * @param {object} entry
 * @param {string} entry.sellerId
 * @param {string} entry.who - kim amalga oshirdi (masalan sellerId, "cron", "ai")
 * @param {string} entry.what - qisqa, inson o'qiydigan tavsif
 * @param {string} entry.actionId
 * @param {string} entry.actionType
 * @param {string} [entry.oldState]
 * @param {string} [entry.newState]
 * @param {object} [entry.approval] - {approvedBy}/{rejectedBy} kabi
 * @param {object} [entry.execution] - ijro tafsilotlari (masalan {sent, total})
 * @param {object} [entry.result]
 * @param {string} [entry.failure] - xato bo'lsa, xabari
 */
async function writeAuditLog(db, admin, entry) {
  try {
    const { sellerId, ...rest } = entry;
    await db
      .collection("sellers")
      .doc(sellerId)
      .collection("aiAuditLog")
      .add({
        shop: sellerId,
        ...rest,
        when: safeServerTimestamp(admin),
        whenMs: Date.now(),
      });
  } catch (err) {
    // Ataylab jim - yuqoridagi izohga qarang. Faqat serverga
    // logланади, chaqiruvchiga (va shu orqali sotuvchi/mijozga)
    // hech qanday ta'sir qilmaydi.
    console.error("AI CEO audit log yozib bo'lmadi (asosiy oqim davom etmoqda):", err);
  }
}

module.exports = { writeAuditLog };
