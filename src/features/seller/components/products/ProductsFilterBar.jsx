import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * MUHIM O'ZGARISH: kategoriya filtri bu yerdan OLIB TASHLANDI va
 * `ProductsHeader.jsx`dagi alohida dropdown tugmasiga ko'chirildi.
 * Sabab: status (Barchasi/Faol/Nofaol/Stok kam) va kategoriya —
 * IKKI XIL filtr o'lchovi bo'lib, ularni bitta gorizontal chip
 * qatoriga birlashtirish (avvalgi versiya) foydalanuvchini
 * chalg'itardi ("bular birga ishlaydimi?") va kategoriyalar soni
 * ko'paysa qator cheksiz uzayib ketardi. Endi bu yerda FAQAT status
 * qoladi - tabiiy ravishda 4 tadan oshmaydigan, barqaror o'lchov.
 *
 * MUHIM (ko'p tillilik): `statusFilter` QIYMATLARI (\"Barchasi\",
 * \"Faol\" va h.k.) — bular `utils/productFilters.js`da solishtirish
 * kaliti sifatida ishlatiladi, shuning uchun O'ZGARTIRILMAYDI.
 * Faqat KO'RSATILADIGAN matn (`t()` orqali) tarjima qilinadi.
 */
const ProductsFilterBar = ({ statusFilter, onStatusChange, statusCounts }) => {
  const { t } = useLanguage();

  const chipClass = (isActive) =>
    `shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
      isActive
        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
    }`;

  return (
    <div className="px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <button onClick={() => onStatusChange("Barchasi")} className={chipClass(statusFilter === "Barchasi")}>
        {t("sellerProducts.filterAll")} ({statusCounts.allCount})
      </button>
      <button onClick={() => onStatusChange("Faol")} className={chipClass(statusFilter === "Faol")}>
        {t("sellerProducts.filterActive")} ({statusCounts.activeCount})
      </button>
      <button onClick={() => onStatusChange("Nofaol")} className={chipClass(statusFilter === "Nofaol")}>
        {t("sellerProducts.filterInactive")} ({statusCounts.inactiveCount})
      </button>
      <button onClick={() => onStatusChange("KamQolgan")} className={chipClass(statusFilter === "KamQolgan")}>
        <AlertTriangle size={11} /> {t("sellerProducts.filterLowStock")} ({statusCounts.lowStockCount})
      </button>
    </div>
  );
};

export default memo(ProductsFilterBar);
