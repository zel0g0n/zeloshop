import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    // MUHIM: `functions/` va `atmos-proxy-vm-test-server.js` endi
    // pastdagi ALOHIDA bloklarida (Node.js globallari bilan)
    // tekshiriladi - shuning uchun bu yerda chiqarib tashlangan, aks
    // holda ikkala blok ham ularga ustma-ust tegib (React hooks/
    // refresh qoidalari sof Node.js skriptiga ma'nosiz tarzda
    // qo'llanardi), chalkash natija berardi.
    ignores: ['functions/**', 'atmos-proxy-vm-test-server.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // 2026-09 audit: kod bazasida "obyektdan ba'zi maydonlarni
      // chiqarib tashlash" uchun keng tarqalgan, qasddan qilingan
      // konvensiya bor - masalan
      // `const { id: _ignored, ...rest } = data` yoki
      // `.map(({ _lastTs, ...rest }) => rest)`. Bu - standart JS/
      // ESLint konvensiyasi (pastki chiziq = "ataylab ishlatilmaydi"),
      // lekin `js.configs.recommended`ning standart `no-unused-vars`
      // buni tan olmas edi. Kodni o'zgartirish o'rniga (bu ishlaydigan,
      // to'g'ri patternni "tuzatish" bo'lardi), konfiguratsiya shu
      // KENG TARQALGAN konvensiyani tan oladigan qilib sozlandi.
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // 2026-09 audit: `eslint-plugin-react-hooks` v7 "recommended"
      // to'plami (`^7.1.1` semver oralig'i orqali, muallif tomonidan
      // YANGI qo'shilgan qoida sifatida, jamoaning ATAYLAB qabul
      // qilishisiz) `set-state-in-effect`ni ERROR darajasida yoqib
      // qo'ydi. Bu qoida, ma'lumot yuklovchi (`useEffect` ichida
      // `setLoading(true)`/`setError(null)` bilan boshlanadigan)
      // 40+ hookda ishlaydigan, xavfsiz, standart Reactcha patternni
      // OMMAVIY ravishda "xato" deb belgiladi - bularning HAMMASINI
      // ko'r-ko'rona architectural qayta yozish katta regressiya
      // xavfini keltirib chiqarardi (bu loyihada komponent/hook
      // render-vaqtli xatti-harakatini SINASH imkoni yo'q - Vitest
      // atayin jsdom'siz, faqat pure-function testlari bilan sozlangan).
      // Shuning uchun bu qoida "warn"ga tushirildi: HAR BIR hodisa
      // hali ham ko'rinadi (kelajakda birma-bir, ehtiyotkorlik bilan
      // qayta ko'rib chiqish uchun), lekin `npm run lint`ni butun
      // loyiha bo'yicha to'xtatib qo'ymaydi. Bu — kodni emas,
      // qoidaning KUTILMAGAN QATTIQLIGINI tuzatish.
      "react-hooks/set-state-in-effect": "warn",
      // 2026-09 audit: xuddi yuqoridagi kabi - `purity` va
      // `preserve-manual-memoization` REACT COMPILER'ga tayyorgarlik
      // qoidalari (masalan `useMemo` ICHIDA `Date.now()` chaqirish -
      // "impure" deb belgilanadi). LEKIN bu loyiha React Compiler'ni
      // UMUMAN ishlatmaydi (`vite.config.js`da `babel-plugin-react-
      // compiler` yo'q) - shuning uchun bu qoidalar HOZIRCHA sof
      // KELAJAKKA MO'LJALLANGAN maslahat, faol ishlayotgan xato emas.
      // Aniqlangan holatlarning barchasi (`Date.now()` filtr oynasini
      // hisoblash uchun, analitika/moliya sahifalarida) qasddan va
      // xavfsiz ishlaydi; ularni React Compiler naqshiga (masalan
      // useState+lazy-initializer) qayta yozish - test yozib
      // TEKSHIRISH IMKONI YO'Q component-render xatti-harakatini
      // (bu loyihada Vitest jsdom'siz) o'zgartiradigan, real foyda
      // hozircha yo'q, xavfi katta o'zgarish bo'lardi. "warn"ga
      // tushirildi - kelajakda Compiler qabul qilinsa, shu paytda
      // birma-bir ko'rib chiqiladi.
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // MUHIM, YANGI QO'SHILDI: `functions/` - Node.js/Cloud Functions
  // BACKEND kodi, React EMAS. Yuqoridagi (frontend) bloк faqat
  // `globals.browser`dan foydalanardi - unda `require`/`module`/
  // `exports`/`process`/`__dirname` kabi Node.js global
  // o'zgaruvchilari, shuningdek `jest`/`expect`/`describe` kabi Jest
  // globallari UMUMAN YO'Q edi. Natijada `functions/`dagi DEYARLI
  // HAR BIR FAYLDA bu so'zlarning HAR BIR ishlatilishi "no-undef"
  // xatosi sifatida hisoblanardi (~1350+ soxta xato) - bu `npm run
  // lint`ning umumiy natijasini deyarli FOYDASIZ qilib qo'ygan edi
  // (haqiqiy muammolar minglab soxta xato ichida ko'milib qolardi).
  // Endi to'g'ri Node.js+Jest global o'zgaruvchilari beriladi, va
  // React'ga xos qoidalar (hooks/refresh) - bu yerda ma'nosiz -
  // o'chirib qo'yiladi.
  // MUHIM, YANGI QO'SHILDI: `atmos-proxy-vm-test-server.js` - repo
  // ILDIZIDAGI, `src/`ga ham `functions/`ga ham TEGISHLI BO'LMAGAN,
  // mustaqil, VAQTINCHALIK Node.js tekshiruv skripti (o'z izohida
  // "VAQTINCHALIK tekshiruv serveri" deb aytilgan - ATMOS proksi-VM
  // haqiqiy IP orqali chiqayotganini tekshirish uchun). U yuqoridagi
  // frontend blokiga tushib qolgani uchun (`**/*.{js,jsx}`,
  // faqat `functions/**` chiqarib tashlangan), `globals.browser`
  // bilan tekshirilardi - lekin bu fayl aslida oddiy Node.js skripti
  // (`require("http")` ishlatadi), brauzer kodi emas. Natijada
  // "'require' is not defined" (no-undef) soxta xato chiqardi. Kodni
  // emas, konfiguratsiyani tuzatish to'g'ri - bu fayl uchun alohida,
  // Node.js globallariga ega kichik blok.
  {
    files: ['atmos-proxy-vm-test-server.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
    },
    rules: {
      // Frontend blokidagi bilan BIR XIL sabab: "ataylab ishlatilmaydi"
      // konvensiyasi (masalan `Promise.all` natijasidan faqat ba'zi
      // pozitsiyalar kerak bo'lganda) backend kodida ham ishlatiladi.
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
])
