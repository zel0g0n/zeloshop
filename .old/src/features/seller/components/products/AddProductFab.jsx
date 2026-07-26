import React from "react";

const AddProductFab = ({ onClick }) => (
  <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
    <button
      onClick={onClick}
      className="w-full h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
    >
      <span>+ Yangi mahsulot qo'shish</span>
    </button>
  </div>
);

export default React.memo(AddProductFab);
