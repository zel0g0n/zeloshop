// "pending" statusi qasddan mavjud emas: buyurtmalar har doim
// to'g'ridan-to'g'ri "new" status bilan yaratiladi (`orders.js`dagi
// `createOrder`), oraliq "pending" bosqichi umuman ishlatilmaydi. Shu
// sababli bu yerda faqat haqiqatda qo'llaniladigan 5 ta bosqich mavjud:
//
// Bu yerda faqat rang va status kaliti (`key`) qaytariladi — matnning
// o'zi emas. Chaqiruvchi tomon `t(\`orderStatus.${statusInfo.key}\`)`
// orqali joriy tilga mos matnni oladi; bu tarjima mantiqini
// markazlashtirib, har bir chaqiruvchi komponentda alohida tarjima qilish
// zaruratini oldini oladi.
export const ORDER_STATUS_LABELS = {
  new: { key: "new", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" },
  processing: { key: "processing", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  shipped: { key: "shipped", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  delivered: { key: "delivered", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  cancel: { key: "cancel", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
};

export const getOrderStatusInfo = (status) =>
  ORDER_STATUS_LABELS[status] || ORDER_STATUS_LABELS.new;

// Tab panelida ko'rsatiladigan tartib.
export const ORDER_STATUS_TABS = ["new", "processing", "shipped", "delivered", "cancel"];

// Har bir status uchun "keyingi bosqich" tugmasi — dinamik CTA. Matnlar
// emoji ishlatmaydi; tugmada ko'rsatiladigan ikonka `lucide-react`dan,
// OrderCard.jsx ichida statusga qarab alohida tanlanadi. `labelKey` tarjima
// kaliti sifatida ishlatiladi — chaqiruvchi tomon
// `t(\`orderStatus.actions.${labelKey}\`)` orqali oladi.
export const NEXT_STATUS_ACTION = {
  new: { next: "processing", labelKey: "confirmAndCollect" },
  processing: { next: "shipped", labelKey: "handToCourier" },
  shipped: { next: "delivered", labelKey: "markAsDelivered" },
  delivered: null,
  cancel: null,
};

// "Bekor qilish" tugmasi qaysi statuslarda ko'rsatiladi (yakuniy
// bosqichlarda — yetkazilgan yoki allaqachon bekor qilingan — endi
// bekor qilib bo'lmaydi).
export const CAN_CANCEL_STATUSES = ["new", "processing", "shipped"];

// "Buyurtmalar tarixi"dan (Yetkazildi/Bekor qilindi) o'chirish tugmasi
// qaysi statuslarda ko'rsatiladi — faqat yakunlangan bosqichlarda. Bu
// haqiqiy o'chirish emas: buyurtma faqat `hiddenAt` maydoni bilan
// ro'yxatdan yashiriladi. Daromad/analitika hisob-kitoblari
// (`computeDeliveredRevenue`, `computeActiveOrdersCount`) `hiddenAt`ni
// tekshirmaydi, shuning uchun yashirilgan buyurtmalar baribir hisobga
// kiraveradi.
export const CAN_HIDE_STATUSES = ["delivered", "cancel"];

// Bekor qilish sabablari tarjima kaliti sifatida ishlatiladi (chaqiruvchi
// `t(\`orderStatus.cancelReasons.${key}\`)` orqali oladi).
export const CANCEL_REASON_KEYS = ["customerDeclined", "outOfStock", "unreachable", "other"];
