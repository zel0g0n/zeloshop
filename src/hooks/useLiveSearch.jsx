import { useCatalogFilter } from "@/context/CatalogFilterContext";

// OLDIN: Redux orqali ishlardi (butun ilova uchun umumiy). Endi
// Katalogga xos Context orqali — Bosh sahifaga ta'sir qilmaydi.
const useLiveSearch = () => {
  const { queryKey, setQueryKey } = useCatalogFilter();

  const handleSearchChange = (value) => {
    setQueryKey(value);
  };

  const clearSearch = () => {
    setQueryKey("");
  };

  return {
    searchQuery: queryKey,
    handleSearchChange,
    clearSearch
  };
};

export default useLiveSearch;
