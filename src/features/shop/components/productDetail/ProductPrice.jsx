export const ProductPrice = ({ priceData }) => {
  const {price, oldPrice , stock} = priceData || {};
  const safePrice = Number(price) || 0;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between rounded-[32px] bg-white p-5 shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
        
        <div>
          <p className="text-sm text-slate-400 line-through">
            {oldPrice ? `${Number(oldPrice).toFixed(2)} so'm` : '100000 so\'m'}
          </p>

          <div className="flex items-end gap-3 mt-1">
            <h2 className="text-[24px] font-black text-blue-600 leading-none">
              {`${safePrice.toFixed(2)} so'm`}
            </h2>

            {/* <span className="mb-1 rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-500">
              -30%
            </span> */}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-sm text-slate-400">
            {stock > 0 ? "Available" : "Out of Stock"}
          </span>

          <span className="mt-1 font-semibold text-emerald-500">
            In Stock {stock}
          </span>
        </div>
      </div>
    </section>
  );
};
