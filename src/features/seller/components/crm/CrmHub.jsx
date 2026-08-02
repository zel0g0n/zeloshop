import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Gem, AlertTriangle, CheckCircle, Send, Users,
  Bell, PackageX, FileBarChart, Loader2,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCustomerSegments } from "@/hooks/seller/useCustomerSegments";
import { sendCrmNotification } from "@/services/crm/sendNotification";
import updateSeller from "@/services/sellers/updateSeller";
import StatusModal from "@/components/ui/StatusModal";
import { GridSkeleton } from "@/components/ui/Skeleton";

const SEGMENT_META = {
  all: { label: "Barchasi", icon: Users, color: "text-slate-600 dark:text-slate-300" },
  vip: { label: "VIP", icon: Gem, color: "text-amber-600 dark:text-amber-400" },
  churn: { label: "Xavfdagi", icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400" },
  regular: { label: "Doimiy", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400" },
};

// RETENTION-DRIVEN CRM HUB & MULTI-CHANNEL PUSH TERMINAL
//
// MUHIM, HALOL IZOH: mijozlar ro'yxati va segmentatsiya (VIP/Churn/
// Doimiy) — bularning barchasi HAQIQIY buyurtma ma'lumotidan
// hisoblanadi (o'ylab topilmagan). "Telegram Botdagi faollik" alohida
// ko'rsatkich sifatida qo'shilmadi, chunki bunday kuzatuv ilovada
// mavjud emas — buning o'rniga "oxirgi buyurtma qachonligi" ko'rsatiladi,
// bu haqiqiy ma'lumot. Push xabarlar esa — HAQIQIY Telegram Bot API
// orqali yuboriladi (Cloud Function `sendCrmNotification`), simulyatsiya
// emas.
const CrmHub = () => {
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
  const { customers, counts, loading } = useCustomerSegments();

  const [activeSegment, setActiveSegment] = useState("all");
  const [audience, setAudience] = useState("all");
  const [channel, setChannel] = useState("client");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState(null);

  const [prefs, setPrefs] = useState({
    notifyNewOrder: true,
    notifyLowStock: true,
    notifyDailyReport: true,
  });
  const [savingPref, setSavingPref] = useState(null);

  useEffect(() => {
    if (!store) return;
    setPrefs({
      notifyNewOrder: store.notifyNewOrder !== false,
      notifyLowStock: store.notifyLowStock !== false,
      notifyDailyReport: store.notifyDailyReport !== false,
    });
  }, [store]);

  const visibleCustomers = useMemo(() => {
    if (activeSegment === "all") return customers;
    return customers.filter((c) => c.segment === activeSegment);
  }, [customers, activeSegment]);

  const audienceTargetIds = useMemo(() => {
    if (audience === "all") return customers.map((c) => c.clientId);
    return customers.filter((c) => c.segment === audience).map((c) => c.clientId);
  }, [customers, audience]);

  const handleTogglePref = useCallback(async (key) => {
    const next = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: next }));
    setSavingPref(key);
    try {
      await updateSeller(sellerId, { [key]: next });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !next })); // xatolik bo'lsa orqaga qaytaramiz
    } finally {
      setSavingPref(null);
    }
  }, [prefs, sellerId]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendError("Sarlavha va matn kiritilishi shart.");
      return;
    }
    if ((channel === "client" || channel === "both") && audienceTargetIds.length === 0) {
      setSendError("Tanlangan auditoriyada hech qanday mijoz yo'q.");
      return;
    }

    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const result = await sendCrmNotification({
        sellerId,
        targetClientIds: audienceTargetIds,
        channel,
        title,
        message,
      });
      setSendResult(result);
      setTitle("");
      setMessage("");
    } catch (err) {
      setSendError(err.message || "Xabar yuborishda xatolik yuz berdi");
    } finally {
      setSending(false);
    }
  }, [title, message, channel, audienceTargetIds, sellerId]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">CRM va Bildirishnoma Markazi</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mijozlarni ushlab qolish</p>
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* A) MIJOZLAR BAZASI VA SEGMENTATSIYA */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Mijozlar bazasi</h3>

          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(SEGMENT_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const isActive = activeSegment === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSegment(key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                    isActive
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                  }`}
                >
                  <Icon size={15} className={isActive ? "text-white" : meta.color} />
                  <span className={`text-[10px] font-bold ${isActive ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>{meta.label}</span>
                  <span className={`text-[9px] font-black ${isActive ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>{counts[key]}</span>
                </button>
              );
            })}
          </div>

          {loading && <GridSkeleton count={3} />}

          {!loading && visibleCustomers.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">Ushbu segmentda mijoz yo'q</p>
          )}

          {!loading && visibleCustomers.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
              {visibleCustomers.slice(0, 20).map((c) => {
                const meta = SEGMENT_META[c.segment];
                const Icon = meta.icon;
                return (
                  <div key={c.clientId} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.fullName}</p>
                        <Icon size={11} className={meta.color} />
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {c.orderCount} ta buyurtma · {c.daysSinceLastOrder} kun oldin
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-800 dark:text-white shrink-0">{c.ltv.toLocaleString()} so'm</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B) PUSH TERMINAL */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Xabar yuborish terminali</h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Auditoriya</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "all", label: "Barchasi" },
                { value: "vip", label: "Faqat VIP" },
                { value: "churn", label: "Xavfdagilar" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudience(opt.value)}
                  className={`h-9 rounded-xl text-[11px] font-bold transition-all ${
                    audience === opt.value ? "bg-indigo-600 text-white" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Kanal</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "client", label: "Xaridorga" },
                { value: "seller", label: "Sizga" },
                { value: "both", label: "Ikkalasiga" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={`h-9 rounded-xl text-[11px] font-bold transition-all ${
                    channel === opt.value ? "bg-indigo-600 text-white" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-2">
            <input
              type="text"
              disabled={sending}
              placeholder="Sarlavha (masalan: Maxsus chegirma!)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <textarea
              rows="3"
              disabled={sending}
              placeholder="Xabar matni..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            />

            {sendError && <p className="text-[11px] text-rose-500 font-semibold">{sendError}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? "Yuborilmoqda..." : "Yuborish"}
            </button>
          </form>
        </div>

        {/* C) SOTUVCHINING SHAXSIY BILDIRISHNOMA NAZORATI */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider p-4 pb-0">Sizga keladigan bildirishnomalar</h3>

          {[
            { key: "notifyNewOrder", icon: Bell, label: "Yangi buyurtma kelganda", desc: "Har safar yangi buyurtma tushganda darhol xabar" },
            { key: "notifyLowStock", icon: PackageX, label: "Omborda mahsulot qolmaganda", desc: "Stok 3 tagacha tushganda ogohlantirish" },
            { key: "notifyDailyReport", icon: FileBarChart, label: "Kunlik hisobot", desc: "Har kuni sof foyda haqida qisqa xabar" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-50 dark:bg-slate-800 text-indigo-500 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">{item.label}</h4>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{item.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref(item.key)}
                  disabled={savingPref === item.key}
                  className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${prefs[item.key] ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${prefs[item.key] ? "translate-x-5" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {sendResult && (
        <StatusModal
          variant="success"
          title="Xabar yuborildi! 🚀"
          message={`${channel !== "seller" ? `Xaridorlarga: ${sendResult.clientsSent}/${sendResult.clientsTotal} ta yetkazildi. ` : ""}${channel !== "client" ? `Sizga: ${sendResult.sellerNotified ? "yetkazildi ✅" : "yetkazilmadi ❌"}` : ""}`}
          onClose={() => setSendResult(null)}
        />
      )}
    </div>
  );
};

export default CrmHub;
