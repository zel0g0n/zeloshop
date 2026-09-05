/**
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12) — sof funksiya, ikkita
 * MUSTAQIL manbadan (AI CEO kutilayotgan harakatlari va yuborilgan
 * bildirishnomalar jurnali) kelgan yozuvlarni BITTA, vaqt bo'yicha
 * tartiblangan ro'yxatga birlashtiradi.
 *
 * ATAYLAB: bu ikkita HAQIQIY, ALLAQACHON mavjud ma'lumot manbasini
 * BIRLASHTIRADI, xolos — hech qanday yangi "xabar turi" o'ylab
 * topilmaydi (foydalanuvchi so'ragan uchinchi manba — mijozdan
 * sotuvchiga xabar — kodda mavjud emasligi aniqlanib, ATAYLAB shu
 * MVP doirasidan chiqarib tashlangan).
 */

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  const parsed = new Date(ts).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {object} params
 * @param {Array<object>} params.pendingActions - `sellers/{id}/aiCeoPendingActions` hujjatlari (id bilan)
 * @param {Array<object>} params.notifications - `notificationLogs` hujjatlari (id bilan)
 * @returns {Array<{id: string, kind: "aiCeoAction"|"notification", timestampMs: number, data: object}>}
 */
export function buildInboxFeed({ pendingActions = [], notifications = [] } = {}) {
  const actionItems = (pendingActions || []).map((a) => ({
    id: `action_${a.id}`,
    kind: "aiCeoAction",
    timestampMs: toMillis(a.createdAt),
    data: a,
  }));
  const notificationItems = (notifications || []).map((n) => ({
    id: `notif_${n.id}`,
    kind: "notification",
    timestampMs: toMillis(n.sentAt),
    data: n,
  }));

  return [...actionItems, ...notificationItems].sort((a, b) => b.timestampMs - a.timestampMs);
}
