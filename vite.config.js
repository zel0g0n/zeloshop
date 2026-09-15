import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // OLDIN: bu yerda `manualChunks` OBYEKT shaklida yozilgan edi
    // ({"nomi": ["paket1", "paket2"]}) — bu eski Rollup'ga mos edi.
    // Lekin loyihangizdagi Vite 8 endi yangi, tezroq bundler
    // (rolldown) ishlatadi, va u faqat FUNKSIYA shaklini qabul qiladi.
    // Shu sabab `npm run build` xato berayotgan edi.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("firebase")) {
            return "firebase-vendor";
          }
          if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
            return "redux-vendor";
          }
          if (id.includes("framer-motion") || id.includes("react-icons")) {
            return "ui-vendor";
          }
          // 2026-09 audit ("kichik kamchiliklar" - bosh `index-*.js` fayli
          // 500KB chegarasidan katta edi): `@sentry/react` `main.jsx`da
          // ENG BOSHIDA (`initSentry()`) va `ErrorBoundary.jsx`da statik
          // import qilinadi - shuning uchun uni asosiy ilova kodidan
          // "dinamik import"ga o'tkazish orqali kechiktirish (lazy-load)
          // XAVFLI bo'lardi (ilova ochilgan zahoti yuz beradigan xatolar
          // Sentry hali yuklanmagani uchun qo'lga tushmay qolishi mumkin
          // edi). Shuning uchun ATAYLAB kamroq xavfli yechim tanlandi:
          // umumiy baytlar SONI o'zgarmaydi, lekin Sentry alohida "vendor"
          // faylga chiqariladi - shu orqali (1) bosh `index-*.js`
          // 500KB'dan pastga tushadi, (2) Sentry SDK ilova kodidan
          // KAMROQ tez-tez o'zgargani uchun, brauzer uni HAR BIR yangi
          // deploy'da qaytadan yuklab olmasdan, keshdan foydalanishi
          // mumkin bo'ladi (haqiqiy, ijobiy tezlik natijasi).
          if (id.includes("@sentry")) {
            return "sentry-vendor";
          }
        },
      },
    },
  },
  // Vitest — sof (React'siz) yordamchi funksiyalarni sinash uchun
  // (masalan `src/utils/dashboardStats.js`). Hozircha `jsdom` kerak
  // emas (bu testlar DOM'ga tegmaydi) — kerak bo'lsa keyinroq
  // `environment: "jsdom"` qo'shish kifoya.
  // MUHIM: standart bo'yicha Vitest LOYIHADAGI BARCHA "*.test.js"
  // fayllarni qidiradi — shu jumladan `functions/__tests__/*`ni ham!
  // Lekin o'sha testlar — Jest uchun yozilgan (`jest.doMock` kabi,
  // Vitest'da mavjud bo'lmagan API'lardan foydalanadi) va backend'ning
  // O'Z, alohida `npm test` (Jest) buyrug'i orqali ishga tushirilishi
  // kerak. Shuning uchun `functions/` papkasi bu yerda ATAYLAB
  // chetlab o'tiladi.
  test: {
    globals: false,
    environment: "node",
    exclude: ["**/node_modules/**", "**/functions/**"],
  },
})
