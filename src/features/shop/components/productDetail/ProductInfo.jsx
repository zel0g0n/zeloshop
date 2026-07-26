export const ProductInfo = ({info}) => {
  const { name, brand, description, rating, tags, category } = info || {};
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        {tags && tags.map((tag, index) => (
          <span key={index} className="px-3 py-1 rounded-full bg-blue-100 text-blue-500 text-xs font-semibold">
            {tag}
          </span>
        ))}

        {
          rating ? (
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-500 text-xs font-semibold">
              ⭐ {rating}
            </span>
          ) : ''
        }
        
      </div>

      <div className="mt-4">
        {brand ? (
          <p className="uppercase tracking-[0.28em] text-sm text-blue-500 font-semibold">
            {brand}
          </p>
        ):''}
        

        <h1 className="mt-3 text-[34px] leading-[1.1] font-black text-slate-900">
          {name || "Advanced Night Repair Serum"}
        </h1>

        <p className="mt-4 text-[15px] leading-7 text-slate-500">
          {description}
        </p>
      </div>
      {
        category ? (
          <div className="mt-5 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-500 text-xs font-semibold">
                {category}
              </span>
          </div>
        ): ''
      }
    </section>
  );
};
