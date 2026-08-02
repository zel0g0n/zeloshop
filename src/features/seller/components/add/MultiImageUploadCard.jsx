import React, { memo } from "react";

const MAX_IMAGES = 4;

// OLDIN: mahsulotga faqat BITTA rasm qo'shish mumkin edi. Endi 4
// tagacha rasm qo'shish, birortasini "asosiy rasm" (thumbnail) qilib
// belgilash mumkin — thumbnail har doim ro'yxatning birinchi o'rniga
// olib boriladi (saqlashda), shu bilan katalog/kartochkalarda aynan
// shu rasm ko'rsatiladi.
const MultiImageUploadCard = ({ images, disabled, onAddFiles, onRemoveImage, onSetThumbnail }) => {
  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    onAddFiles(files);
    e.target.value = ""; // xuddi shu faylni qayta tanlash imkonini saqlab qolish uchun
  };

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
          Mahsulot rasmlari
        </label>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{images.length}/{MAX_IMAGES}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {images.map((img, index) => (
          <div key={img.id} className="relative aspect-square">
            <img
              src={img.previewUrl}
              alt=""
              className={`w-full h-full object-cover rounded-xl border-2 ${
                index === 0 ? "border-indigo-500" : "border-slate-100 dark:border-slate-700"
              }`}
            />
            {index === 0 && (
              <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">
                ASOSIY
              </span>
            )}

            {/* OLDIN: bu tugmalar faqat "hover" qilinganda ko'rinardi
                (opacity-0 group-hover:opacity-100) — bu sichqoncha
                bilan ishlaydi, lekin TELEGRAM MINI APP kabi teginish
                (touch) qurilmalarida "hover" holati ishonchli
                ishlamaydi, shuning uchun tugmalar amalda topilmas
                edi. Endi ular DOIM ko'rinadi, kichik burchak
                nishonchalari sifatida. */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemoveImage(img.id)}
              title="O'chirish"
              className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
            >
              ✕
            </button>

            {index !== 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSetThumbnail(img.id)}
                title="Asosiy rasm qilib belgilash"
                className="absolute bottom-1 right-1 w-5 h-5 bg-white/95 dark:bg-slate-800/95 rounded-full flex items-center justify-center text-[10px] shadow-md"
              >
                ⭐
              </button>
            )}
          </div>
        ))}

        {canAddMore && (
          <label className="aspect-square border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-800/50">
            <span className="text-lg">＋</span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">Qo'shish</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={disabled}
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        )}
      </div>

      <p className="text-[9px] text-slate-400 dark:text-slate-500">
        Birinchi (⭐ belgili) rasm katalogda asosiy rasm sifatida ko'rsatiladi. PNG, JPG, WEBP formatlar.
      </p>
    </div>
  );
};

export default memo(MultiImageUploadCard);
