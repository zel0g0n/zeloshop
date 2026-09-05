import { Routes, Route } from "react-router-dom";
import StaffHomePage from "@/features/staff/StaffHomePage";

/**
 * Xodim Mini App'ining marshrutlari — `courier.route.jsx` bilan bir xil
 * naqsh: ATAYLAB BITTA sahifa (`StaffHomePage`), ichida ikkita bo'lim
 * (Buyurtmalar/Mahsulotlar) TAB orqali almashtiriladi, har biri sotuvchi
 * bergan ruxsatga qarab ko'rsatiladi yoki yashiriladi (qarang:
 * `StaffHomePage.jsx`).
 */
export const StaffRoutes = () => (
  <Routes>
    <Route path="/staff" element={<StaffHomePage />} />
  </Routes>
);
