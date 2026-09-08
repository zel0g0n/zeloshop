import { db } from "@/firebase/config";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

// OLDIN: bu funksiya asl mahsulotning BUTUN ma'lumotini (shu jumladan
// uning `sellerId`sini) ko'r-ko'rona nusxalardi. Amalda Firestore
// qoidasi ("create" faqat sellerId==auth.uid bo'lsa) buni baribir
// bloklardi — lekin kod o'zi bunga tayanmasligi, aniq tekshirishi
// kerak edi (himoyani faqat bitta qatlamga qoldirmaslik).
const duplicateProduct = async (productId, currentSellerId) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");
  if (!currentSellerId) throw new Error("Sotuvchi ID topilmadi.");
  try {
    const snap = await getDoc(doc(db, "products", productId));
    if (!snap.exists()) throw new Error("Mahsulot topilmadi.");

    const data = snap.data();

    if (data.sellerId !== currentSellerId) {
      throw new Error("Bu mahsulot sizga tegishli emas.");
    }

    // `lastSoldAtMs` ham asl mahsulotdan NUSXALANMAYDI — aks holda
    // nusxa mahsulot darhol "kam sotilayotgan" (`slow_moving_product`
    // avtomatlashtirish trigger'i) deb belgilanib qolishi mumkin edi.
    const { id: _ignored, createdAt: _ignoredCreatedAt, sellerId: _ignoredSellerId, lastSoldAtMs: _ignoredLastSoldAtMs, ...rest } = data;

    const newDoc = await addDoc(collection(db, "products"), {
      ...rest,
      sellerId: currentSellerId,
      name: `${data.name || "Mahsulot"} (nusxa)`,
      sold: 0,
      lastSoldAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });

    return { id: newDoc.id };
  } catch (error) {
    throw new Error(error.message || "Mahsulotni nusxalashda xatolik yuz berdi", { cause: error });
  }
};

export default duplicateProduct;
