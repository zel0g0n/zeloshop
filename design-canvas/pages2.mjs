import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

// ---------- EditProduct ----------
pages.push({
  file: "EditProduct.dc.html",
  activeNav: 1,
  headerHtml: header("Mahsulotni tahrirlash", "Bolalar kombinezoni"),
  body: `
  <div class="card"><p class="lbl" style="margin-bottom:8px;">Rasmlar 2/4</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      <div style="aspect-ratio:1;border-radius:10px;background:#F1F5F9;"></div>
      <div style="aspect-ratio:1;border-radius:10px;background:#F1F5F9;"></div>
      ${[1, 2].map(() => `<div style="aspect-ratio:1;border-radius:10px;border:1.5px dashed #E2E8F0;display:flex;align-items:center;justify-content:center;color:#CBD5E1;"><svg class="i" width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>`).join("")}
    </div>
  </div>
  <div class="card">
    <p class="field-lbl">Mahsulot nomi</p>
    <div class="input" style="margin-bottom:10px;">Bolalar kombinezoni</div>
    <p class="field-lbl">Toifa</p>
    <div class="input" style="justify-content:space-between;">Kiyim-kechak<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
  </div>
  <div class="card">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><p class="field-lbl">Tan narxi</p><div class="input">45 000</div></div>
      <div><p class="field-lbl">Sotish narxi</p><div class="input">79 000</div></div>
    </div>
    <div style="background:#ECFDF5;border-radius:10px;padding:10px;margin-top:10px;display:flex;justify-content:space-between;">
      <div><p style="font-size:9px;color:#059669;margin:0;">SOF FOYDA</p><p style="font-size:13px;font-weight:900;color:#059669;margin:2px 0 0;">34 000 so'm</p></div>
      <div style="text-align:right;"><p style="font-size:9px;color:#059669;margin:0;">MARJA</p><p style="font-size:13px;font-weight:900;color:#059669;margin:2px 0 0;">43%</p></div>
    </div>
    <p class="field-lbl" style="margin-top:10px;">Qoldiq (dona)</p>
    <div class="input">18</div>
    <div class="card" style="background:#FFFBEB;border-color:#FDE68A;margin-top:10px;padding:10px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#D97706;"><path d="M12 2L2 20h20z"/><path d="M12 9v5"/></svg><span style="font-size:11px;font-weight:800;color:#92400E;">Qoldiq o'zgardi — sababni tanlang</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <div class="chip chip-active" style="padding:6px 10px;font-size:10px;">To'ldirish</div>
        <div class="chip" style="padding:6px 10px;font-size:10px;">Tuzatish</div>
        <div class="chip" style="padding:6px 10px;font-size:10px;">Nosoz/yo'qolgan</div>
        <div class="chip" style="padding:6px 10px;font-size:10px;">Inventarizatsiya</div>
      </div>
    </div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:10px;">Zaxira harakati tarixi</p>
    ${[
      ["+12", "To'ldirish", "Siz", "bugun, 09:14", "#4F46E5"],
      ["-1", "Buyurtma #1042", "Tizim", "kecha, 18:02", "#94A3B8"],
      ["-2", "Buyurtma #1038", "Xodim: Aziz", "2 kun oldin", "#94A3B8"],
    ].map(([d, r, a, t, c]) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F8FAFC;">
      <span style="font-size:11px;font-weight:900;color:${d.startsWith("+") ? "#059669" : "#E11D48"};width:28px;">${d}</span>
      <div style="flex:1;"><p style="font-size:11px;font-weight:700;margin:0;">${r}</p><p style="font-size:9px;color:#94A3B8;margin:1px 0 0;">${a} · ${t}</p></div>
    </div>`).join("")}
  </div>
  <button class="btn-primary">O'zgarishlarni saqlash</button>
  `,
});

// ---------- Orders ----------
pages.push({
  file: "Orders.dc.html",
  activeNav: 3,
  headerHtml: header("Buyurtmalar", "18 TA FAOL", {
    right: `<div class="chip" style="background:#EEF2FF;border-color:#E0E7FF;color:#4F46E5;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>2.1 mln so'm<svg class="i" width="10" height="10" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>`,
  }),
  body: `
  <div class="input" style="gap:8px;color:#94A3B8;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>Buyurtma qidirish...</div>
  <div style="display:flex;gap:8px;overflow:hidden;">
    <div class="chip chip-active">Yangi (3)</div><div class="chip">Jarayonda (5)</div><div class="chip">Yuborilgan (4)</div><div class="chip">Yetkazilgan (6)</div><div class="chip">Bekor (2)</div>
  </div>
  ${[
    { n: "#1042", t: "6 daqiqa oldin", c: "Malika Yusupova", a: "185 000", st: "Yangi", sc: "#D97706", sb: "#FFFBEB", pay: "Naqd/Yetkazganda" },
    { n: "#1041", t: "44 daqiqa oldin", c: "Nomsiz mijoz", a: "92 000", st: "Jarayonda", sc: "#4F46E5", sb: "#EEF2FF", pay: "Karta orqali" },
  ].map((o) => `
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div><p style="font-size:12px;font-weight:900;margin:0;">${o.n}</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">${o.t}</p></div>
      <span class="badge" style="background:${o.sb};color:${o.sc};">${o.st}</span>
    </div>
    <div class="divider" style="margin:10px 0;"></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;">
      <span style="color:#64748B;">Xaridor: <b style="color:#0F172A;">${o.c}</b></span>
      <span style="font-weight:900;">${o.a} so'm</span>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <span class="badge" style="background:#F8FAFC;color:#64748B;">${o.pay}</span>
      <span class="badge" style="background:#F8FAFC;color:#64748B;">🚚 Yetkazish: bepul</span>
    </div>
  </div>`).join("")}
  `,
});

// ---------- YandexDelivery ----------
pages.push({
  file: "YandexDelivery.dc.html",
  activeNav: 3,
  headerHtml: header("Yandex Delivery", "Buyurtma #1041", { right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></div>` }),
  body: `
  <div class="card" style="padding:0;overflow:hidden;">
    <div style="height:180px;background:linear-gradient(135deg,#E0E7FF,#DBEAFE);position:relative;">
      <div style="position:absolute;top:40%;left:30%;width:10px;height:10px;border-radius:50%;background:#4F46E5;box-shadow:0 0 0 4px rgba(79,70,229,.25);"></div>
      <div style="position:absolute;top:55%;left:65%;width:10px;height:10px;border-radius:50%;background:#059669;box-shadow:0 0 0 4px rgba(5,150,105,.25);"></div>
      <div style="position:absolute;top:46%;left:48%;width:9px;height:9px;border-radius:50%;background:#D97706;box-shadow:0 0 0 4px rgba(217,119,6,.25);"></div>
    </div>
    <div style="display:flex;gap:12px;padding:10px 12px;font-size:9px;color:#64748B;">
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#4F46E5;"></span>Do'kon</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#059669;"></span>Mijoz</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#D97706;"></span>Kuryer</span>
    </div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#6366F1);border:none;color:#fff;">
    <div style="display:flex;align-items:center;gap:8px;"><svg class="i" width="17" height="17" viewBox="0 0 24 24"><rect x="1" y="6" width="14" height="11"/><path d="M15 9h4l3 4v4h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg><span style="font-weight:800;font-size:12px;">Kuryer yo'lda</span></div>
    <p style="font-size:10px;opacity:.85;margin:6px 0 0;">Taxminan 12 daqiqada yetib boradi</p>
    <div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:10px;opacity:.9;">Barcha bosqichlar<svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
  </div>
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div class="avatar" style="width:40px;height:40px;">Ж</div>
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">Javlon (kuryer)</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">Cobalt Damas · 01 A 777 AA</p></div>
    <div class="icn-btn" style="background:#ECFDF5;color:#059669;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">
    ${["Yangilash", "Ulashish", "Qo'ng'iroq", "Yordam", "Bekor qilish"].map((l, i) => `
    <div style="text-align:center;">
      <div class="icn-btn" style="margin:0 auto 4px;${i === 4 ? "background:#FFF1F2;color:#E11D48;" : ""}"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></div>
      <p style="font-size:8px;color:#64748B;margin:0;">${l}</p>
    </div>`).join("")}
  </div>
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
    <span class="lbl" style="margin:0;">Yetkazish narxi</span><span style="font-weight:900;font-size:13px;">18 000 UZS</span>
  </div>
  `,
});

// ---------- OrderAnalytics ----------
pages.push({
  file: "OrderAnalytics.dc.html",
  activeNav: 3,
  headerHtml: header("Buyurtmalar analitikasi", "SO'NGGI 30 KUN", { right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div>` }),
  body: `
  <div style="display:flex;gap:8px;"><div class="chip">Hafta</div><div class="chip chip-active">Oy</div><div class="chip">Chorak</div><div class="chip">Yil</div></div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border:none;color:#fff;">
    <div style="display:flex;align-items:center;gap:6px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M5 4h14l-1 9a6 6 0 01-12 0z"/></svg><span class="lbl" style="color:#C7D2FE;">Yetkazilgan tushum</span></div>
    <p style="font-size:22px;font-weight:900;margin:6px 0 0;">2 450 000 so'm</p>
    <p style="font-size:10px;opacity:.8;margin:2px 0 10px;">18 ta yetkazilgan buyurtma</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">O'rtacha chek</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">136 000</p></div>
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Jami</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">18 ta</p></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg><p style="font-size:14px;font-weight:900;margin:4px 0 0;">24</p><p class="lbl" style="margin:0;">Jami</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#059669;"><path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg><p style="font-size:14px;font-weight:900;margin:4px 0 0;">136k</p><p class="lbl" style="margin:0;">O'rtacha</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg><p style="font-size:14px;font-weight:900;margin:4px 0 0;">8%</p><p class="lbl" style="margin:0;">Bekor foizi</p></div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:10px;">Holat bo'yicha taqsimot</p>
    ${[["Yetkazilgan", 60, "#059669"], ["Yuborilgan", 20, "#4F46E5"], ["Jarayonda", 12, "#D97706"], ["Bekor", 8, "#E11D48"]].map(([l, v, c]) => `
    <div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;"><span>${l}</span><span style="font-weight:800;">${v}%</span></div><div class="progress"><div class="progress-fill" style="width:${v}%;background:${c};"></div></div></div>`).join("")}
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/></svg><p class="lbl" style="margin:0;">Top mijozlar</p></div>
    ${["Malika Yusupova", "Aziz Karimov"].map((n, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div class="avatar" style="width:28px;height:28px;font-size:11px;">${n[0]}</div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:700;margin:0 0 4px;">${n}</p><div class="progress"><div class="progress-fill" style="width:${90 - i * 30}%;background:#4F46E5;"></div></div></div>
      <span style="font-size:10px;font-weight:800;">${520 - i * 150}k</span>
    </div>`).join("")}
  </div>
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#B45309;"><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-9h3l3 4h4"/></svg><p class="lbl" style="margin:0;color:#B45309;">Uxlab qolgan mijozlar</p></div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="avatar" style="width:28px;height:28px;font-size:11px;background:#FEF3C7;color:#B45309;">D</div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:700;margin:0;">Dilnoza</p><p style="font-size:9px;color:#B45309;margin:2px 0 0;">32 kundan beri buyurtma yo'q</p></div>
      <span style="font-size:9px;font-weight:800;color:#4F46E5;display:flex;align-items:center;gap:3px;"><svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg>Xabar</span>
    </div>
  </div>
  `,
});

// ---------- More ----------
function moreRow(icon, title, desc, extra) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;">
    <div class="icn-btn" style="background:#F8FAFC;">${icon}</div>
    <div style="flex:1;min-width:0;"><p style="font-size:12px;font-weight:800;margin:0;">${title}</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">${desc}</p></div>
    ${extra || `<svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#CBD5E1;"><path d="M9 18l6-6-6-6"/></svg>`}
  </div><div class="divider"></div>`;
}
pages.push({
  file: "More.dc.html",
  activeNav: 4,
  headerHtml: header("Ko'proq", null, { noBack: true }),
  body: `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div style="width:44px;height:44px;border-radius:12px;background:#EEF2FF;flex-shrink:0;"></div>
    <div style="flex:1;"><p style="font-size:13px;font-weight:900;margin:0;">Zamira Kids Store</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">Bolalar kiyimi · +998 90 123 45 67</p></div>
    <span class="badge" style="background:#ECFDF5;color:#059669;">● Faol</span>
  </div>
  <div class="card" style="padding:4px 14px;">
    <p class="lbl" style="padding-top:8px;">Boshqaruv</p>
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>`, "Moliya (P&L)", "Foyda-zarar hisoboti")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M2 8l4 4 6-8 6 8 4-4-2 11H4z"/></svg>`, "Buyruq markazi", "Biznesning umumiy ko'rinishi")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/></svg>`, "Mijozlar (CRM)", "Segmentlar va xabarnoma")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>`, "Tariflar", "Joriy: Z-Start")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/></svg>`, "Sotuvchi taklif qiling", "Bepul Pro tarifga ega bo'ling")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3z"/></svg>`, "Xabarlar oqimi", "AI takliflari va bildirishnomalar")}
  </div>
  <div class="card" style="padding:4px 14px;">
    <p class="lbl" style="padding-top:8px;">Integratsiya</p>
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>`, "To'lov tizimlari", "Click, Payme, karta")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="1" y="6" width="14" height="11"/><path d="M15 9h4l3 4v4h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>`, "Yetkazib berish", "Narxlar va Yandex Delivery")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-9h3l3 4h4"/></svg>`, "Kuryerlar", "O'z yetkazib beruvchilaringiz")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`, "Xodimlar", "Jamoa a'zolari va ruxsatlar")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1z"/></svg>`, "Do'kon sozlamalari", "Logo, nom, bio")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`, "Toifalar", "Kategoriyalarni boshqarish")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-11 11"/></svg>`, "Bannerlar", "Katalog sahifasidagi slayder")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 2v4"/></svg>`, "Botlar", "Telegram bot va kanal")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M20.6 3.4A5.5 5.5 0 0012.8 4L12 5l-.8-1a5.5 5.5 0 00-7.8 7.8L12 20l8.6-8.2a5.5 5.5 0 000-7.8z"/></svg>`, "Marketing va promo-kodlar", "Aksiya, sodiqlik, tug'ilgan kun")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`, "Bandllar", "Combo takliflar")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`, "AI narx tavsiyalari", "Haftalik narx tahlili")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v4a2 2 0 002 2H14"/></svg>`, "Avtomatlashtirish", "AGAR → BO'LSA → U HOLDA")}
  </div>
  <div class="card" style="padding:4px 14px;">
    <p class="lbl" style="padding-top:8px;">Bildirishnomalar</p>
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/></svg>`, "Yangi buyurtma xabari", "Push-bildirishnoma", `<div class="switch switch-on" style="transform:scale(.8);"><div class="switch-dot" style="right:2px;"></div></div>`)}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/></svg>`, "Til", "O'zbekcha")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>`, "Mavzu", "Och rang")}
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`, "Maxfiylik va xavfsizlik", "PIN kod himoyasi")}
  </div>
  <div class="card" style="padding:4px 14px;">
    ${moreRow(`<svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>`, "Yordam", "Savol va takliflar")}
  </div>
  <button class="btn-danger">Chiqish</button>
  `,
});

// ---------- PaymentSettings ----------
pages.push({
  file: "PaymentSettings.dc.html",
  activeNav: 4,
  headerHtml: header("To'lov sozlamalari", "Checkout usullari"),
  body: `
  <div class="card">
    <p class="lbl" style="margin-bottom:10px;">Checkout to'lov usullari</p>
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid #4F46E5;background:#EEF2FF;border-radius:12px;margin-bottom:8px;">
      <svg class="i" width="16" height="16" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg>
      <span style="flex:1;font-size:12px;font-weight:800;color:#312E81;">Naqd / Yetkazganda to'lash</span>
      <div style="width:18px;height:18px;border-radius:5px;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;"><svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid #E2E8F0;border-radius:12px;">
      <svg class="i" width="16" height="16" viewBox="0 0 24 24" style="color:#64748B;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <span style="flex:1;font-size:12px;font-weight:800;color:#334155;">Karta orqali oldindan to'lash</span>
      <div style="width:18px;height:18px;border-radius:5px;border:1.5px solid #CBD5E1;"></div>
    </div>
    <button class="btn-primary" style="margin-top:12px;">Saqlash</button>
  </div>
  <div style="display:flex;gap:8px;">
    <div class="chip chip-active" style="flex:1;justify-content:center;">Jismoniy shaxs</div>
    <div class="chip" style="flex:1;justify-content:center;">Yuridik shaxs</div>
  </div>
  <div class="card" style="background:#EEF2FF;border-color:#E0E7FF;display:flex;gap:8px;">
    <svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;flex-shrink:0;"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>
    <p style="font-size:10px;color:#4338CA;margin:0;line-height:1.5;">Mijozlar to'lovni to'g'ridan-to'g'ri sizning shaxsiy kartangizga o'tkazadi.</p>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span class="field-lbl" style="margin:0;">Faollashtirish</span><div class="switch switch-on"><div class="switch-dot" style="right:2px;"></div></div></div>
    <p class="field-lbl">Karta raqami</p>
    <div class="input" style="margin-bottom:10px;font-family:monospace;">8600 12** **** 3456</div>
    <p class="field-lbl">Karta egasining ismi</p>
    <div class="input">ZAMIRA T</div>
  </div>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
