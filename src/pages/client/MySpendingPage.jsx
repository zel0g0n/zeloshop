import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, ShoppingBag, TrendingUp, Award } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useSession } from "@/context/SessionContext";
import useGetClientOrdersData from "@/hooks/seller/useClientOrder";
import { computeClientSpendingSummary, buildMonthlySpendingSeries } from "@/utils/clientSpending";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/context/LanguageContext";

/**
 * GRAFIK UCHUN TO'LIQ MOSLASHTIRILGAN TOOLTIP.
 *
 * MUHIM TUZATISH: OLDIN Recharts'ning STANDART tooltip'i ishlatilgan
 * edi (`formatter` prop orqali) - bu, brauzerning oddiy, hech qanday
 * dizaynga mos kelmaydigan oq quti ko'rinishida chiqadi (yumaloq
 * burchaklar yo'q, soya yo'q, ilovaning rangiga mos emas, qorong'i
 * rejimda esa umuman noto'g'ri ko'rinadi - oq fonda oq matn kabi).
 * Endi - to'liq o'zimiz loyihalagan, ilovaning boshqa kartalariga
 * mos (yumaloq burchak, soya, aniq tipografiya) tooltip. Bu -
 * ODDIY HTML (Recharts'ning `content` orqali), SVG emas - shuning
 * uchun Tailwind'ning `dark:` sinflari TO'G'RIDAN-TO'G'RI ishlaydi
 * (alohida JS darajasidagi tema aniqlashga hojat yo'q - ProfitDeepDive
 * grafigidagi kabi, u yerda esa SVG elementlar `fill` orqali
 * bo'yalgani uchun aniq HEX rang kerak bo'lgan edi).
 */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const value = Number(payload[0]?.value) || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs font-black text-blue-600 dark:text-blue-400">{value.toLocaleString()} so'm</p>
    </div>
  );
};

/**
 * XARIDORNING SHAXSIY XARAJATLARI — sotuvchining P&L Dashboard'iga
 * o'xshash, lekin XARIDOR uchun soddalashtirilgan ko'rinish: shu
 * do'kondan qancha pul sarflagani, nechta buyurtma bergani, o'rtacha
 * buyurtma qiymati va eng ko'p xarid qilgan mahsuloti.
 *
 * MUHIM: bu yerda HECH QANDAY yangi Firestore so'rovi yo'q -
 * "Buyurtmalarim" sahifasi allaqachon yuklab olgan ma'lumot qayta
 * ishlatiladi (`useGetClientOrdersData` - Redux orqali keshlangan).
 */
const MySpendingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { clientId, sellerId } = useSession();
  const { orders = [], loading } = useGetClientOrdersData(clientId, sellerId);

  const summary = useMemo(() => computeClientSpendingSummary(orders), [orders]);
  const monthlySeries = useMemo(() => buildMonthlySpendingSeries(orders, 6), [orders]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">{t("mySpending.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        {loading ? (
          <ListSkeleton count={3} />
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] p-6 text-white shadow-lg shadow-blue-600/20">
              <div className="flex items-center gap-2 text-white/70 mb-1">
                <Wallet size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t("mySpending.totalSpentLabel")}</span>
              </div>
              <p className="text-2xl font-black">{summary.totalSpent.toLocaleString()} so'm</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3.5">
                <ShoppingBag size={14} className="text-blue-600 dark:text-blue-400 mb-1.5" />
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{t("mySpending.deliveredOrdersLabel")}</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5">{summary.deliveredCount} ta</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3.5">
                <TrendingUp size={14} className="text-emerald-500 mb-1.5" />
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{t("mySpending.averageOrderLabel")}</p>
                <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5 truncate">{summary.averageOrderValue.toLocaleString()} so'm</p>
              </div>
            </div>

            {summary.topProductName && (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Award size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("mySpending.favoriteProductLabel")}</p>
                  <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5 truncate">{summary.topProductName}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">{t("mySpending.timesOrdered", { count: summary.topProductQty })}</p>
                </div>
              </div>
            )}

            {summary.deliveredCount > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">{t("mySpending.monthlyChartLabel")}</p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySeries}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.06)" }} />
                      <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {summary.totalOrderCount === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">{t("mySpending.emptyState")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MySpendingPage;
