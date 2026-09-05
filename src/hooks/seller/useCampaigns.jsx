import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

// Sahifada ko'rsatiladigan/tahlil qilinadigan so'nggi kampaniyalar
// soni chegarasi - "Buyruq Markazi"ga oxirgi bir necha oylik marketing
// faoliyati yetarli, cheksiz tarixni yuklashning hojati yo'q.
const CAMPAIGNS_LIMIT = 200;

/**
 * BIZNES BUYRUQ MARKAZI (2026-09, 3-band "eng yaxshi marketing
 * kampaniyasi" ko'rsatkichi) — server tomonida har bir CRM xabari
 * yuborilganda yoziladigan (`sellers/{id}/campaigns`, batafsil izoh:
 * `functions/notifications.js`dagi `handleSendCrmNotification`)
 * kampaniya yozuvlarini o'qiydi.
 */
export const useCampaigns = (sellerId) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const campaignsQuery = query(
      collection(db, "sellers", sellerId, "campaigns"),
      orderBy("sentAt", "desc"),
      limit(CAMPAIGNS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      campaignsQuery,
      (snapshot) => {
        setCampaigns(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "",
              message: data.message || "",
              audienceCount: Number(data.audienceCount) || 0,
              couponCode: data.couponCode || null,
              sentAtMs: data.sentAt?.toMillis ? data.sentAt.toMillis() : 0,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  return { campaigns, loading, error };
};

export default useCampaigns;
