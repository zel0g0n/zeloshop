import React from "react";

const ImageUploadCard = ({
  imagePreview,
  uploadLoading,
  uploadProgress,
  isGlobalLoading,
  onImageChange,
  onRemoveImage,
}) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot rasmi</label>

    {!imagePreview ? (
      <label className="border-2 border-dashed border-slate-200 rounded-xl h-28 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50/50">
        <span className="text-xl">📸</span>
        <span className="text-xs font-black text-slate-700">Rasm yuklash</span>
        <span className="text-[9px] text-slate-400 font-medium">PNG, JPG, WEBP formatlar</span>
        <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
      </label>
    ) : (
      <div className="relative w-28 h-28 mx-auto group">
        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl border border-slate-100 shadow-2xs" />
        {!isGlobalLoading && (
          <button
            type="button"
            onClick={onRemoveImage}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md shadow-rose-500/20 active:scale-90 transition-transform"
          >
            ✕
          </button>
        )}

        {uploadLoading && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-white p-2">
            <span className="text-[10px] font-bold mb-1">Yuklanmoqda</span>
            <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-400 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-[10px] font-mono mt-1">{uploadProgress}%</span>
          </div>
        )}
      </div>
    )}
  </div>
);

// isGlobalLoading/uploadLoading/uploadProgress o'zgarmasa, title/description kabi
// boshqa maydonlar yozilganda bu komponent qayta render bo'lmaydi
export default React.memo(ImageUploadCard);
