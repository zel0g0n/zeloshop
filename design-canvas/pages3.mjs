import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

// ---------- Tariffs ----------
function planCard(name, price, color, bg, features, cta, badge) {
  return `<div class="card" style="border-color:${color}33;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:.02em;">${name}</span>
      ${badge ? `<span class="badge" style="background:${bg};color:${color};">${badge}</span>` : ""}
    </div>
    <p style="font-size:18px;font-weight:900;margin:8px 0 10px;">${price}</p>
    ${features.map((f) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:7px;"><div style="width:15px;height:15px;border-radius:50%;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;"><svg class="i" width="9" height="9" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div><span style="font-size:11px;color:#334155;line-height:1.4;">${f}</span></div>`).join("")}
    ${cta}
  </div>`;
}
pages.push({
  file: "Tariffs.dc.html",
  activeNav: 4,
  headerHtml: header("Tariflar", "Rejangizni tanlang"),
  body: `
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;display:flex;align-items:center;gap:8px;">
    <svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#B45309;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
    <p style="font-size:10px;color:#92400E;margin:0;">Siz hozir <b>Z-Pro</b>ni sinab ko'ryapsiz — 4 kun qoldi</p>
  </div>
  ${planCard("Z-Start", "Bepul", "#64748B", "#F1F5F9", ["Cheksiz mahsulot va buyurtma", "3 tagacha banner", "3 tagacha faol aksiya", "Asosiy AI mahsulot tavsifi"], `<button class="btn-outline" style="width:100%;margin-top:4px;">Joriy tarif</button>`, "Joriy")}
  ${planCard("Z-Pro", "199 000 so'm/oy", "#4F46E5", "#EEF2FF", ["Z-Start'dagi barcha imkoniyatlar", "2 tagacha xodim", "Cheksiz banner va aksiya", "3 tagacha promo-kod", "AI CEO — to'liq paket", "AI ijtimoiy tarmoq posti", "Narx tavsiyalari"], `<button class="btn-primary" style="width:100%;margin-top:4px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>7 kunlik bepul sinov</button>`, "Tavsiya etiladi")}
  ${planCard("Z-Biznes", "349 000 so'm/oy", "#B45309", "#FFFBEB", ["Z-Pro'dagi barcha imkoniyatlar", "5 tagacha xodim", "Cheksiz promo-kod", "Buyruq markazi (bitta ekranda barcha KPI)", "Avtomatlashtirish qoidalari", "Mijozlar razvedkasi (7 segment)", "AI CEO'da 5 qo'shimcha chuqur vosita"], `<button class="btn-outline" style="width:100%;margin-top:4px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Qiziqish bildirish</button>`, null)}
  <div class="card" style="background:#F8FAFC;">
    <p style="font-size:10px;color:#64748B;margin:0;line-height:1.5;"><b>Eslatma:</b> hozircha markazlashtirilgan to'lov tizimi yo'q — "Qiziqish bildirish" tugmasi orqali administrator siz bilan bog'lanadi.</p>
  </div>
  `,
});

// ---------- Connections ----------
pages.push({
  file: "Connections.dc.html",
  activeNav: 4,
  headerHtml: header("Ulanishlar", "Bot va kanal"),
  body: `
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Do'kon havolasi</p>
    <div class="input" style="font-family:monospace;font-size:10px;color:#64748B;">t.me/zeloshop_bot?start=8213</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn-outline" style="flex:1;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>Nusxalash</button>
      <button class="btn-primary" style="flex:1;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Ulashish</button>
    </div>
  </div>
  <div class="card" style="background:#ECFDF5;border-color:#A7F3D0;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:26px;height:26px;border-radius:8px;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div><span style="font-size:12px;font-weight:800;color:#065F46;">@zamira_kids_bot</span></div>
    <p style="font-size:10px;color:#047857;margin:0 0 10px;">Shaxsiy botingiz ulangan va faol</p>
    <button class="btn-danger" style="width:100%;">Uzish</button>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 2v4"/></svg><span style="font-size:12px;font-weight:800;">Telegram kanal</span></div>
    <p style="font-size:10px;color:#94A3B8;margin:0 0 10px;">Yangi mahsulotlarni avtomatik joylash uchun kanalni ulang</p>
    <div class="input" style="gap:6px;color:#94A3B8;">#<span>kanal_username</span></div>
    <button class="btn-outline" style="width:100%;margin-top:8px;">Ulash</button>
  </div>
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;">
    <p style="font-size:10px;color:#92400E;margin:0;line-height:1.5;">⚠ Shaxsiy botingiz mavjud bo'lganda ham, do'kon ZeloShop asosiy boti orqali ham ochilishi mumkin.</p>
  </div>
  `,
});

// ---------- Support ----------
pages.push({
  file: "Support.dc.html",
  activeNav: 4,
  headerHtml: header("Yordam", "Savol yoki muammo"),
  body: `
  <div class="card" style="display:flex;gap:10px;align-items:center;">
    <div class="icn-btn" style="width:40px;height:40px;background:#EEF2FF;color:#4F46E5;"><svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1v-6h3z"/><path d="M3 19a2 2 0 002 2h1v-6H3z"/></svg></div>
    <p style="font-size:11px;color:#64748B;margin:0;line-height:1.5;">Savolingiz yoki takliflaringizni yozing — administrator siz bilan tez orada bog'lanadi.</p>
  </div>
  <div class="card">
    <p class="field-lbl">Mavzu</p>
    <div class="input" style="justify-content:space-between;margin-bottom:10px;">Texnik muammo<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
    <p class="field-lbl">Xabar</p>
    <div class="textarea" style="min-height:110px;">Muammoni batafsil yozing...</div>
  </div>
  <button class="btn-primary"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Yuborish</button>
  `,
});

// ---------- PnL ----------
pages.push({
  file: "PnL.dc.html",
  activeNav: 4,
  headerHtml: header("Foyda-zarar (P&L)", "SO'NGGI 30 KUN", { right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div>` }),
  body: `
  <div style="display:flex;gap:8px;"><div class="chip">Bugun</div><div class="chip">Hafta</div><div class="chip chip-active">Oy</div></div>
  <div class="card" style="background:linear-gradient(135deg,#059669,#10B981);border:none;color:#fff;">
    <p class="lbl" style="color:#D1FAE5;margin:0;">Sof foyda</p>
    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><svg class="i" width="16" height="16" viewBox="0 0 24 24"><path d="M7 17L17 7M7 7h10v10"/></svg><p style="font-size:22px;font-weight:900;margin:0;">780 000 so'm</p></div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:10px;opacity:.9;">Chuqur tahlil<svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Marja</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">32%</p></div>
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">ROI</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">48%</p></div>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg><p class="lbl" style="margin:0;">Foyda oqimi</p></div>
    ${[["Tushum", "+2 450 000", "#0F172A"], ["Tannarx (COGS)", "-980 000", "#E11D48"], ["Operatsion xarajat", "-410 000", "#E11D48"], ["Marketing", "-180 000", "#E11D48"], ["Soliq (4%)", "-100 000", "#E11D48"]].map(([l, v, c]) => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F8FAFC;font-size:11px;"><span style="color:#64748B;">${l}</span><span style="font-weight:800;color:${c};">${v}</span></div>`).join("")}
    <div style="display:flex;justify-content:space-between;padding-top:10px;font-size:12px;"><span style="font-weight:900;">= Sof foyda</span><span style="font-weight:900;color:#059669;">780 000</span></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg><p class="lbl" style="margin:0;">Mijoz jalb qilish narxi (CAC)</p></div>
    <p style="font-size:18px;font-weight:900;margin:0;">24 000 so'm <span style="font-size:10px;font-weight:600;color:#94A3B8;">/ mijoz</span></p>
    <span class="badge" style="background:#EEF2FF;color:#4F46E5;margin-top:6px;">+7 yangi mijoz</span>
  </div>
  <div class="card">
    <p class="field-lbl">Xarajat qo'shish</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div class="input" style="color:#94A3B8;">Xarajat nomi</div>
      <div class="input" style="color:#94A3B8;">Summasi</div>
    </div>
    <button class="btn-outline" style="width:100%;">Qo'shish</button>
    <div class="divider" style="margin:12px 0;"></div>
    ${[["Instagram reklama", "Marketing", "150 000"], ["Ofis ijarasi", "OPEX", "260 000"]].map(([n, t, a]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
      <div><p style="font-size:11px;font-weight:700;margin:0;">${n}</p><span class="badge" style="background:${t === "Marketing" ? "#F5F3FF" : "#EFF6FF"};color:${t === "Marketing" ? "#7C3AED" : "#2563EB"};">${t}</span></div>
      <span style="font-size:11px;font-weight:800;color:#E11D48;">-${a}</span>
    </div>`).join("")}
  </div>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
