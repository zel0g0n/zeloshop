import { Check, X, Clock } from "lucide-react";
import useTariffRequests from "@/hooks/admin/useTariffRequests";
import { ListSkeleton } from "@/components/ui/Skeleton";

const PLAN_LABELS = { start: "Z-Start", pro: "Z-Pro", biznes: "Z-Biznes" };

function formatRequestTime(createdAt) {
  // Firestore Timestamp (`.toDate()`) VA oddiy raqam/Date ikkalasini
  // ham qo'llab-quvvatlaydi — `serverTimestamp()` ba'zan mahalliy
  // keshda vaqtincha `null` sifatida ko'rinishi mumkin (Firestore
  // offline-first xulqi), shu holatni ham hisobga olamiz.
  if (!createdAt) return "hozirgina";
  const date = typeof createdAt.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "hozirgina";
  return date.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Admin panelidagi "Tarif so'rovlari" bo'limi (2026-09) — sotuvchilar
 * "Tariflar" sahifasidan "Qiziqish bildirish" bosganda kelib tushgan
 * so'rovlarni ko'rsatadi. ILGARI bu so'rovlar FAQAT Telegram DM
 * sifatida kelardi (hech qanday ilova-ichi izi yo'q edi) — endi
 * `tariffRequests` kolleksiyasidan real vaqtda (sahifa ochilganda)
 * o'qiladi.
 *
 * Har bir so'rov uchun ikkita amal: "Tasdiqlash" — to'lov TASHQARIDA
 * (bank o'tkazmasi va h.k.) allaqachon kelishilgandan KEYIN bosiladi,
 * sotuvchining `tariffPlan`ini so'ralgan tarifga o'rnatadi. "Rad
 * etish" — so'rovni ro'yxatdan olib tashlaydi, sotuvchi tarifiga
 * TEGMAYDI.
 */
const AdminTariffRequestsPage = () => {
  const { requests, loading, error, resolvingId, resolveError, resolve } = useTariffRequests();

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        💡 Bu yerda sotuvchilardan kelgan Z-Pro/Z-Biznes tarifiga o'tish so'rovlari ko'rinadi. To'lov (bank o'tkazmasi va h.k.) tashqarida kelishilgach, "Tasdiqlash"ni bosing — sotuvchining tarifi darhol yangilanadi.
      </div>

      {loading && <ListSkeleton count={3} />}

      {!loading && error && (
        <div className="text-center py-16 text-sm text-rose-500 font-medium">Xatolik: {error}</div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-slate-500">
          Hozircha kutilayotgan tarif so'rovi yo'q
        </div>
      )}

      {resolveError && <p className="text-xs text-rose-500 font-semibold text-center">{resolveError}</p>}

      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => {
            const isResolving = resolvingId === req.id;
            return (
              <div key={req.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{req.storeName || "Nomsiz do'kon"}</h3>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{req.phone || "Telefon yo'q"}</p>
                  </div>
                  <span className="shrink-0 text-[9px] font-black px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock size={10} /> {formatRequestTime(req.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {PLAN_LABELS[req.currentPlan] || req.currentPlan}
                  </span>
                  <span>→</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                    {PLAN_LABELS[req.requestedPlan] || req.requestedPlan}
                  </span>
                </div>

                {req.message && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 leading-relaxed">{req.message}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(req, "dismiss")}
                    disabled={isResolving}
                    className="flex-1 h-9 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <X size={13} /> Rad etish
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(req, "approve")}
                    disabled={isResolving}
                    className="flex-1 h-9 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Check size={13} /> {isResolving ? "..." : "Tasdiqlash"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminTariffRequestsPage;
