import { db } from "@/firebase/config";
import { doc, setDoc, deleteDoc, collection, query, orderBy, serverTimestamp } from "firebase/firestore";

/**
 * ADVANCED AUTOMATION (Z-Biznes, 2026-09 punkt-royxati, 5-band) —
 * sotuvchi O'ZI quradigan WHEN -> IF -> THEN qoidalari.
 * `sellers/{sellerId}/automationRules/{ruleId}` quyi kolleksiyasida
 * saqlanadi — `services/bundles/bundles.js`/`services/coupons/coupons.js`
 * bilan BIR XIL naqsh: sotuvchi TO'G'RIDAN-TO'G'RI Firestore'ga
 * yozadi (`firestore.rules` egalik + Biznes tarifini + asosiy shaklni
 * tekshiradi), IJRO esa BUTUNLAY serverda (`functions/automationRules.js`
 * dagi soatlik cron).
 */

const TRIGGER_TYPES = ["customer_inactive", "order_undelivered", "low_stock"];
const ACTION_TYPES = ["notify_customer_telegram", "alert_manager"];

export const createAutomationRule = async (sellerId, { name, triggerType, triggerParams, actionType, actionParams }) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error("Qoida nomi kiritilishi shart.");
  if (!TRIGGER_TYPES.includes(triggerType)) throw new Error("Trigger turi noto'g'ri.");
  if (!ACTION_TYPES.includes(actionType)) throw new Error("Harakat turi noto'g'ri.");
  if (actionType === "notify_customer_telegram" && triggerType !== "customer_inactive") {
    throw new Error("Mijozga xabar yuborish faqat \"Mijoz faolsizligi\" trigger'i bilan mos keladi.");
  }

  try {
    const ref = doc(collection(db, "sellers", sellerId, "automationRules"));
    await setDoc(ref, {
      name: trimmedName,
      triggerType,
      triggerParams: triggerParams || {},
      actionType,
      actionParams: actionParams || {},
      isActive: true,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      stats: { firedCount: 0, lastFiredAtMs: null },
    });
    return ref.id;
  } catch (error) {
    throw new Error(error.message || "Qoida yaratishda xatolik yuz berdi", { cause: error });
  }
};

export const toggleAutomationRuleActive = async (sellerId, ruleId, isActive) => {
  if (!sellerId || !ruleId) throw new Error("Ma'lumot yetarli emas.");
  try {
    await setDoc(doc(db, "sellers", sellerId, "automationRules", ruleId), { isActive, updatedAtMs: Date.now() }, { merge: true });
  } catch (error) {
    throw new Error(error.message || "Qoida holatini o'zgartirishda xatolik", { cause: error });
  }
};

export const deleteAutomationRule = async (sellerId, ruleId) => {
  if (!sellerId || !ruleId) throw new Error("Ma'lumot yetarli emas.");
  try {
    await deleteDoc(doc(db, "sellers", sellerId, "automationRules", ruleId));
  } catch (error) {
    throw new Error(error.message || "Qoidani o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export const sellerAutomationRulesQuery = (sellerId) =>
  query(collection(db, "sellers", sellerId, "automationRules"), orderBy("createdAtMs", "desc"));
