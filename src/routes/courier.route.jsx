import { Routes, Route } from "react-router-dom";
import CourierOrdersPage from "@/features/courier/CourierOrdersPage";

/**
 * Kuryer Mini App'ining marshrutlari — v1'da ATAYLAB BITTA sahifa
 * (`CourierOrdersPage`ning o'zi ro'yxat+tafsilotni bitta joyda,
 * kengaytiriladigan kartochkalar orqali ko'rsatadi, `OrderCard.jsx`
 * dagi mavjud "ochilib-yopilish" naqshiga o'xshab) — sotuvchi/mijoz
 * ilovasidagi ko'p bosqichli navigatsiyaga hojat yo'q, kuryer uchun
 * ENG MUHIMI — tezkorlik.
 */
export const CourierRoutes = () => (
  <Routes>
    <Route path="/courier" element={<CourierOrdersPage />} />
  </Routes>
);
