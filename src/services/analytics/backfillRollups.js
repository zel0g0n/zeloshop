import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * BIR MARTALIK MIGRATSIYA: ushbu sotuvchining rollup tizimi
 * qurilishidan OLDINGI buyurtma tarixini `orderRollups`/`customers`
 * yig'ma kolleksiyalariga "orqaga hisoblab" to'ldiradi. Batafsil
 * izoh: `functions/orderRollups.js`dagi `backfillSellerRollups`.
 * IDEMPOTENT — xavfsiz qayta chaqirish mumkin.
 */
export const backfillSellerRollups = async (sellerId) => {
  const callable = httpsCallable(functions, "backfillSellerRollups");
  const { data } = await callable({ sellerId });
  return data;
};
