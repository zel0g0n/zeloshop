import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * BIR MARTALIK MIGRATSIYA: bu tarif-limit hisoblagichlari
 * (`activeDiscountCount`, `couponCount`) qurilishidan OLDIN
 * yaratilgan aksiya/promokod yozuvlarini "orqaga hisoblab" to'ldiradi
 * — `backfillSellerRollups` bilan AYNAN BIR XIL naqsh. Batafsil izoh:
 * `functions/tariffs.js`dagi `backfillTariffCounters`. IDEMPOTENT.
 */
export const backfillTariffCounters = async (sellerId) => {
  const callable = httpsCallable(functions, "backfillTariffCounters");
  const { data } = await callable({ sellerId });
  return data;
};
