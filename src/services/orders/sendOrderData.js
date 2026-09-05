import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

// Bu xizmat to'g'ridan-to'g'ri Firestore'ga yozmaydi — `createOrder`
// Cloud Function'ini chaqiradi, u esa mahsulot narxi, promokod
// chegirmasi va umumiy summani Firestore'dagi haqiqiy ma'lumot
// asosida serverda qayta hisoblaydi. Bu, mijoz brauzerida hisoblangan
// qiymatlarga tekshiruvsiz ishonib qolishning oldini oladi.
const sendOrder = async (customerData, cartData, sellerId, userID) => {
  try {
    const items = cartData.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    }));

    const callable = httpsCallable(functions, "createOrder");
    // Backend (`createOrder` Cloud Function) yetkazib berish narxini
    // hisoblash uchun `customerRegion` maydonini kutadi — eski
    // `deliveryZoneKey` maydoni backendda o'qilmaydi, shuning uchun bu
    // yerda yuborilmaydi.
    const { data } = await callable({
      sellerId,
      customerData,
      items,
      couponCode: customerData?.couponCode || null,
      customerRegion: customerData?.customerRegion || null,
      // Sodiqlik dasturi ("Bonus hisobi") - mijoz checkout'da
      // ishlatmoqchi bo'lgan bonus miqdori. Backend buni HAQIQIY
      // balans/sotuvchi sozlamasidan qayta tekshiradi/cheklaydi -
      // batafsil izoh: `functions/orders.js`.
      redeemBonusAmount: Number(customerData?.redeemBonusAmount) > 0 ? Number(customerData.redeemBonusAmount) : null,
      // Mahsulot bandllari (combo takliflar) - mijoz mahsulot
      // sahifasida "combo sifatida qo'shish" tugmasini bosgan bo'lsa.
      // Backend combo'ning HALI HAM yaroqliligini (barcha mahsulotlar
      // savatda bormi) va chegirmani QAYTA tekshiradi/hisoblaydi.
      bundleId: customerData?.bundleId || null,
      // "Bo'lib to'lash" — mijoz sotuvchi belgilagan qismlar soniga
      // ROZI bo'lsa yuboriladi. Backend bu qiymat sotuvchining
      // haqiqiy `installmentParts` sozlamasiga ANIQ mos kelishini
      // tekshiradi — mos kelmasa yoki funksiya o'chirilgan bo'lsa,
      // xatosiz oddiy to'liq to'lovga qaytadi (`functions/orders.js`).
      installments: Number(customerData?.installments) > 0 ? Number(customerData.installments) : null,
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
      bonusRedeemed: data.bonusRedeemed,
      appliedBundle: data.appliedBundle,
      deliveryZone: data.deliveryZone,
      totalAmount: data.totalAmount,
      installmentPlan: data.installmentPlan,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Order sending error in service:", error);
    throw new Error(error.message || "Buyurtma jo'natishda xatolik yuz berdi", { cause: error });
  }
};

export default sendOrder;
