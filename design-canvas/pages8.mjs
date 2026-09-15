import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

function toggleRow(title, desc, on) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC;">
    <div style="flex:1;min-width:0;"><p style="font-size:11px;font-weight:800;margin:0;">${title}</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;line-height:1.4;">${desc}</p></div>
    <div class="switch ${on ? "switch-on" : "switch-off"}" style="transform:scale(.85);flex-shrink:0;"><div class="switch-dot" style="${on ? "right:2px;" : "left:2px;"}"></div></div>
  </div>`;
}

pages.push({
  file: "AiCeoInfo.dc.html",
  activeNav: 4,
  headerHtml: header("Kunlik hisobot", "AI CEO", {
    right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></div><div class="icn-btn" style="background:#EEF2FF;color:#4F46E5;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg></div>`,
  }),
  body: `
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#6366F1);border:none;color:#fff;display:flex;align-items:center;gap:10px;">
    <div class="icn-btn" style="background:rgba(255,255,255,.2);color:#fff;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 2v4"/></svg></div>
    <div style="flex:1;"><p style="font-size:11px;font-weight:800;margin:0;">Avtopilot: 4/7 avtomatlashtirish faol</p></div>
    <a href="#" style="font-size:10px;font-weight:800;color:#fff;">Sozlash →</a>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border:none;color:#fff;">
    <p class="lbl" style="color:#C7D2FE;margin:0;">Bugungi savdo</p>
    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><p style="font-size:20px;font-weight:900;margin:0;">1 250 000 so'm</p><span class="badge" style="background:rgba(255,255,255,.2);color:#fff;">↑ 12%</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Buyurtmalar</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">7 ta</p></div>
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Yetkazilgan</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">5 ta</p></div>
    </div>
  </div>
  <div class="card" style="background:#ECFDF5;border-color:#A7F3D0;display:flex;align-items:center;gap:8px;">
    <svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#059669;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
    <p style="font-size:10px;color:#047857;margin:0;">AI CEO bugun sizga <b>≈ 40 daqiqa</b> vaqtni tejadi</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div class="kpi"><div class="kpi-ic" style="background:#EEF2FF;color:#4F46E5;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg></div><p class="lbl" style="margin:0;">Qo'shilgan mahsulot</p><p style="font-size:15px;font-weight:900;margin:0;">3 ta</p></div>
    <div class="kpi"><div class="kpi-ic" style="background:#ECFDF5;color:#059669;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg></div><p class="lbl" style="margin:0;">Ulardan savdo</p><p style="font-size:15px;font-weight:900;margin:0;">180 000</p></div>
  </div>
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#B45309;"><path d="M4 4h16v12H7l-3 3z"/></svg><p class="lbl" style="margin:0;color:#B45309;">Mahsulot sifati</p></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="font-size:11px;color:#92400E;">4 ta mahsulotda tavsif yo'q</span><span style="font-size:10px;font-weight:800;color:#4F46E5;">Tuzatish</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="font-size:11px;color:#92400E;">2 ta mahsulotda rasm yo'q</span><span style="font-size:10px;font-weight:800;color:#4F46E5;">Tuzatish</span></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#D97706;"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg><p class="lbl" style="margin:0;">Bugungi reja</p></div>
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #F8FAFC;">
      <div class="icn-btn" style="width:26px;height:26px;background:#FFFBEB;color:#B45309;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3 1.2-6.9-5-4.9 6.9-1z"/></svg></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:800;margin:0;">VIP mijozga maxsus taklif</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 4px;">Malika 30 kundan beri xarid qilmadi</p></div>
      <span style="font-size:9px;font-weight:800;color:#4F46E5;">AI xabar tayyorlash</span>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-start;">
      <div class="icn-btn" style="width:26px;height:26px;background:#FFF1F2;color:#E11D48;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 01-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1121 11.5z"/></svg></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:800;margin:0;">Uxlab yotgan mijozni qaytarish</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 4px;">3 ta mijoz 45+ kun faolsiz</p></div>
      <span style="font-size:9px;font-weight:800;color:#4F46E5;">Xabar yuborish</span>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg><p class="lbl" style="margin:0;">Bugungi CRM faolligi</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:#F8FAFC;border-radius:10px;padding:8px;text-align:center;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;margin:0 auto;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg><p style="font-size:12px;font-weight:900;margin:4px 0 0;">4</p><p class="lbl" style="margin:0;">Savat eslatma</p></div>
      <div style="background:#F8FAFC;border-radius:10px;padding:8px;text-align:center;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#E11D48;margin:0 auto;"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8L12 21l8.6-8.6a5.5 5.5 0 000-7.8z"/></svg><p style="font-size:12px;font-weight:900;margin:4px 0 0;">2</p><p class="lbl" style="margin:0;">Sevimli eslatma</p></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#94A3B8;margin-top:10px;"><span>Faol mijozlar: <b style="color:#0F172A;">98</b></span><span>Nofaol: <b style="color:#0F172A;">44</b></span></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg><p class="lbl" style="margin:0;">AI CEO samaradorligi</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:#F8FAFC;border-radius:10px;padding:8px;"><p class="lbl" style="margin:0;">Qaytarish konversiyasi</p><p style="font-size:14px;font-weight:900;margin:2px 0 0;color:#059669;">22%</p><p style="font-size:9px;color:#94A3B8;margin:0;">18 ta yuborilgan</p></div>
      <div style="background:#F8FAFC;border-radius:10px;padding:8px;"><p class="lbl" style="margin:0;">Sevimli konversiyasi</p><p style="font-size:14px;font-weight:900;margin:2px 0 0;color:#059669;">31%</p><p style="font-size:9px;color:#94A3B8;margin:0;">9 ta yuborilgan</p></div>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M21 11.5a8.5 8.5 0 01-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1121 11.5z"/></svg><p class="lbl" style="margin:0;">AI CEO'dan so'rang</p></div>
    <p style="font-size:10px;color:#94A3B8;margin:0 0 10px;">Do'koningiz haqida istalgan savolni bering</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;background:#F5F3FF;border-radius:10px;padding:9px 11px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#7C3AED;"><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg><span style="font-size:10px;font-weight:700;color:#5B21B6;">Nega o'tgan oy savdo tushdi?</span></div>
      <div style="display:flex;align-items:center;gap:6px;background:#F5F3FF;border-radius:10px;padding:9px 11px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#7C3AED;"><path d="M3 11v2a2 2 0 002 2h1l3 5V6l-3 5H5a2 2 0 00-2 2z"/></svg><span style="font-size:10px;font-weight:700;color:#5B21B6;">Reklama kampaniyasi tuzib ber</span></div>
      <div style="display:flex;align-items:center;gap:6px;background:#F5F3FF;border-radius:10px;padding:9px 11px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#7C3AED;"><path d="M12 3c-2 4-6 5-6 9a6 6 0 0012 0c0-4-4-5-6-9z"/></svg><span style="font-size:10px;font-weight:700;color:#5B21B6;">Bugun eng ko'p sotiladigan qaysi?</span></div>
    </div>
    <div class="textarea" style="min-height:44px;color:#94A3B8;margin-bottom:8px;">Savolingizni yozing...</div>
    <button class="btn-primary" style="width:100%;">So'rash</button>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#6366F1);border:none;color:#fff;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="icn-btn" style="background:rgba(255,255,255,.2);color:#fff;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 2v4"/></svg></div>
      <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">AI CEO'ni to'liq yoqish</p></div>
      <div class="switch" style="background:rgba(255,255,255,.3);"><div class="switch-dot" style="right:2px;"></div></div>
    </div>
    <div class="divider" style="background:rgba(255,255,255,.2);margin:10px 0;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:11px;">Mahsulotni qayta ishlash vaqti</span><span style="font-size:11px;font-weight:800;">18:00 ▾</span></div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:2px;">Kengaytirilgan sozlamalar ▾</p>
    ${toggleRow("AI CEO kunlik xulosalari", "Har kuni hisobot yuborish", true)}
    ${toggleRow("Avtomatik qaytarish xabarlari", "Uxlab yotgan mijozlarga", true)}
    ${toggleRow("Avtomatik sevimli eslatmalar", "Savatga qo'shilgan mahsulot uchun", true)}
    ${toggleRow("Avtomatik qaytarish chegirmasi", "5-15% oralig'ida", false)}
    ${toggleRow("Bir bosishli Telegram tasdiqlash", "Kampaniyalarni botdan tasdiqlash", true)}
    ${toggleRow("Avtomatik Story rasm", "Yangi mahsulot uchun", false)}
    ${toggleRow("Kam qoldiq ogohlantirishi", "Ombor tugaganda xabar berish", true)}
  </div>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
