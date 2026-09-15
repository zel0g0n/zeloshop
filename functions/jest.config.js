// Jest'ni faqat "functions/" papkasi bilan cheklab qo'yish uchun.
//
// Nega kerak: "functions/" ichida bu fayl bo'lmasa, Jest o'z konfiguratsiyasini
// qidirib, "functions/"dan tashqariga — ildiz loyiha papkasiga (frontend) chiqib
// ketishi mumkin (ayniqsa Windows/Git Bash muhitida kuzatilgan). Natijada Jest
// ildiz papkadagi "package.json" (frontend, nomi "cosmetic-app-template") bilan
// "functions/package.json"ni (nomi "zeloshop-functions") bitta "rootDir" ostida
// ko'rib, "Haste module naming collision" xatoligini beradi va test jarayoni
// (haste xaritasini tuzishda) muzlab qoladi.
//
// `rootDir` shu qidiruvni butunlay to'xtatadi — Jest boshqa hech qayerni
// (frontendni ham) skanerlamaydi, faqat shu papka va uning ichidagi
// "__tests__" fayllarini ko'radi.
//
// MUHIM: `__dirname` EMAS, `"."` ishlatilgan. Sabab — Windows'da (ayniqsa
// Desktop OneDrive orqali sinxronlansa yoki qisqa "8.3" yo'l nomi ishlatilsa)
// Node hisoblagan `__dirname` bilan terminal ishga tushirgan joriy papka
// (`process.cwd()`) BIR XIL papkaga ikki XIL matn ko'rinishida ishora qilib
// qolishi mumkin (masalan katta-kichik harf yoki qisqa nom farqi bilan).
// Jest esa ularni ikkita ALOHIDA papka deb hisoblab, HAR BIR test faylini
// IKKI MARTA ishga tushiradi (masalan "functions/__tests__/x.test.js" va
// "__tests__/x.test.js" sifatida bir xil faylni qayta-qayta) — bu esa
// jest.doMock/jest.resetModules'ga tayangan testlarda tasodifiy
// "X is not a function" xatolarini keltirib chiqaradi. `rootDir: "."`
// har doim terminal joriy papkasiga (`process.cwd()`) nisbatan hisoblanadi —
// bu Jestning o'zi ham xuddi shu tarzda hisoblaydigan qiymat bilan bir xil
// bo'lib, ikkilanishning oldini oladi.
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  // Ehtiyot chorasi: agar kelajakda loyiha tuzilishi o'zgarib, boshqa sababdan
  // ildiz papka qayta skanerlansa ham, bitta nom to'qnashuvi jarayonni
  // to'xtatib qo'ymasin (ogohlantirish chiqadi, lekin xato bo'lmaydi).
  haste: {
    throwOnModuleCollision: false,
  },
};
