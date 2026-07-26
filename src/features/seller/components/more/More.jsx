import React, { useState } from 'react';

const MorePage = ({ onNavigate }) => {
  // Sotuvchi do'konining statik ma'lumotlari (Dizayndagi Shahnoza Cosmetics misolida)
  const [storeInfo] = useState({
    name: 'Shahnoza Cosmetics',
    username: '@shahnoza_cosmetics',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    balance: "5,250,000 so'm"
  });

  // Dizayndagi barcha sahifalar ro'yxatidan kelib chiqqan menyu guruhlari
  const menuGroups = [
    {
      title: "Asosiy boshqaruv",
      items: [
        { id: 'analitika', name: 'Analitika va Hisobotlar', icon: '📊', desc: 'Savdo grafigi va eng ko‘p sotilgan mahsulotlar' },
        { id: 'mijozlar', name: 'Mijozlar bazasi', icon: '👥', desc: 'Xaridorlar ro‘yxati va ularning buyurtmalari' },
        { id: 'tolovlar', name: 'To‘lovlar tarixi', icon: '💳', desc: `Yechib olingan pullar: ${storeInfo.balance}` },
      ]
    },
    {
      title: "Do'kon va Marketing",
      items: [
        { id: 'marketing', name: 'Marketing (Kuponlar)', icon: '🎯', desc: 'Chegirmalar va reklama bannerlarini yaratish' },
        { id: 'sozlamalar', name: 'Do‘kon sozlamalari', icon: '⚙️', desc: 'Logotip, do‘kon nomi va bio ma’lumotlar' },
        { id: 'bildirishnomalar', name: 'Bildirishnomalar', icon: '🔔', desc: 'Buyurtma va to‘lov haqidagi xabarlar sozlamasi' },
      ]
    },
    {
      title: "Tizim",
      items: [
        { id: 'profil', name: 'Profil sozlamalari', icon: '👤', desc: 'Shaxsiy ma’lumotlar va xavfsizlik' },
        { id: 'til', name: 'Ilova tili', icon: '🌐', desc: 'O‘zbekcha (Lotin)' },
      ]
    }
  ];

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24 font-sans border-x border-gray-200 shadow-xl">
      
      {/* 1. HEADER */}
      <div className="p-4 bg-white sticky top-0 shadow-sm z-10">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Ko‘proq</h1>
      </div>

      {/* 2. SOTUVCHI PROFILI KARTASI (Dizayndagi 11. Profil qismiga mos) */}
      <div className="p-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={storeInfo.avatar} 
              alt={storeInfo.name} 
              className="w-14 h-14 object-cover rounded-full border-2 border-indigo-100"
            />
            <div>
              <h2 className="text-base font-extrabold text-gray-800 leading-tight">{storeInfo.name}</h2>
              <p className="text-xs text-gray-400">{storeInfo.username}</p>
              {/* Balans indikatori */}
              <span className="inline-block mt-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                Balans: {storeInfo.balance}
              </span>
            </div>
          </div>
          
          {/* Sozlamalarga o'tish tezkor tugmasi */}
          <button 
            onClick={() => onNavigate && onNavigate('profil')}
            className="p-2 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3. MENYU RO'YXATI (Guruhlangan holda) */}
      <div className="px-4 space-y-6">
        {menuGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-2">
            {/* Guruh Sarlavhasi */}
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
              {group.title}
            </h3>
            
            {/* Guruh ichidagi elementlar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate && onNavigate(item.id)}
                  className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Ikonka foni */}
                    <div className="w-9 h-9 bg-gray-50 group-hover:bg-indigo-50 text-base rounded-xl flex items-center justify-center transition-all">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-all">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Arrow iqon */}
                  <span className="text-gray-300 group-hover:text-indigo-400 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 4. CHIQISH TUGMASI */}
      <div className="p-4 mt-4">
        <button 
          onClick={() => alert("Statik tizim: Tizimdan chiqildi.")}
          className="w-full py-3.5 border border-red-100 text-red-500 rounded-xl font-bold text-sm bg-white hover:bg-red-50 transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Tizimdan chiqish
        </button>
        <p className="text-center text-[10px] text-gray-300 mt-4 font-semibold tracking-wide">
          SaaS Platform v1.0.0 (Beta)
        </p>
      </div>

    </div>
  );
}

export default MorePage;