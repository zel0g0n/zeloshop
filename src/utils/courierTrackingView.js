/**
 * `CourierTrackingPage.jsx` (mijozning kuryerni jonli kuzatish
 * sahifasi) qaysi ko'rinishni ko'rsatishi kerakligini ANIQLAYDIGAN
 * SOF funksiya — komponentning render mantig'idan ALOHIDA chiqarilgan,
 * chunki bu yerdagi holatlar KETMA-KETLIGI (yuklanmoqda -> kirish
 * xatosi -> topilmadi -> kuryer yo'q -> bosqichlar) aynan xato qilish
 * OSON joy — sinov shu ustuvorlikni aniq tasdiqlaydi.
 *
 * @returns {"loading"|"accessError"|"notFound"|"noCourierYet"|"assigned"|"pickedUp"|"delivered"|"failed"|"unknown"}
 */
export const resolveTrackingView = ({ loading, accessError, order }) => {
  if (loading) return "loading";
  if (accessError) return "accessError";
  if (!order) return "notFound";
  if (!order.courierId) return "noCourierYet";
  switch (order.courierDeliveryStatus) {
    case "assigned":
      return "assigned";
    case "picked_up":
      return "pickedUp";
    case "delivered":
      return "delivered";
    case "failed":
      return "failed";
    default:
      // Kutilmagan/eski maydon holati - "kuryer hali yo'q" bilan BIR
      // XIL, xavfsiz ("noma'lum" bo'sh ekran ko'rsatishdan ko'ra)
      // muqobil ko'rinishga tushadi.
      return "unknown";
  }
};
