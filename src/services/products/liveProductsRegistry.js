import getProducts from "./getProducts";

/**
 * XAVFSIZLIK/SAMARADORLIK AUDITI (2026-09, caching audit): bitta
 * sotuvchining mahsulot ro'yxatiga BIR NECHTA komponent (Bosh sahifa,
 * Katalog filtri, Bog'liq mahsulotlar, Checkout cross-sell) bir
 * vaqtning o'zida `useLiveShopProducts(sellerId)` orqali obuna
 * bo'lishi mumkin edi — har biri O'Z ALOHIDA Firestore `onSnapshot`
 * tinglovchisini (va boshlang'ich `getDocs` o'qishini) ochardi. Amalda
 * bu bitta sahifada bir xil so'rov uchun 4 tagacha PARALEL Firestore
 * o'qish/tinglovchi degani edi.
 *
 * Bu registry — sotuvchi (`sellerId`) bo'yicha FAQAT BITTA haqiqiy
 * Firestore tinglovchisini ushlab turadi (REF-COUNTED: nechta
 * iste'molchi (subscriber) obuna bo'lgani hisoblanadi), va kelgan har
 * bir yangilanishni BARCHA iste'molchilarga uzatadi. Oxirgi
 * iste'molchi ham obunani bekor qilganda ( `subscribers.size === 0`),
 * haqiqiy Firestore tinglovchisi ham to'xtatiladi va registry'dan
 * o'chiriladi.
 *
 * MUHIM: bu — `useLiveShopProducts.jsx`dagi ESKI izohda tilga olingan
 * xavfni ("bitta komponent unmount bo'lsa, ma'lumot ABADIY eskirib
 * qolishi mumkin edi") QAYTA TUG'DIRMAYDI. O'sha xavf oddiy "allaqachon
 * yuklangan, qayta so'ramaymiz" bayrog'iga xos edi (bunda birinchi
 * obuna bekor bo'lsa, boshqa hech kim obuna bo'lmasdan qolishi mumkin
 * edi). Bu yerda esa REF-COUNT ishlatiladi: obuna FAQAT VA FAQAT hech
 * kim tinglamay qolganda to'xtaydi — kamida bitta iste'molchi bor
 * ekan, haqiqiy Firestore tinglovchisi doim FAOL bo'lib qoladi.
 *
 * Bonus: keyinroq qo'shilgan iste'molchi (masalan foydalanuvchi
 * Katalog sahifasiga o'tganda, Bosh sahifa allaqachon obuna bo'lgan
 * bo'lsa) Firestore'dan yangi javob kelishini KUTMAY, ALLAQACHON
 * mavjud ma'lumotni DARHOL oladi (stale-while-revalidate'ga o'xshash:
 * cache hit -> darhol UI, keyingi Firestore yangilanishi -> UI
 * yangilanadi).
 */
const registry = new Map();

export function subscribeSharedProducts(sellerId, onData, onError) {
  if (!sellerId) {
    onData([]);
    return () => {};
  }

  let entry = registry.get(sellerId);
  if (!entry) {
    entry = { subscribers: new Set(), latestData: null, hasData: false, unsubscribe: null };
    registry.set(sellerId, entry);
    entry.unsubscribe = getProducts(
      sellerId,
      (products) => {
        entry.latestData = products;
        entry.hasData = true;
        entry.subscribers.forEach((subscriber) => subscriber.onData(products));
      },
      (error) => {
        entry.subscribers.forEach((subscriber) => subscriber.onError?.(error));
      }
    );
  } else if (entry.hasData) {
    queueMicrotask(() => {
      // Shu orada (mikrotask navbatida turgan paytda) oxirgi
      // iste'molchi ham bo'lib, registry yozuvi allaqachon o'chirilgan
      // bo'lishi mumkin — shu holatda hech narsa qilmaymiz.
      if (registry.get(sellerId) === entry) onData(entry.latestData);
    });
  }

  const subscriber = { onData, onError };
  entry.subscribers.add(subscriber);

  return () => {
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0) {
      entry.unsubscribe();
      registry.delete(sellerId);
    }
  };
}

/** FAQAT TESTLAR UCHUN: registryni to'liq tozalaydi. */
export function __resetProductsRegistryForTests() {
  registry.clear();
}
