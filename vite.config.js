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
        },
      },
    },
  },
})
