import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

// ---------- ProfitDeepDive ----------
pages.push({
  file: "ProfitDeepDive.dc.html",
  activeNav: 4,
  headerHtml: header("Foyda tahlili", "Chuqur ko'rinish", { right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div>` }),
  body: `
  <div style="display:flex;gap:8px;overflow:hidden;"><div class="chip">Bugun</div><div class="chip">Hafta</div><div class="chip chip-active">Oy</div><div class="chip">Yil</div><div class="chip">Hammasi</div></div>
  <div class="card">
    <div style="height:150px;position:relative;background:linear-gradient(180deg,#EEF2FF 0%,rgba(238,242,255,0) 80%);border-radius:10px;overflow:hidden;">
      <svg viewBox="0 0 300 130" style="width:100%;height:100%;">
        <polyline points="0,90 40,70 80,80 120,50 160,60 200,30 240,45 300,20" fill="none" stroke="#059669" stroke-width="2.5"/>
        <polyline points="0,110 40,100 80,105 120,90 160,95 200,75 240,85 300,65" fill="none" stroke="#4F46E5" stroke-width="2.5"/>
      </svg>
    </div>
    <div style="display:flex;gap:14px;margin-top:8px;font-size:10px;"><span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:2.5px;background:#059669;"></span>Tushum</span><span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:2.5px;background:#4F46E5;"></span>Foyda</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#D97706;"><path d="M8 21h8M12 17v4M5 4h14l-1 9a6 6 0 01-12 0z"/></svg><p style="font-size:11px;font-weight:900;margin:4px 0 0;">18-avg</p><p class="lbl" style="margin:0;">Eng yaxshi kun</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="2" y="7" width="20" height="14" rx="2"/></svg><p style="font-size:11px;font-weight:900;margin:4px 0 0;">26k</p><p class="lbl" style="margin:0;">Kunlik o'rtacha</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#059669;"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg><p style="font-size:11px;font-weight:900;margin:4px 0 0;">+18%</p><p class="lbl" style="margin:0;">Tendensiya</p></div>
  </div>
  `,
});

// ---------- CrmHub ----------
pages.push({
  file: "CrmHub.dc.html",
  activeNav: 4,
  headerHtml: header("CRM Hub", "Mijozlar bilan ishlash"),
  body: `
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/></svg><p style="font-size:13px;font-weight:900;margin:4px 0 0;">142</p><p class="lbl" style="margin:0;">Mijozlar</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#059669;"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg><p style="font-size:13px;font-weight:900;margin:4px 0 0;">210k</p><p class="lbl" style="margin:0;">O'rt. LTV</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#D97706;"><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg><p style="font-size:13px;font-weight:900;margin:4px 0 0;">38%</p><p class="lbl" style="margin:0;">Retensiya</p></div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-color:#FDE68A;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#B45309;"><path d="M2 8l4 4 6-8 6 8 4-4-2 11H4z"/></svg><span style="font-size:11px;font-weight:900;color:#92400E;">Mijozlar razvedkasi</span><span class="badge" style="background:#B45309;color:#fff;margin-left:auto;">Z-BIZNES</span></div>
    <p style="font-size:9px;color:#92400E;margin:4px 0 10px;">7 segment + xarid niyati belgilari</p>
    <div style="display:flex;gap:6px;overflow:hidden;">
      <div class="chip chip-active" style="padding:6px 10px;font-size:9px;">Barchasi (142)</div>
      <div class="chip" style="padding:6px 10px;font-size:9px;background:#fff;">VIP (12)</div>
      <div class="chip" style="padding:6px 10px;font-size:9px;background:#fff;">Uxlab yotgan (24)</div>
    </div>
  </div>
  <div class="input" style="gap:8px;color:#94A3B8;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>Ism yoki telefon...</div>
  <div style="display:flex;gap:8px;overflow:hidden;"><div class="chip chip-active">Barchasi</div><div class="chip">VIP</div><div class="chip">Uxlab yotgan</div><div class="chip">Doimiy</div><div class="chip">Yangi</div></div>
  ${[["Malika Yusupova", "VIP", "#B45309", "#FFFBEB", "8 buyurtma · 2 kun oldin", "1 240 000"], ["Aziz Karimov", "Doimiy", "#059669", "#ECFDF5", "5 buyurtma · 6 kun oldin", "680 000"]].map(([n, seg, c, bg, sub, ltv]) => `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div class="avatar" style="width:36px;height:36px;">${n[0]}</div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:6px;"><p style="font-size:12px;font-weight:800;margin:0;">${n}</p><span class="badge" style="background:${bg};color:${c};">${seg}</span></div>
      <p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">${sub}</p>
    </div>
    <span style="font-size:11px;font-weight:900;color:#059669;">${ltv}</span>
  </div>`).join("")}
  <div class="card">
    <p class="lbl" style="margin-bottom:10px;">Ommaviy xabar (Broadcast)</p>
    <div style="display:flex;gap:6px;margin-bottom:10px;"><div class="chip chip-active" style="flex:1;justify-content:center;">Barchasi</div><div class="chip" style="flex:1;justify-content:center;">VIP</div><div class="chip" style="flex:1;justify-content:center;">Uxlab yotgan</div></div>
    <div class="input" style="color:#94A3B8;margin-bottom:8px;">Sarlavha</div>
    <div class="textarea" style="min-height:60px;margin-bottom:10px;">Xabar matni...</div>
    <button class="btn-primary"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Yuborish</button>
  </div>
  `,
});

// ---------- DeliverySettings ----------
pages.push({
  file: "DeliverySettings.dc.html",
  activeNav: 4,
  headerHtml: header("Yetkazib berish", "Narxlar va Yandex Delivery"),
  body: `
  <div style="display:flex;gap:8px;"><div class="chip chip-active" style="flex:1;justify-content:center;">Narxlar</div><div class="chip" style="flex:1;justify-content:center;">Yandex Delivery <span style="width:6px;height:6px;border-radius:50%;background:#059669;display:inline-block;margin-left:4px;"></span></div></div>
  <div class="card" style="display:flex;align-items:center;gap:8px;background:#EEF2FF;border-color:#E0E7FF;">
    <svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
    <p style="font-size:10px;color:#4338CA;margin:0;">Mintaqangiz: <b>Toshkent shahri</b></p>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="1" y="6" width="14" height="11"/><path d="M15 9h4l3 4v4h-7z"/></svg><p class="lbl" style="margin:0;">Mintaqaviy tariflar</p></div>
    ${[["Shahar ichida", "15 000"], ["Viloyat tumanlari", "25 000"], ["Boshqa viloyatlar", "40 000"]].map(([l, v]) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="flex:1;font-size:11px;color:#334155;">${l}</span><div class="input" style="width:90px;font-size:11px;">${v}</div><div class="input" style="width:100px;font-size:10px;color:#94A3B8;">1-2 kun</div></div>`).join("")}
  </div>
  <div class="card" style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:8px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/></svg><span style="font-size:12px;font-weight:800;">Bepul yetkazish</span></div>
    <div class="switch switch-on"><div class="switch-dot" style="right:2px;"></div></div>
  </div>
  <div class="card"><p class="field-lbl">Minimal buyurtma summasi</p><div class="input">300 000 so'm</div></div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><p class="lbl" style="margin:0;">Ish vaqti</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><p class="field-lbl">Ochilish</p><div class="input">09:00</div></div>
      <div><p class="field-lbl">Yopilish</p><div class="input">21:00</div></div>
    </div>
  </div>
  <button class="btn-primary">Saqlash</button>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
