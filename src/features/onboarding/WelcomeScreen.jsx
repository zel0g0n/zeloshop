import { memo } from "react";

const WelcomeScreen = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#5346E0] to-[#3d31b8] flex flex-col items-center justify-center px-6 text-center text-white">
      <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl mb-6">
        🛍️
      </div>

      <h1 className="text-2xl font-black tracking-tight mb-2">ZeloShop'ga xush kelibsiz!</h1>
      <p className="text-sm text-indigo-100 max-w-xs leading-relaxed">
        Instagram, TikTok yoki boshqa ijtimoiy tarmoqlarda savdo qilasizmi?
        ZeloShop orqali o'z shaxsiy onlayn do'koningizni bir necha daqiqada
        oching — mijozlaringiz uchun qulay katalog, savat va buyurtma tizimi.
      </p>

      <div className="mt-8 space-y-3 w-full max-w-xs text-left">
        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
          <span className="text-xl">⚡️</span>
          <span className="text-xs font-semibold">Ro'yxatdan o'tish — 1 daqiqa</span>
        </div>
        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
          <span className="text-xl">🔗</span>
          <span className="text-xs font-semibold">Shaxsiy do'kon havolangiz darhol tayyor</span>
        </div>
        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
          <span className="text-xl">📦</span>
          <span className="text-xs font-semibold">Mahsulot qo'shing, buyurtmalarni boshqaring</span>
        </div>
      </div>

      <button
        onClick={onGetStarted}
        className="mt-10 w-full max-w-xs h-13 py-4 bg-white text-[#5346E0] font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-transform"
      >
        Do'konimni ochish →
      </button>
    </div>
  );
};

export default memo(WelcomeScreen);
