import { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * Sotuvchining AI CEO mahsulot qoralamalarini jonli kuzatadi.
 *
 * MUHIM (Firebase xarajati): bu — FAQAT `aiCeoEnabled` sotuvchilar
 * uchun ishlatiladi (chaqiruvchi komponentlar shuni tekshirib,
 * kerak bo'lmasa bu hookni umuman chaqirmaydi) - odatiy sotuvchi
 * uchun yangi tinglovchi ochilmaydi.
 */
export const useProductDrafts = (sellerId) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const draftsQuery = query(collection(db, "sellers", sellerId, "productDrafts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      draftsQuery,
      (snapshot) => {
        setDrafts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [sellerId]);

  const queued = useMemo(() => drafts.filter((d) => d.status === "queued"), [drafts]);
  const readyForReview = useMemo(() => drafts.filter((d) => d.status === "ready_for_review"), [drafts]);
  const failed = useMemo(() => drafts.filter((d) => d.status === "failed"), [drafts]);

  return { drafts, queued, readyForReview, failed, loading };
};
