import React from "react";

const SubmitBar = ({ isGlobalLoading, uploadLoading, uploadProgress }) => (
  <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
    <button
      type="submit"
      disabled={isGlobalLoading}
      className={`w-full h-11 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-98 transition-all ${
        isGlobalLoading
          ? "bg-slate-400 cursor-not-allowed shadow-none"
          : "bg-[#5346E0] shadow-indigo-600/20 hover:bg-[#4336c7]"
      }`}
    >
      {isGlobalLoading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{uploadLoading ? `Rasm yuklanmoqda (${uploadProgress}%)` : "Firestore-ga yozilmoqda..."}</span>
        </div>
      ) : (
        <span>Yaratish va Saqlash ✨</span>
      )}
    </button>
  </div>
);

export default React.memo(SubmitBar);
