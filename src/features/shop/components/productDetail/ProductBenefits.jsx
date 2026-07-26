const benefits = [
  "Terini chuqur namlaydi",
  "Ajinlarni kamaytiradi",
  "24/7 himoya",
  "AI tavsiya qilgan mahsulot",
];

export const ProductBenefits = () => {
  return (
    <section className="mt-6">
      <div className="rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-[0_10px_40px_rgba(37,99,235,0.35)]">
        
        <h3 className="text-[24px] font-bold">
          Product Benefits
        </h3>

        <div className="mt-5 space-y-3">
          {benefits.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 font-bold">
                ✓
              </span>

              <p className="text-sm font-medium">
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
