import React from "react";
import ProductItem from "./ProductItem";

// Muhim: bu komponent endi o'zi Firestore/Redux'dan ma'lumot so'ramaydi —
// filtrlangan ro'yxatni ota komponentdan prop sifatida oladi.
// Shu tufayli qidiruv/kategoriya/tab filtrlari haqiqatan ham ishlaydi
// (avvalgi versiyada bu yerda alohida useFilterProducts() chaqirilib,
// ota komponentdagi filtr natijasi butunlay e'tiborsiz qoldirilgan edi).
const ProductsList = ({ products, togglingId, onQuickEdit, onToggleActive }) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 text-xs">
        Hech qanday maxsulot topilmadi.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductItem
          key={product.id}
          prod={product}
          isToggling={togglingId === product.id}
          onQuickEdit={onQuickEdit}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
};

export default React.memo(ProductsList);
