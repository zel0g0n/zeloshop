import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/firebase/config";

// 2026-09 audit: OLDIN bu yerda hech qanday chegara yo'q edi — o'nlab
// minglab mijozga ega sotuvchida CRM sahifasi ochilganda BUTUN
// mijozlar kolleksiyasi (jonli tinglovchi sifatida) yuklanardi. Bu —
// AYNAN SHU muammoning `functions/aiCeoAgent.js`dagi
// `execGetCustomerSegments` (AI CEO tomoni) versiyasi bilan bir xil -
// o'sha yerda ALLAQACHON qo'llangan "xavfsizlik chegarasi +
// `isApproximate` bayrog'i" naqshi bu yerda ham qo'llanadi, izchillik
// uchun bir xil chegara (5000) bilan. `orderBy("ltv","desc")` — agar
// chegaraga yetilsa ham, ENG QIYMATLI (eng ko'p xarid qilgan)
// mijozlar birinchi navbatda ko'rinishi uchun (tasodifiy kesilgan
// ro'yxat o'rniga) - bu maydon `orderRollups.js`da HAR DOIM
// (standart 0 bilan) yoziladi, shuning uchun hech qanday mijoz
// "maydon yo'qligi" sababli ro'yxatdan tushib qolmaydi.
const CRM_CUSTOMERS_SAMPLE_LIMIT = 5000;

/**
 * CRM uchun mijozlar ro'yxati — server tomonida oldindan yig'ilgan
 * `sellers/{id}/customers/{clientId}` yozuvlaridan (batafsil izoh:
 * `functions/orderRollups.js`) o'qiladi, xom buyurtmalar ro'yxatidan
 * emas.
 *
 * Bu arxitektura tanlovi ataylab qilingan: sellerning barcha
 * buyurtmalarini brauzerda yuklab LTV/segmentatsiyani hisoblash (a)
 * eski xaridlarni istalgan vaqt chegarasidan tashqarida qoldirib,
 * haqiqiy umr bo'yi qiymatni noto'g'ri hisoblagan bo'lardi, va (b)
 * buyurtmalar soni o'sgan sari sekinlashadi. Server tomonidagi
 * rollup yondashuvi bilan bu hook faqat mijozlar soniga teng
 * (odatda buyurtmalar sonidan ancha kam) kichik yozuvlarni o'qiydi —
 * har biri allaqachon butun tarix bo'yicha to'g'ri LTV/buyurtmalar
 * sonini o'z ichiga oladi, vaqt chegarasisiz.
 *
 * Fayl nomi (`useCrmOrders.jsx`) tarixiy sababga ko'ra saqlanib
 * qolgan (`useCustomerSegments.jsx` shu yerdan import qiladi) —
 * ichki mazmuni bu nomdan mustaqil.
 */
const useCrmOrders = (sellerId) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproximate, setIsApproximate] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const customersQuery = query(
      collection(db, "sellers", sellerId, "customers"),
      orderBy("ltv", "desc"),
      limit(CRM_CUSTOMERS_SAMPLE_LIMIT)
    );
    const unsubscribe = onSnapshot(
      customersQuery,
      (snapshot) => {
        setCustomers(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              clientId: doc.id,
              fullName: data.fullName || "",
              phone: data.phone || "",
              ltv: Number(data.ltv) || 0,
              orderCount: Number(data.orderCount) || 0,
              lastOrderAtMs: Number(data.lastOrderAtMs) || 0,
              // CAC (mijoz jalb qilish narxi, P&L paneli) uchun - mijozning
              // ENG BIRINCHI xaridi qachon bo'lgani (batafsil izoh:
              // `functions/lib/rollups.js`). Migratsiyadan oldingi
              // mijozlarda bu maydon yo'q bo'lishi mumkin - shu holatda
              // `null` (soxta sana o'ylab topilmaydi).
              firstOrderAtMs: data.firstOrderAtMs ? Number(data.firstOrderAtMs) : null,
            };
          })
        );
        setIsApproximate(snapshot.docs.length >= CRM_CUSTOMERS_SAMPLE_LIMIT);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sellerId]);

  return { customers, loading, error, isApproximate };
};

export default useCrmOrders;
