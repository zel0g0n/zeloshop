import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

// ---------- BannerSettings ----------
pages.push({
  file: "BannerSettings.dc.html",
  activeNav: 4,
  headerHtml: header("Bosh sahifa bannerlari", "Katalog slayderi (1/3)"),
  body: `
  <div class="card" style="display:flex;gap:10px;align-items:center;">
    <div style="width:64px;height:64px;border-radius:10px;background:#F1F5F9;flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;"><p style="font-size:12px;font-weight:800;margin:0;">Yozgi kolleksiya -20%</p><p style="font-size:10px;color:#94A3B8;margin:2px 0 0;">Barcha yozgi kiyimlarga chegirma</p></div>
    <div class="icn-btn" style="background:#FFF1F2;color:#E11D48;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Yangi banner qo'shish</p>
    <div style="height:100px;border-radius:12px;border:1.5px dashed #E2E8F0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94A3B8;gap:6px;margin-bottom:10px;">
      <svg class="i" width="20" height="20" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span style="font-size:10px;font-weight:700;">Rasm qo'shish</span>
    </div>
    <p class="field-lbl">Sarlavha</p><div class="input" style="margin-bottom:8px;color:#94A3B8;">Masalan: Yangi kolleksiya</div>
    <p class="field-lbl">Qisqa tavsif (ixtiyoriy)</p><div class="input" style="margin-bottom:8px;color:#94A3B8;">Qisqa matn</div>
    <div class="input" style="justify-content:space-between;margin-bottom:10px;color:#94A3B8;"><span style="display:flex;align-items:center;gap:6px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M13.5 6.5l4 4L21 7l-4-4z"/><path d="M3 21l4.5-1L17 10l-4-4L3.5 16.5z"/></svg>Havola tanlash (ixtiyoriy)</span></div>
    <button class="btn-primary" style="width:100%;">Qo'shish</button>
  </div>
  <div class="card" style="background:#EEF2FF;border-color:#E0E7FF;text-align:center;">
    <p style="font-size:10px;color:#4338CA;margin:0;">Z-Start tarifida ko'pi bilan <b>3 ta</b> banner qo'shish mumkin.</p>
    <a href="#" style="font-size:10px;font-weight:800;display:block;margin-top:6px;">Z-Pro'da cheksiz banner →</a>
  </div>
  `,
});

// ---------- MarketingCoupons ----------
pages.push({
  file: "MarketingCoupons.dc.html",
  activeNav: 4,
  headerHtml: header("Marketing va promo-kodlar", "Aksiyalar va chegirmalar"),
  body: `
  ${[
    ["Do'stni taklif qilish", "Har bir yangi mijoz uchun chegirma", "10%"],
    ["Sodiqlik dasturi (Bonus)", "Har xariddan bonus foizi", "5%"],
    ["Tug'ilgan kun chegirmasi", "Mijoz tug'ilgan kunida", "15%"],
    ["Tashlab ketilgan savat eslatmasi", "Savatda qolgan mahsulot uchun", null],
    ["Sevimlilar eslatmasi", "Sevimlilarga qo'shilgan mahsulot uchun", null],
    ["Qayta xarid taklifi", "Oldingi xaridlar asosida", null],
  ].map(([t, d, v], i) => `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div class="icn-btn" style="background:#F8FAFC;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></div>
    <div style="flex:1;min-width:0;"><p style="font-size:12px;font-weight:800;margin:0;">${t}</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">${d}</p></div>
    ${v ? `<span style="font-size:11px;font-weight:800;color:#4F46E5;">${v}</span>` : ""}
    <div class="switch ${i < 3 ? "switch-on" : "switch-off"}" style="transform:scale(.8);"><div class="switch-dot" style="${i < 3 ? "right:2px;" : "left:2px;"}"></div></div>
  </div>`).join("")}
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M20.6 3.4A5.5 5.5 0 0012.8 4L12 5l-.8-1a5.5 5.5 0 00-7.8 7.8L12 20l8.6-8.2a5.5 5.5 0 000-7.8z"/></svg><p class="lbl" style="margin:0;">Yangi promo-kod</p></div>
    <div class="input" style="margin-bottom:8px;font-family:monospace;">SUMMER30</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"><div class="input">Foiz (%)</div><div class="input">30</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;"><div class="input" style="color:#94A3B8;">Amal qilish muddati</div><div class="input" style="color:#94A3B8;">Ishlatish limiti</div></div>
    <button class="btn-primary" style="width:100%;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Promo-kod yaratish</button>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:10px;">Faol promo-kodlar</p>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;"><span style="font-family:monospace;font-weight:900;font-size:12px;">SUMMER30</span><span class="badge" style="background:#EEF2FF;color:#4F46E5;">Referal</span><span style="flex:1;text-align:right;font-size:10px;color:#94A3B8;">12 marta ishlatilgan</span><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></div>
  </div>
  `,
});

// ---------- CreatePromotion ----------
pages.push({
  file: "CreatePromotion.dc.html",
  activeNav: 4,
  headerHtml: header("Aksiya yaratish", "Mahsulotga chegirma narxi"),
  body: `
  <div class="input" style="gap:8px;color:#94A3B8;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>Mahsulot qidirish...</div>
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div style="width:44px;height:44px;border-radius:10px;background:#F1F5F9;flex-shrink:0;"></div>
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">Bolalar kombinezoni</p><p style="font-size:11px;margin:2px 0 0;"><span style="text-decoration:line-through;color:#94A3B8;">79 000</span> <b style="color:#E11D48;">63 000 so'm</b></p></div>
    <span class="badge" style="background:#FFF1F2;color:#E11D48;">🔥 Aksiyada</span>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Tezkor foiz</p>
    <div style="display:flex;gap:8px;margin-bottom:10px;"><div class="chip" style="flex:1;justify-content:center;">-10%</div><div class="chip chip-active" style="flex:1;justify-content:center;">-20%</div><div class="chip" style="flex:1;justify-content:center;">-30%</div></div>
    <p class="field-lbl">Chegirma narxi</p>
    <div class="input" style="margin-bottom:10px;">63 000 so'm</div>
    <div style="background:#F8FAFC;border-radius:10px;padding:10px;font-size:11px;margin-bottom:10px;"><span style="text-decoration:line-through;color:#94A3B8;">79 000 so'm</span> → <b>63 000 so'm</b></div>
    <p class="field-lbl">Necha vaqt davom etadi?</p>
    <div style="display:flex;gap:8px;margin-bottom:12px;"><div class="chip">1 kun</div><div class="chip chip-active">3 kun</div><div class="chip">7 kun</div><div class="chip">Cheksiz</div></div>
    <div style="display:flex;gap:8px;"><button class="btn-outline" style="flex:1;">Bekor qilish</button><button class="btn-primary" style="flex:1;">Saqlash</button></div>
  </div>
  ${["Yozgi shim, Pushti — 45 000 so'm", "Trikotaj futbolka — 38 000 so'm"].map((n) => `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div style="width:44px;height:44px;border-radius:10px;background:#F1F5F9;flex-shrink:0;"></div>
    <p style="flex:1;font-size:12px;font-weight:700;margin:0;">${n}</p>
    <svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#CBD5E1;"><path d="M9 18l6-6-6-6"/></svg>
  </div>`).join("")}
  `,
});

// ---------- PrivacySecurity ----------
pages.push({
  file: "PrivacySecurity.dc.html",
  activeNav: 4,
  headerHtml: header("Maxfiylik va xavfsizlik", "PIN kod himoyasi"),
  body: `
  <div class="card" style="display:flex;align-items:center;gap:10px;">
    <div class="icn-btn" style="background:#EEF2FF;color:#4F46E5;"><svg class="i" width="16" height="16" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div>
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">PIN kod himoyasi</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">Panelni ochish uchun 4 xonali kod so'raladi</p></div>
    <div class="switch switch-on"><div class="switch-dot" style="right:2px;"></div></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg><span class="field-lbl" style="margin:0;">PIN kodni o'rnatish</span></div>
    <p class="field-lbl">Yangi PIN kod</p>
    <div style="display:flex;gap:8px;margin-bottom:14px;justify-content:center;">${[1, 2, 3, 4].map(() => `<div style="width:44px;height:52px;border-radius:10px;border:1.5px solid #E2E8F0;display:flex;align-items:center;justify-content:center;"><span style="width:8px;height:8px;border-radius:50%;background:#0F172A;"></span></div>`).join("")}</div>
    <p class="field-lbl">PIN kodni tasdiqlang</p>
    <div style="display:flex;gap:8px;margin-bottom:14px;justify-content:center;">${[1, 2, 3, 4].map(() => `<div style="width:44px;height:52px;border-radius:10px;border:1.5px solid #E2E8F0;"></div>`).join("")}</div>
    <button class="btn-primary" style="width:100%;">PIN kodni saqlash</button>
  </div>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
