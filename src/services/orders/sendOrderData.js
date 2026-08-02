import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

// OLDIN: bu xizmat to'g'ridan-to'g'ri Firestore'ga yozardi — mahsulot
// narxlari, promokod chegirmasi va umumiy summa MIJOZ BRAUZERIDA
// hisoblanib, hech qanday server tomonidagi tekshiruvsiz saqlanardi.
// ENDI: bu — xavfsiz `createOrder` Cloud Function'ini chaqiradi, u esa
// narx/promokodni HAQIQIY Firestore ma'lumotidan qayta hisoblaydi.
// Funksiya imzosi (parametrlar) eskisi bilan bir xil qoldirildi —
// shuning uchun uni chaqiradigan boshqa kod (Redux thunk, hook)
// o'zgarishi shart emas.
const sendOrder = async (customerData, cartData, sellerId, userID) => {
  try {
    const items = cartData.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    }));

    const callable = httpsCallable(functions, "createOrder");
    const { data } = await callable({
      sellerId,
      customerData,
      items,
      couponCode: customerData?.couponCode || null,
      deliveryZoneKey: customerData?.deliveryZoneKey || null,
    });

    return {
      id: data.orderId,
      sellerId,
      clientId: userID,
      customer: customerData,
      orders: cartData,
      status: "new",
      subtotal: data.subtotal,
      appliedCoupon: data.appliedCoupon,
      deliveryZone: data.deliveryZone,
      totalAmount: data.totalAmount,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Order sending error in service:", error);
    throw new Error(error.message || "Buyurtma jo'natishda xatolik yuz berdi");
  }
};

export default sendOrder;
