import { db } from "@/firebase/config";
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";

/**
 * Sotuvchining qo'shimcha xarajatlari (OPEX yoki marketing) —
 * "sellers/{sellerId}/expenses" quyi kolleksiyasida saqlanadi.
 * Bular avtomatik hisoblanmaydi (kuryer haqi, reklama va h.k. hech
 * qayerda kuzatilmaydi) — shuning uchun sotuvchi ularni QO'LDA
 * kiritadi.
 */
export const addExpense = async (sellerId, { name, amount, category }) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  if (!name?.trim() || !amount || Number(amount) <= 0) {
    throw new Error("Xarajat nomi va summasi to'g'ri kiritilishi shart.");
  }
  try {
    await addDoc(collection(db, "sellers", sellerId, "expenses"), {
      name: name.trim(),
      amount: Number(amount),
      category: category === "marketing" ? "marketing" : "opex",
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });
  } catch (error) {
    throw new Error(error.message || "Xarajatni saqlashda xatolik yuz berdi", { cause: error });
  }
};

export const deleteExpense = async (sellerId, expenseId) => {
  if (!sellerId || !expenseId) throw new Error("Ma'lumot yetarli emas.");
  try {
    await deleteDoc(doc(db, "sellers", sellerId, "expenses", expenseId));
  } catch (error) {
    throw new Error(error.message || "Xarajatni o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export const expensesQuery = (sellerId) =>
  query(collection(db, "sellers", sellerId, "expenses"), orderBy("createdAtMs", "desc"));
