import { db } from "@/firebase/config.js";
import { collection, query, where, limit } from "firebase/firestore";
import { subscribeWithFastInitial } from "@/services/shared/subscribeWithFastInitial";

// 2026-09 audit: bu — do'konning MIJOZGA ko'rinadigan BUTUN katalogi
// (Bosh sahifa, Katalog qidiruv/filtr, Bog'liq mahsulotlar, Checkout
// cross-sell — barchasi `CatalogFilterContext` orqali shu ro'yxatni
// XOTIRADA (mijoz qurilmasida) qidiradi/filtrlaydi). Shu sababli
// bu yerga oddiy `limit(30)` kabi kichik sahifalash qo'shib bo'lmaydi —
// bu mijozning qidiruv/filtr natijalarini JIMGINA (hech qanday
// ko'rinadigan xatosiz) to'liq buzardi (masalan 31-mahsulotni hech
// qachon topa olmas edi). Haqiqiy server-tomonidagi sahifalash +
// qidiruv arxitekturasi (admin sotuvchilar ro'yxatidagi kabi) —
// butun Katalog qatlamini (Context, filtr, qidiruv, bog'liq
// mahsulotlar) qayta loyihalashni talab qiladigan, ancha kattaroq
// vazifa bo'lardi.
//
// Shuning uchun bu yerda faqat XAVFSIZLIK ZAXIRASI sifatida yuqori
// chegara qo'yiladi — ODATIY (kichik/o'rta) do'kon uchun bu chegaraga
// HECH QACHON yetilmaydi (haqiqiy UX o'zgarmaydi), lekin g'ayritabiiy
// katta (masalan xato/hujum natijasida minglab mahsulot yaratilgan)
// holatda ilova cheksiz o'sishdan himoyalangan bo'ladi.
const SHOP_CATALOG_SAFETY_CAP = 3000;

// OLDIN: BUTUN "products" kolleksiyasi (barcha sotuvchilarning barcha
// mahsulotlari) yuklanardi, hech qanday sotuvchi bo'yicha filtrsiz.
// Bu — ilovaning ENG MUHIM izolyatsiya talabini buzardi. Endi FAQAT
// shu sotuvchining mahsulotlari Firestore darajasida (`where`)
// filtrlanadi.
//
// KEYINGI TUZATISH: OLDIN bu — bir martalik `getDocs()` edi. Bu
// degani, sotuvchi biror mahsulotni O'CHIRGANDA yoki BUYURTMA
// YETKAZILIB, ombor kamayganda — mijoz tomonida bu O'ZGARISHLAR
// sahifa QAYTA YUKLANMAGUNCHA ko'RINMASDI (eskirgan ma'lumot
// ko'rsatilardi). Endi — boshqa real-vaqtli xizmatlar kabi —
// `subscribeWithFastInitial` orqali (tez, bir martalik o'qish +
// fon rejimida jonli ulanish), o'zgarishlar DARHOL ko'rinadi.
const mapProductDoc = (doc) => ({ ...doc.data(), id: doc.id });

const getProducts = (sellerId, onSuccess, onError) => {
  if (!sellerId) {
    onSuccess([]);
    return () => {};
  }
  const scopedQuery = query(
    collection(db, "products"),
    where("sellerId", "==", sellerId),
    limit(SHOP_CATALOG_SAFETY_CAP)
  );
  return subscribeWithFastInitial(scopedQuery, mapProductDoc, onSuccess, onError);
};

export default getProducts;
