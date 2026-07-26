import React, { useState } from "react";

// ==========================================
// PROFESSIONAL PREMIUM MOCK DATA (VAU EFFECT UCHUN)
// ==========================================
const STORE_DATA_BY_TIMEFRAME = {
  Bugun: {
    todaySales: "12,450,000 so'm",
    salesGrowth: "+12% kechagiga nisbatan",
    ordersCount: 24,
    ordersGrowth: "+8%",
    productsCount: 48,
    progressPercent: 78, // Bugungi reja bajarilishi
    recentOrders: [
      { id: "#1258", customer: "Azizbek", amount: "350,000 so'm", time: "12:34", status: "Yangi", statusColor: "bg-purple-100 text-purple-700" },
      { id: "#1257", customer: "Madina", amount: "120,000 so'm", time: "11:15", status: "Jo'natildi", statusColor: "bg-blue-100 text-blue-700" },
      { id: "#1256", customer: "Jahongir", amount: "220,000 so'm", time: "09:40", status: "Yetkazildi", statusColor: "bg-emerald-100 text-emerald-700" }
    ]
  },
  Hafta: {
    todaySales: "84,900,000 so'm",
    salesGrowth: "+24% o'tgan haftaga nisbatan",
    ordersCount: 168,
    ordersGrowth: "+15%",
    productsCount: 48,
    progressPercent: 92,
    recentOrders: [
      { id: "#1258", customer: "Azizbek", amount: "350,000 so'm", time: "Bugun", status: "Yangi", statusColor: "bg-purple-100 text-purple-700" },
      { id: "#1250", customer: "Shaxzod", amount: "1,450,000 so'm", time: "Kecha", status: "Yetkazildi", statusColor: "bg-emerald-100 text-emerald-700" },
      { id: "#1248", customer: "Nigora", amount: "520,000 so'm", time: "25-May", status: "Yetkazildi", statusColor: "bg-emerald-100 text-emerald-700" }
    ]
  },
  Oy: {
    todaySales: "342,000,000 so'm",
    salesGrowth: "+8% o'tgan oyga nisbatan",
    ordersCount: 712,
    ordersGrowth: "+11%",
    productsCount: 52,
    progressPercent: 85,
    recentOrders: [
      { id: "#1258", customer: "Azizbek", amount: "350,000 so'm", time: "Bugun", status: "Yangi", statusColor: "bg-purple-100 text-purple-700" },
      { id: "#1190", customer: "Dilshod", amount: "2,100,000 so'm", time: "18-May", status: "Yetkazildi", statusColor: "bg-emerald-100 text-emerald-700" },
      { id: "#1102", customer: "Sevara", amount: "80,000 so'm", time: "10-May", status: "Bekor qilindi", statusColor: "bg-rose-100 text-rose-700" }
    ]
  }
};

const Dashboard = () => {
  const [timeframe, setTimeframe] = useState("Bugun"); // Bugun, Hafta, Oy
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState("Shahnoza Cosmetics");

  // Joriy vaqt mantiqi bo'yicha datani tanlab olish
  const activeData = STORE_DATA_BY_TIMEFRAME[timeframe];

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased relative">
      
      {/* ==========================================
          HEADER: DO'KON TANLASH MODAL OYNASI BILAN
         ========================================== */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between bg-white shadow-xs sticky top-0 z-40">
        <button 
          onClick={() => setIsStoreModalOpen(true)}
          className="flex items-center gap-1.5 active:opacity-80 transition-all group"
        >
          <span className="text-base font-black text-slate-800 tracking-tight">
            {currentStore}
          </span>
          <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
          <span>LIVE CONTROLLER</span>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-28">

        {/* ==========================================
            WOW EFFECT 1: VAQT FILTRLARI (QUICK SWITCH)
           ========================================== */}
        <div className="bg-slate-200/60 p-1 rounded-xl grid grid-cols-3 text-center text-xs font-black text-slate-500">
          {["Bugun", "Hafta", "Oy"].map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`py-2 rounded-lg transition-all ${
                timeframe === t 
                  ? "bg-white text-[#5346E0] shadow-xs scale-[1.02]" 
                  : "hover:text-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        
        {/* ==========================================
            WOW EFFECT 2: PREMIUM ANALITIKA BANNERI
           ========================================== */}
        <div className="bg-[#5346E0] rounded-[24px] p-5 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
          {/* Orqa fondagi chiroyli gradient effekt burchaklari */}
          <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex justify-between items-center z-10 relative">
            <div>
              <span className="text-[10px] font-bold text-indigo-200/90 uppercase tracking-wider">
                {timeframe}gi umumiy savdo
              </span>
              <div className="text-2xl font-black tracking-tight mt-1 animate-fade-in">
                {activeData.todaySales}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                <span>🔺</span> {activeData.salesGrowth}
              </div>
            </div>

            {/* Doiraviy Progress bar (Wow effect unikal vizual) */}
            <div className="relative w-16 h-16 flex items-center justify-center bg-white/10 rounded-full backdrop-blur-md border border-white/10">
              <span className="text-xs font-black text-white">{activeData.progressPercent}%</span>
              <span className="text-[8px] font-medium text-indigo-200 absolute bottom-1.5">reja</span>
            </div>
          </div>
        </div>

        {/* ==========================================
            KPI MINI KARTALARI
           ========================================== */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Buyurtmalar</span>
            <div className="text-xl font-black text-slate-800 mt-1">{activeData.ordersCount} ta</div>
            <span className="text-[10px] font-black text-emerald-500 block mt-1">{activeData.ordersGrowth} o'sish</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Faol Katalog</span>
            <div className="text-xl font-black text-slate-800 mt-1">{activeData.productsCount} xil</div>
            <span className="text-[10px] font-medium text-slate-400 block mt-1">100% integratsiya</span>
          </div>
        </div>

        {/* ==========================================
            WOW EFFECT 3: TEZKOR AMALLAR PANELI (QUICK ACTIONS)
           ========================================== */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 px-1">⚡️ Tezkor amallar</h3>
          <div className="grid grid-cols-3 gap-2">
            <button className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform">
              <span className="text-base">📦</span>
              <span className="text-[10px] font-black text-slate-700 leading-tight">Yangi Tovar</span>
            </button>
            <button className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform">
              <span className="text-base">🎟</span>
              <span className="text-[10px] font-black text-slate-700 leading-tight">Kupon Kod</span>
            </button>
            <button className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition-transform">
              <span className="text-base">📣</span>
              <span className="text-[10px] font-black text-slate-700 leading-tight">E'lon Berish</span>
            </button>
          </div>
        </div>

        {/* ==========================================
            SO'NGGI BUYURTMALAR RO'YXATI
           ========================================== */}
        <div>
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">So'nggi buyurtmalar</h3>
            <button className="text-xs font-bold text-[#5346E0] hover:underline">Barchasi &gt;</button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden divide-y divide-slate-50">
            {activeData.recentOrders.map((order) => (
              <div key={order.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800">{order.id}</span>
                    <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1 rounded">{order.time}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Mijoz: @{order.customer}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs font-black text-slate-800">{order.amount}</div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${order.statusColor}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ==========================================
          MODAL OYNA: REAL DO'KONLAR RO'YXATI (SXEMADAGI 2-BOSQICH)
         ========================================== */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-800">Do'koningiz</h3>
              <button 
                onClick={() => setIsStoreModalOpen(false)}
                className="w-7 h-7 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Do'kon 1 */}
              <div 
                onClick={() => { setCurrentStore("Shahnoza Cosmetics"); setIsStoreModalOpen(false); }}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                  currentStore === "Shahnoza Cosmetics" ? "bg-indigo-50/50 border-indigo-200" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-600 text-white font-black text-sm flex items-center justify-center rounded-xl">SC</div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Shahnoza Cosmetics</h5>
                    <span className="text-[10px] text-slate-400 font-medium">@shahnoza_cosmetics</span>
                  </div>
                </div>
                {currentStore === "Shahnoza Cosmetics" && <div className="w-4 h-4 border-4 border-indigo-600 rounded-full bg-white"></div>}
              </div>

              {/* Do'kon 2 */}
              <div 
                onClick={() => { setCurrentStore("Anime Uz Shop"); setIsStoreModalOpen(false); }}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                  currentStore === "Anime Uz Shop" ? "bg-indigo-50/50 border-indigo-200" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-amber-500 text-white font-black text-sm flex items-center justify-center rounded-xl">AU</div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Anime Uz Shop</h5>
                    <span className="text-[10px] text-slate-400 font-medium">@anime_uz</span>
                  </div>
                </div>
                {currentStore === "Anime Uz Shop" && <div className="w-4 h-4 border-4 border-indigo-600 rounded-full bg-white"></div>}
              </div>
            </div>

            <button className="w-full h-11 border border-dashed border-[#5346E0] text-[#5346E0] font-black text-xs rounded-xl hover:bg-indigo-50 transition-colors mt-2">
              + Yangi do'kon yaratish
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;