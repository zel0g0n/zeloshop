/**
 * BIZNES BUYRUQ MARKAZI (2026-09, 3-band "eng yaxshi marketing
 * kampaniyasi" ko'rsatkichi) — CRM Hub orqali yuborilgan marketing
 * kampaniyalarining (`sellers/{id}/campaigns`, batafsil izoh:
 * `functions/notifications.js`dagi `handleSendCrmNotification`)
 * samaradorligini hisoblaydi. Sof funksiya — React'ga bog'liq emas.
 *
 * DAROMAD ATRIBUTSIYASI — ATAYLAB HALOL CHEGARA: kampaniya orqali
 * "qancha sotuv bo'ldi" faqat o'sha kampaniya bilan BIRGA PROMOKOD
 * yuborilgan bo'lsa hisoblanadi — mos promokod bilan qilingan
 * buyurtmalar shu kampaniyaga tegishli deb hisoblanadi
 * (`order.appliedCoupon.code === campaign.couponCode`), FAQAT
 * kampaniya yuborilgan vaqtdan KEYIN yaratilgan buyurtmalar orasidan.
 * Promokodsiz yuborilgan xabar uchun keyingi xariddan aynan SHU xabar
 * sabab bo'lganini ANIQLASH IMKONSIZ — bunday kampaniyalar uchun
 * `isAttributable: false` qaytariladi, HECH QACHON soxta/taxminiy
 * daromad o'ylab topilmaydi (MOCK QILMA qoidasi).
 */

/**
 * @param {Array<{id:string, title:string, audienceCount:number, couponCode:string|null, sentAtMs:number}>} campaigns
 * @param {Array<{status:string, createdAt:number, totalAmount:number, appliedCoupon?:{code?:string}}>} orders
 * @returns {Array<Object>} har bir kampaniya uchun statistika, sentAtMs bo'yicha KAMAYISH tartibida
 */
export function computeCampaignStats(campaigns, orders) {
  const campaignList = Array.isArray(campaigns) ? campaigns : [];
  const orderList = Array.isArray(orders) ? orders : [];

  return campaignList
    .map((campaign) => {
      const sentAtMs = Number(campaign.sentAtMs) || 0;
      const couponCode = campaign.couponCode || null;

      if (!couponCode) {
        return {
          id: campaign.id,
          title: campaign.title || "",
          audienceCount: Number(campaign.audienceCount) || 0,
          couponCode: null,
          sentAtMs,
          isAttributable: false,
          attributedOrders: null,
          attributedRevenue: null,
        };
      }

      const matchedOrders = orderList.filter((o) =>
        o.status === "delivered" &&
        o.appliedCoupon?.code === couponCode &&
        (Number(o.createdAt) || 0) >= sentAtMs
      );
      const attributedRevenue = matchedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

      return {
        id: campaign.id,
        title: campaign.title || "",
        audienceCount: Number(campaign.audienceCount) || 0,
        couponCode,
        sentAtMs,
        isAttributable: true,
        attributedOrders: matchedOrders.length,
        attributedRevenue,
      };
    })
    .sort((a, b) => b.sentAtMs - a.sentAtMs);
}

/**
 * "Eng yaxshi marketing kampaniyasi" — faqat DAROMAD ATRIBUTSIYASI
 * mumkin bo'lgan (promokodli) VA kamida bitta sotuvga olib kelgan
 * kampaniyalar orasidan tanlanadi. Hech qanday shunday kampaniya
 * bo'lmasa — `null` (soxta "eng yaxshisi" o'ylab topilmaydi).
 *
 * @param {Array} campaignStats - `computeCampaignStats` natijasi
 */
export function getBestCampaign(campaignStats) {
  const attributable = (Array.isArray(campaignStats) ? campaignStats : [])
    .filter((c) => c.isAttributable && c.attributedRevenue > 0);
  if (attributable.length === 0) return null;
  return attributable.reduce((best, c) => (c.attributedRevenue > best.attributedRevenue ? c : best));
}
