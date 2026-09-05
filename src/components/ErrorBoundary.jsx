import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { Sentry } from "@/lib/sentry";

// Ushbu boundary ichida render paytida yuzaga keladigan istalgan kutilmagan
// xato Sentry orqali kuzatiladi (`componentDidCatch`), bu esa production
// muhitidagi bunday holatlarni aniqlash va tekshirish imkonini beradi.
//
// Error Boundary bo'lmasa, biror komponent render paytida xato tashlaganda
// (masalan, kutilmagan `undefined` maydon yoki tarmoq javobidagi noto'g'ri
// shakl) butun React ilovasi qulab tushib, foydalanuvchiga hech qanday
// tushunarli xabarsiz bo'sh oq ekran qolardi — bu ayniqsa Telegram Mini
// App'da yomon tajriba beradi, chunki foydalanuvchi nima bo'lganini
// bilmaydi.
//
// Error Boundary faqat class komponent sifatida yozilishi mumkin — React
// hozircha bu uchun hook taklif qilmaydi.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Ilovada kutilmagan xato:", error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-3">
          <AlertTriangle size={36} className="text-amber-500" />
          <p className="text-sm font-bold text-gray-800 dark:text-white">Kutilmagan xatolik yuz berdi</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
            Ilovani qayta yuklab ko'ring. Agar muammo davom etsa, birozdan so'ng qayta urinib ko'ring.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-2 px-6 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
          >
            Qayta yuklash
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
