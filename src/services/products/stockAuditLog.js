import { db } from "@/firebase/config";
import { collection, query, where, orderBy, limit } from "firebase/firestore";

/**
 * ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
 * muammoni yechish bo'limi): `sellers/{sellerId}/stockAuditLog`
 * kolleksiyasi FAQAT O'QISH uchun (`firestore.rules`da yozish har
 * doim `false` — faqat `functions/lib/stockAuditLog.js`dagi trigger,
 * Admin SDK orqali yozadi). Shuning uchun bu yerda faqat query
 * quruvchi funksiya bor, xuddi `services/finance/expenses.js`dagi
 * `expensesQuery` bilan bir xil naqsh.
 *
 * Bitta mahsulotning so'nggi harakatlari (`productId` bo'yicha) — eng
 * yangisi birinchi. `firestore.indexes.json`da mos composite indeks
 * mavjud (`productId` ASC + `createdAtMs` DESC).
 */
export const productStockAuditLogQuery = (sellerId, productId, maxEntries = 15) =>
  query(
    collection(db, "sellers", sellerId, "stockAuditLog"),
    where("productId", "==", productId),
    orderBy("createdAtMs", "desc"),
    limit(maxEntries)
  );
