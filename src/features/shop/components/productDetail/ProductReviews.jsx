const reviews = [
  {
    id: 1,
    name: "Shahnoza",
    comment: "Terim juda yumshoq va yorqin bo‘lib qoldi 😍",
    rating: 5,
  },
  {
    id: 2,
    name: "Madina",
    comment: "Premium mahsulot ekanligi bilinadi.",
    rating: 5,
  },
];

export const ProductReviews = () => {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[24px] font-bold text-slate-900">
          Reviews
        </h3>

        <span className="text-sm font-medium text-blue-600">
          120+ reviews
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(37,99,235,0.08)]"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900">
                {review.name}
              </h4>

              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-500">
                ⭐ {review.rating}.0
              </span>
            </div>

            <p className="mt-3 text-[15px] leading-7 text-slate-500">
              {review.comment}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
