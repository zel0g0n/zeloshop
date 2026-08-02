import { useCatalogFilter } from "@/context/CatalogFilterContext";

// Endi Katalogga xos Context orqali — Bosh sahifaga ta'sir qilmaydi.
const useChangeCategory = () => {
  const { activeCategory, setActiveCategory } = useCatalogFilter();
  const changeCategory = (specialKey) => {
    setActiveCategory(specialKey);
  };
  return { changeCategory, activeCategory };
};

export default useChangeCategory;
