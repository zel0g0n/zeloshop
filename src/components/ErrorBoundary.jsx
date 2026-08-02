import { Component } from "react";

// OLDIN: agar biror komponent render paytida xato tashlasa (masalan
// kutilmagan `undefined` maydon, tarmoq javobidagi noto'g'ri shakl),
// butun React ilovasi qulab tushib, foydalanuvchiga BO'SH OQ EKRAN
// qolardi — hech qanday tushunarli xabar yoki tiklanish imkoniyati
// bo'lmasdan. Bu — ayniqsa Telegram Mini App'da juda yomon tajriba,
// chunki foydalanuvchi nima bo'lganini bilmaydi.
//
// Error Boundary faqat CLASS komponent sifatida yozilishi mumkin —
// React hozircha bu uchun hook taklif qilmaydi.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Ishlab chiqarishda bu yerga tashqi xato kuzatuv xizmati (masalan
    // Sentry) ulanishi mumkin — hozircha faqat konsolga yozamiz.
    console.error("Ilovada kutilmagan xato:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-3">
          <span className="text-4xl">😕</span>
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
