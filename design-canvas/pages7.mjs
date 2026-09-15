import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

// ---------- SellerReferral ----------
pages.push({
  file: "SellerReferral.dc.html",
  activeNav: 4,
  headerHtml: header("Sotuvchi taklif qiling", null),
  body: `
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border:none;color:#fff;text-align:center;padding:22px 16px;">
    <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;"><svg class="i" width="20" height="20" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M8 8a2.5 2.5 0 010-5C10 3 12 8 12 8s2-5 4-5a2.5 2.5 0 010 5"/></svg></div>
    <p style="font-size:15px;font-weight:900;margin:0;line-height:1.4;">3 ta sotuvchi taklif qiling,<br/>Pro'ni bepul oling!</p>
    <p style="font-size:10px;opacity:.85;margin:8px 0 0;">Har biri pullik obunani tasdiqlagach, sizga 30 kunlik Z-Pro tarifi beriladi</p>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Sizning taklif havolangiz</p>
    <div class="input" style="font-family:monospace;font-size:10px;color:#64748B;margin-bottom:8px;">t.me/zeloshop_bot?start=inv_8213</div>
    <button class="btn-primary" style="width:100%;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Sotuvchilarga ulashish</button>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;text-align:center;"><p style="font-size:16px;font-weight:900;margin:0;">5</p><p class="lbl" style="margin:0;">Taklif qilingan</p></div>
    <div class="card" style="padding:10px;text-align:center;"><p style="font-size:16px;font-weight:900;margin:0;">2</p><p class="lbl" style="margin:0;">Obuna bo'lgan</p></div>
    <div class="card" style="padding:10px;text-align:center;"><p style="font-size:16px;font-weight:900;margin:0;">0</p><p class="lbl" style="margin:0;">Mukofot olingan</p></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;"><span class="field-lbl" style="margin:0;">Keyingi mukofotgacha</span><span style="font-weight:800;">2/3</span></div>
    <div class="progress"><div class="progress-fill" style="width:66%;background:#4F46E5;"></div></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/></svg><p class="lbl" style="margin:0;">Qanday ishlaydi</p></div>
    ${["Havolani ulashing", "Sotuvchi ro'yxatdan o'tadi", "3 nafari pullik Pro sotib olsa — sizga bepul!"].map((s, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><div style="width:20px;height:20px;border-radius:50%;background:#EEF2FF;color:#4F46E5;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div><span style="font-size:11px;color:#334155;">${s}</span></div>`).join("")}
  </div>
  `,
});

// ---------- BundleManagement ----------
pages.push({
  file: "BundleManagement.dc.html",
  activeNav: 4,
  headerHtml: header("Mahsulot bandllari", "Combo takliflar yarating"),
  body: `
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg><p class="lbl" style="margin:0;">Yangi combo yaratish</p></div>
    <div class="input" style="margin-bottom:10px;color:#94A3B8;">Combo nomi (masalan: Yozgi to'plam)</div>
    <p class="field-lbl">Mahsulotlar tanlangan (2)</p>
    <div class="input" style="gap:8px;color:#94A3B8;margin-bottom:8px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>Mahsulot qidirish...</div>
    ${["Bolalar kombinezoni — 79 000 so'm", "Yozgi shim — 45 000 so'm"].map((n) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
      <div style="width:16px;height:16px;border-radius:5px;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;"><svg class="i" width="10" height="10" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>
      <div style="width:32px;height:32px;border-radius:8px;background:#F1F5F9;"></div>
      <span style="flex:1;font-size:11px;font-weight:700;">${n}</span>
    </div>`).join("")}
    <p class="field-lbl" style="margin-top:10px;">Combo narxi</p>
    <div class="input" style="margin-bottom:8px;">105 000</div>
    <div style="background:#ECFDF5;border-radius:10px;padding:8px 10px;font-size:10px;color:#059669;margin-bottom:10px;">Alohida narx: <s>124 000</s> — tejash: 19 000 so'm</div>
    <button class="btn-primary" style="width:100%;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Combo yaratish</button>
  </div>
  <p class="lbl">Mavjud combo takliflar</p>
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">Yozgi to'plam</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">2 ta mahsulot · 105 000 so'm</p></div>
    <div class="switch switch-on" style="transform:scale(.8);"><div class="switch-dot" style="right:2px;"></div></div>
    <svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
  </div>
  `,
});

// ---------- AutomationRules ----------
pages.push({
  file: "AutomationRules.dc.html",
  activeNav: 4,
  headerHtml: header("Avtomatlashtirish", "AGAR → BO'LSA → U HOLDA"),
  body: `
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;display:flex;align-items:center;gap:8px;">
    <svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#B45309;"><path d="M2 8l4 4 6-8 6 8 4-4-2 11H4z"/></svg>
    <span style="flex:1;font-size:10px;color:#92400E;">Bu bo'lim faqat Z-Biznes tarifida mavjud</span>
    <svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#B45309;"><path d="M9 18l6-6-6-6"/></svg>
  </div>
  <div style="opacity:.4;pointer-events:none;">
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v4a2 2 0 002 2H14"/></svg><p class="lbl" style="margin:0;">Yangi qoida</p></div>
    <div class="input" style="margin-bottom:10px;color:#94A3B8;">Qoida nomi</div>
    <p class="field-lbl">QACHON (trigger)</p>
    <div class="input" style="justify-content:space-between;margin-bottom:10px;">Mijoz faolsizligi<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
    <p class="field-lbl">U HOLDA (harakat)</p>
    <div class="input" style="justify-content:space-between;margin-bottom:10px;">Mijozga Telegram xabar<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
    <button class="btn-primary" style="width:100%;">Qoida yaratish</button>
  </div>
  <div class="card">
    <p style="font-size:12px;font-weight:800;margin:0 0 6px;">VIP mijozlarni eslatish</p>
    <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#64748B;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>30 kun faolsiz<svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M22 2L11 13"/></svg>Telegram xabar</div>
    <p style="font-size:9px;color:#059669;margin:6px 0 0;">14 marta ishga tushdi</p>
  </div>
  </div>
  `,
});

// ---------- PricingSuggestions ----------
pages.push({
  file: "PricingSuggestions.dc.html",
  activeNav: 4,
  headerHtml: header("AI narx tavsiyalari", "Haftalik narx tahlili"),
  body: `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div class="icn-btn" style="background:#F5F3FF;color:#7C3AED;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg></div>
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">Narx tavsiyalarini yoqish</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">Har hafta dushanba kuni tahlil qilinadi</p></div>
    <div class="switch switch-on"><div class="switch-dot" style="right:2px;"></div></div>
  </div>
  ${[
    ["Bolalar kombinezoni", "79 000", "89 000", "+13%", "up", "Talab yuqori, o'xshash mahsulotlar qimmatroq sotilmoqda"],
    ["Yozgi shim, Pushti", "45 000", "39 000", "-13%", "down", "Sotuv sekinlashgan, narxni pasaytirish aylanmani oshiradi"],
  ].map(([n, old, nw, pct, dir, reason]) => `
  <div class="card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="width:36px;height:36px;border-radius:9px;background:#F1F5F9;flex-shrink:0;"></div>
      <p style="flex:1;font-size:12px;font-weight:800;margin:0;">${n}</p>
      <span class="badge" style="background:${dir === "up" ? "#ECFDF5" : "#EEF2FF"};color:${dir === "up" ? "#059669" : "#4F46E5"};">${pct}</span>
    </div>
    <p style="font-size:12px;margin:0 0 8px;"><span style="text-decoration:line-through;color:#94A3B8;">${old} so'm</span> → <b style="color:${dir === "up" ? "#059669" : "#4F46E5"};">${nw} so'm</b></p>
    <div style="background:#F8FAFC;border-radius:9px;padding:8px 10px;font-size:10px;color:#64748B;margin-bottom:10px;">${reason}</div>
    <div style="display:flex;gap:8px;"><button class="btn-outline" style="flex:1;">Rad etish</button><button class="btn-primary" style="flex:1;">Qo'llash</button></div>
  </div>`).join("")}
  `,
});

// ---------- CommandCenter ----------
pages.push({
  file: "CommandCenter.dc.html",
  activeNav: 4,
  headerHtml: header("Buyruq markazi", "Z-BIZNES · SO'NGGI 30 KUN"),
  body: `
  <div style="display:flex;gap:8px;"><div class="chip">7 kun</div><div class="chip chip-active">30 kun</div><div class="chip">90 kun</div></div>
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;">
    <p style="font-size:10px;color:#92400E;margin:0;line-height:1.5;">📌 O'rtacha chek so'nggi 30 kunda 8% oshdi; qayta xarid darajasi esa oldingi davrga nisbatan pasaygan — mijozlarni qaytarish kampaniyasi tavsiya etiladi.</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    ${[["Daromad", "2 450 000", "#059669"], ["Sof foyda", "780 000", "#4F46E5"], ["Xarajat", "670 000", "#E11D48"], ["Buyurtmalar", "18 ta", "#0F172A"]].map(([l, v, c]) => `<div class="kpi"><p class="lbl" style="margin:0;">${l}</p><p style="font-size:15px;font-weight:900;margin:0;color:${c};">${v}</p></div>`).join("")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    ${[["O'rtacha chek", "136 000"], ["Konversiya", "3.4%"], ["Qayta xarid", "28%"], ["CAC", "24 000"]].map(([l, v]) => `<div class="kpi" style="padding:10px;"><p class="lbl" style="margin:0;">${l}</p><p style="font-size:13px;font-weight:900;margin:0;">${v}</p></div>`).join("")}
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Top / Eng past mahsulotlar</p>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:6px 0;border-bottom:1px solid #F8FAFC;"><span>🏆 Bolalar kombinezoni</span><span style="font-weight:800;color:#059669;">890k</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:6px 0;"><span>⬇ Poyabzal, qora</span><span style="font-weight:800;color:#E11D48;">12k</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;"><div style="display:flex;align-items:center;gap:5px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#D97706;"><path d="M2 8l4 4 6-8 6 8 4-4-2 11H4z"/></svg><p class="lbl" style="margin:0;">Eng yaxshi xodim</p></div><p style="font-size:12px;font-weight:900;margin:6px 0 0;">Aziz — 24 buyurtma</p></div>
    <div class="card" style="padding:10px;"><div style="display:flex;align-items:center;gap:5px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M3 11v2a2 2 0 002 2h1l3 5V6l-3 5H5a2 2 0 00-2 2z"/></svg><p class="lbl" style="margin:0;">Top kampaniya</p></div><p style="font-size:12px;font-weight:900;margin:6px 0 0;">Yozgi -20% — 420k</p></div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Mijoz jalb qilish tendensiyasi</p>
    <div style="height:60px;"><svg viewBox="0 0 300 60" style="width:100%;height:100%;"><polyline points="0,45 60,40 120,30 180,32 240,15 300,20" fill="none" stroke="#4F46E5" stroke-width="2.5"/></svg></div>
  </div>
  `,
});

// ---------- Inbox ----------
pages.push({
  file: "Inbox.dc.html",
  activeNav: 4,
  headerHtml: header("Xabarlar oqimi", null),
  body: `
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><div class="icn-btn" style="width:26px;height:26px;background:#EEF2FF;color:#4F46E5;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 2v4"/></svg></div><span style="font-size:10px;font-weight:800;color:#4F46E5;">AI CEO tavsiyasi</span><span style="margin-left:auto;font-size:9px;color:#94A3B8;">12 daqiqa oldin</span></div>
    <p style="font-size:12px;font-weight:800;margin:0 0 6px;">Chegirma kampaniyasi · Uxlab yotgan mijozlar</p>
    <p style="font-size:11px;color:#64748B;margin:0 0 8px;line-height:1.5;">"Sizni sog'indik! 15% chegirma bilan qaytib keling" xabari 24 ta mijozga yuboriladi.</p>
    <div style="display:flex;gap:6px;margin-bottom:10px;"><span class="badge" style="background:#FFFBEB;color:#B45309;">O'rta xavf</span><span class="badge" style="background:#F8FAFC;color:#64748B;">18 soat qoldi</span></div>
    <div style="display:flex;gap:8px;"><button class="btn-outline" style="flex:1;">Rad etish</button><button class="btn-primary" style="flex:2;">Tasdiqlash va yuborish</button></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="icn-btn" style="background:#FFF7ED;color:#EA580C;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:800;margin:0;">Savatda qolgan mahsulot</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">Malika savatga 2 ta mahsulot qo'shdi</p></div>
      <span style="font-size:9px;color:#94A3B8;">1 soat oldin</span>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="icn-btn" style="background:#ECFDF5;color:#059669;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/></svg></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:800;margin:0;">Referal mukofoti</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">2/3 taklif tasdiqlandi</p></div>
      <span style="font-size:9px;color:#94A3B8;">Kecha</span>
    </div>
  </div>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
