import { useCatalogFilter } from "@/context/CatalogFilterContext";

// useChangeCategory.jsx (tez tugmalar: Barchasi/Aksiya/Arzon/...) bilan
// bir xil naqsh, lekin mahsulotning haqiqiy kategoriyasi
// (skincare/parfum/makeup/hair) uchun. Endi Katalogga xos Context orqali.
const useChangeType = () => {
  const { activeType, setActiveType } = useCatalogFilter();

  const changeType = (type) => {
    setActiveType(type);
  };

  return { activeType, changeType };
};

export default useChangeType;
