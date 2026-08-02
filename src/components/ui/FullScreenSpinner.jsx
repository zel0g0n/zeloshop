// OLDIN: ikkita ALOHIDA joyda (SessionGate.jsx va App.jsx) ikkita
// SHUNGA O'XSHASH, lekin bir xil BO'LMAGAN spinner ta'riflangan edi:
// - SessionGate: w-10 h-10, aniq fon rangi bilan (bg-gray-100 dark:bg-slate-950)
// - App.jsx (RouteFallback): w-8 h-8, FON RANGISIZ (orqadagi narsa
//   ko'rinib turadi — qorong'i rejimda bir zumga oqarib ko'rinishi
//   mumkin edi)
// Foydalanuvchi buni "ikki xil dizayndagi spinner" sifatida to'g'ri
// payqagan edi. Endi — BITTA, umumiy komponent, ikkalasida ham
// bir xil ishlatiladi.
const FullScreenSpinner = () => (
  <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default FullScreenSpinner;
