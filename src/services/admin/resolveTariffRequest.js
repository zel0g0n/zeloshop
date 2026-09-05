import { db } from "@/firebase/config";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";

/**
 * Admin panelidagi "Tarif so'rovlari" ro'yxatida bitta so'rovni hal
 * qiladi (`AdminTariffRequestsPage.jsx`). Ikkala amal ham BITTA
 * atomik `writeBatch` bilan bajariladi — shunda so'rov holati va
 * sotuvchi tarifi hech qachon bir-biridan uzilib qolmaydi:
 *
 *  - `action: "approve"` — so'rovni "approved" deb belgilaydi VA
 *    sotuvchining `tariffPlan`ini (+ `aiCeoEnabled`ni) so'ralgan
 *    tarifga o'rnatadi. Bu — to'lov TASHQARIDA (bank o'tkazmasi va
 *    h.k.) allaqachon kelishilgandan KEYIN bosiladi.
 *  - `action: "dismiss"` — faqat so'rov holatini "dismissed" qiladi,
 *    sotuvchi tarifiga UMUMAN TEGMAYDI (masalan to'lov kelishilmagan
 *    yoki sotuvchi fikridan qaytgan bo'lsa).
 */
const resolveTariffRequest = async (request, action, adminUid) => {
  if (!request?.id || !request?.sellerId) {
    throw new Error("So'rov ma'lumotlari to'liq emas.");
  }
  if (action !== "approve" && action !== "dismiss") {
    throw new Error(`Noto'g'ri amal: "${action}".`);
  }
  if (action === "approve" && !["pro", "biznes"].includes(request.requestedPlan)) {
    throw new Error(`So'ralgan tarif noto'g'ri: "${request.requestedPlan}".`);
  }

  try {
    const batch = writeBatch(db);

    batch.update(doc(db, "tariffRequests", request.id), {
      status: action === "approve" ? "approved" : "dismissed",
      resolvedAt: serverTimestamp(),
      resolvedBy: adminUid || null,
    });

    if (action === "approve") {
      batch.update(doc(db, "sellers", request.sellerId), {
        tariffPlan: request.requestedPlan,
        aiCeoEnabled: true, // "pro"/"biznes" — ikkalasi ham AI CEO'ga ega
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (error) {
    throw new Error(error.message || "So'rovni hal qilishda xatolik", { cause: error });
  }
};

export default resolveTariffRequest;
