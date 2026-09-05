import { memo } from "react";
import { ShoppingBag, Truck, Users, Wallet, Sparkles, TrendingUp, Star, LayoutGrid } from "lucide-react";

// SOTUVGA UNDOVCHI (marketing) matn — professional SMM yondashuvida:
// muammo -> yechim -> aniq foyda tuzilishi bo'yicha yozilgan.
//
// NIYAT: platforma hozirda FAQAT kosmetika/go'zallik sohasidagi
// sotuvchilar bilan ishga tushirilmoqda (`CreateStoreScreen.jsx`dagi
// `FIXED_NICHE` bilan bir xil strategik qaror) — shu sababli matn
// aynan shu auditoriyaga moslab yozilgan, umumiy "har qanday soha"
// uslubida emas. Ijtimoiy tarmoq nomlari (Instagram/TikTok) ataylab
// KONKRET keltirilmaydi — "ijtimoiy tarmoqlar" umumiy, kelajakda
// boshqa platformalar (masalan Telegram kanal, WhatsApp) qo'shilsa
// ham matnni o'zgartirishga hojat qoldirmaydi.
//
// HALOL ESLATMA: "Yandex Delivery" integratsiyasi haqiqatan LIVE va
// ishlaydi (`DeliverySettingsPage.jsx`ning Yandex bo'limi) — quyidagi
// matn shu bilan mos.
const ADVANTAGES = [
  {
    icon: Truck,
    text: "Yandex Delivery bilan buyurtmani bir necha soniyada kuryerga topshiring",
  },
  {
    icon: LayoutGrid,
    text: "Kosmetika sohasiga moslashtirilgan tayyor kategoriyalar bilan vitrinangizni bir zumda tuzing",
  },
  {
    icon: Star,
    text: "Mijoz sharhlari orqali brendingizga ishonchni oshiring",
  },
  {
    icon: Users,
    text: "Mijozlar bilan doimiy aloqa uchun zamonaviy CRM",
  },
  {
    icon: Wallet,
    text: "Kirim-chiqim xarajatlaringizni to'liq nazorat qiling",
  },
  {
    icon: Sparkles,
    text: "ZeloAI bilan mahsulot tavsifi va sotuv postlarini avtomatlashtiring",
  },
  {
    icon: TrendingUp,
    text: "Daromadingizni 45% gacha oshiring",
  },
];

const WelcomeScreen = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#5346E0] to-[#3d31b8] flex flex-col items-center px-6 pt-12 pb-10 text-center text-white overflow-y-auto">
      <div className="w-20 h-20 rounded-3xl bg-white/20 border border-white/20 flex items-center justify-center mb-6 shrink-0">
        <ShoppingBag size={36} strokeWidth={2} />
      </div>

      <h1 className="text-2xl font-black tracking-tight mb-2">ZeloShop'ga xush kelibsiz!</h1>
      <p className="text-sm text-indigo-100 max-w-xs leading-relaxed">
        Ijtimoiy tarmoqlardagi obunachilaringizni <strong>haqiqiy xaridorlarga</strong> aylantiring.
        ZeloShop — kosmetika va go'zallik mahsulotlarini sotuvchi brendlar uchun maxsus yaratilgan,
        savdoni avtomatlashtiruvchi onlayn do'kon platformasi.
      </p>
      <p className="text-sm text-indigo-100 max-w-xs leading-relaxed mt-3">
        Kontent yaratishga vaqtingiz ketmasin — vitrina, buyurtma, yetkazib berish va mijoz bilan
        aloqa bitta joyda. Bir necha daqiqada ishga tushiring, qolganini biz hal qilamiz.
      </p>

      <div className="mt-8 space-y-2.5 w-full max-w-xs text-left">
        {ADVANTAGES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Icon size={16} strokeWidth={2.25} />
            </div>
            <span className="text-xs font-semibold leading-snug">{text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onGetStarted}
        className="mt-10 mb-2 w-full max-w-xs h-13 py-4 bg-white text-[#5346E0] font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-transform shrink-0"
      >
        Hoziroq boshlang
      </button>
    </div>
  );
};

export default memo(WelcomeScreen);
