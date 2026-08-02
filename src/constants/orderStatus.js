// OLDIN: faqat 3 ta status bor edi (new/approved/cancel) — bu haqiqiy
// buyurtma jarayonini (to'lov kutish, yig'ish, yo'lda, yetkazish)
// aks ettirmasdi. Endi 6 ta mantiqiy bosqich:
export const ORDER_STATUS_LABELS = {
  pending: { label: "Kutilmoqda", shortLabel: "Kutilmoqda", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  new: { label: "Yangi", shortLabel: "Yangi", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" },
  processing: { label: "Yig'ilmoqda", shortLabel: "Yig'ilmoqda", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  shipped: { label: "Yo'lda", shortLabel: "Yo'lda", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  delivered: { label: "Yetkazildi", shortLabel: "Yetkazildi", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  cancel: { label: "Bekor qilindi", shortLabel: "Bekor qilindi", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
};

export const getOrderStatusInfo = (status) =>
  ORDER_STATUS_LABELS[status] || ORDER_STATUS_LABELS.new;

// Tab panelida ko'rsatiladigan tartib.
export const ORDER_STATUS_TABS = ["pending", "new", "processing", "shipped", "delivered", "cancel"];

// Har bir status uchun "keyingi bosqich" tugmasi — dinamik CTA.
export const NEXT_STATUS_ACTION = {
  pending: { next: "new", label: "✅ Yangi deb belgilash" },
  new: { next: "processing", label: "✅ Tasdiqlash" },
  processing: { next: "shipped", label: "🛵 Kuryerga topshirish" },
  shipped: { next: "delivered", label: "🏆 Yetkazildi deb belgilash" },
  delivered: null,
  cancel: null,
};

// "Bekor qilish" tugmasi qaysi statuslarda ko'rsatiladi (yakuniy
// bosqichlarda — yetkazilgan yoki allaqachon bekor qilingan — endi
// bekor qilib bo'lmaydi).
export const CAN_CANCEL_STATUSES = ["pending", "new", "processing", "shipped"];

export const CANCEL_REASONS = [
  "Mijoz rad etdi",
  "Omborda tovar yo'q",
  "Aloqaga chiqmadi",
  "Boshqa sabab",
];
