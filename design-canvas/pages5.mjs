import { fs, path, OUT, wrap, header } from "./gen.mjs";
const pages = [];

function memberCard(name, sub, role, roleColor, perms) {
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="avatar" style="width:36px;height:36px;">${name[0]}</div>
      <div style="flex:1;min-width:0;"><p style="font-size:12px;font-weight:800;margin:0;">${name}</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">${sub}</p></div>
      <div class="switch switch-on" style="transform:scale(.8);"><div class="switch-dot" style="right:2px;"></div></div>
      <svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
    </div>
    <div class="divider" style="margin:10px 0;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span class="badge" style="background:${roleColor}1a;color:${roleColor};">${role} ▾</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${perms.map((p) => `<span class="badge" style="background:#F8FAFC;color:#64748B;">${p}</span>`).join("")}</div>
    </div>
  </div>`;
}

// ---------- CourierManagement ----------
pages.push({
  file: "CourierManagement.dc.html",
  activeNav: 4,
  headerHtml: header("Kuryerlar", "O'z yetkazib beruvchilaringiz"),
  body: `
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><div class="icn-btn" style="background:#F0FDFA;color:#0D9488;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-9h3l3 4h4"/></svg></div><p style="font-size:11px;color:#64748B;margin:0;line-height:1.5;">Kuryer nomini kiriting — u uchun taklif havolasi yaratiladi</p></div>
    <p class="field-lbl">Kuryer ismi</p>
    <div class="input" style="margin-bottom:8px;color:#94A3B8;">Masalan: Javlon</div>
    <p class="field-lbl">Telefon (ixtiyoriy)</p>
    <div class="input" style="margin-bottom:10px;color:#94A3B8;">+998</div>
    <button class="btn-primary" style="background:#0D9488;"><svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Taklif havolasi yaratish</button>
  </div>
  <p class="lbl">Ulangan kuryerlar (2)</p>
  <div class="card">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="avatar" style="width:36px;height:36px;background:#F0FDFA;color:#0D9488;">J</div>
      <div style="flex:1;min-width:0;"><p style="font-size:12px;font-weight:800;margin:0;">Javlon Toshev</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">+998 90 111 22 33 · Faol</p></div>
      <div class="switch switch-on" style="transform:scale(.8);"><div class="switch-dot" style="right:2px;"></div></div>
      <svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
    </div>
    <div class="divider" style="margin:10px 0;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;">
      <div><p style="font-size:13px;font-weight:900;margin:0;">42</p><p class="lbl" style="margin:0;">Yetkazgan</p></div>
      <div><p style="font-size:13px;font-weight:900;margin:0;">3</p><p class="lbl" style="margin:0;">Yo'lda</p></div>
      <div><p style="font-size:13px;font-weight:900;margin:0;">1</p><p class="lbl" style="margin:0;">Muvaffaqiyatsiz</p></div>
    </div>
  </div>
  `,
});

// ---------- StaffManagement ----------
pages.push({
  file: "StaffManagement.dc.html",
  activeNav: 4,
  headerHtml: header("Xodimlar", "0/0 — Z-Start tarifida mavjud emas"),
  body: `
  <div class="card" style="background:#FFFBEB;border-color:#FDE68A;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#B45309;"><path d="M2 8l4 4 6-8 6 8 4-4-2 11H4z"/></svg><span style="font-size:12px;font-weight:800;color:#92400E;">Xodim qo'shish uchun tarifni yangilang</span></div>
    <p style="font-size:10px;color:#92400E;margin:0 0 10px;line-height:1.5;">Z-Start tarifida xodim qo'shib bo'lmaydi. Z-Pro — 2 tagacha, Z-Biznes — 5 tagacha xodim.</p>
    <button class="btn-outline" style="width:100%;border-color:#FDE68A;color:#92400E;">Tariflarni ko'rish →</button>
  </div>
  <p class="lbl" style="opacity:.4;">Namuna: Z-Biznes tarifidagi ko'rinish</p>
  <div style="opacity:.45;pointer-events:none;">
  <div class="card">
    <p class="field-lbl">Xodim ismi</p><div class="input" style="margin-bottom:8px;color:#94A3B8;">Ism kiriting</div>
    <p class="field-lbl">Rol (ixtiyoriy)</p><div class="input" style="justify-content:space-between;margin-bottom:10px;">Menejer<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
    <p class="field-lbl" style="margin-bottom:8px;">Ruxsatlar</p>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${["Mahsulotlar", "Buyurtmalar", "Kuryerlar", "Mijozlar (CRM)"].map((p) => `<div style="display:flex;align-items:center;gap:8px;"><div style="width:15px;height:15px;border-radius:4px;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;"><svg class="i" width="9" height="9" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div><span style="font-size:11px;color:#334155;">${p}</span></div>`).join("")}
    </div>
    <button class="btn-primary" style="width:100%;margin-top:12px;">Taklif havolasi yaratish</button>
  </div>
  ${memberCard("Aziz Rahimov", "+998 91 222 33 44 · Faol", "Menejer", "#4F46E5", ["Mahsulot", "Buyurtma", "CRM"])}
  </div>
  `,
});

// ---------- StoreSettings ----------
pages.push({
  file: "StoreSettings.dc.html",
  activeNav: 4,
  headerHtml: header("Do'kon sozlamalari", "Logo, nom va bio"),
  body: `
  <div class="card" style="align-items:center;text-align:center;">
    <div style="width:76px;height:76px;border-radius:20px;background:#EEF2FF;margin:0 auto 8px;position:relative;">
      <div style="position:absolute;bottom:-4px;right:-4px;width:24px;height:24px;border-radius:50%;background:#4F46E5;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff;"><svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></div>
    </div>
    <p style="font-size:10px;color:#94A3B8;margin:0;">Logotipni bosib o'zgartiring</p>
  </div>
  <div class="card">
    <p class="field-lbl">Do'kon nomi</p><div class="input" style="margin-bottom:10px;">Zamira Kids Store</div>
    <p class="field-lbl">Telefon raqami</p><div class="input" style="margin-bottom:10px;">+998 90 123 45 67</div>
    <p class="field-lbl">Hudud</p><div class="input" style="justify-content:space-between;">Toshkent shahri<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg><span class="field-lbl" style="margin:0;">Do'kon manzili (Yandex uchun)</span></div>
    <div class="input" style="color:#94A3B8;">Xaritada tanlash →</div>
  </div>
  <div class="card">
    <p class="field-lbl">Soha</p><div class="input" style="justify-content:space-between;margin-bottom:10px;">Bolalar kiyimi<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
    <p class="field-lbl">Do'kon haqida</p><div class="textarea" style="min-height:70px;">Qisqacha tavsif...</div>
  </div>
  <div class="card" style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:8px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><circle cx="12" cy="12" r="9"/><path d="M12 2a15 15 0 010 20"/></svg><div><p style="font-size:12px;font-weight:800;margin:0;">Umumiy katalogda ko'rsatish</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">"Do'konlarni kashf etish" sahifasida</p></div></div>
    <div class="switch switch-on"><div class="switch-dot" style="right:2px;"></div></div>
  </div>
  <button class="btn-primary">Saqlash</button>
  `,
});

// ---------- CategoryManagement ----------
pages.push({
  file: "CategoryManagement.dc.html",
  activeNav: 4,
  headerHtml: header("Toifalarni boshqarish", "Nomlash, yashirish, tartiblash"),
  body: `
  <div class="card" style="padding:6px 14px;">
    ${["Kombinezonlar", "Ko'ylaklar", "Shim va shortiklar", "Poyabzal"].map((c, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 0;${i < 3 ? "border-bottom:1px solid #F8FAFC;" : ""}${i === 3 ? "opacity:.4;" : ""}">
      <div style="display:flex;flex-direction:column;gap:1px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#94A3B8;"><path d="M18 15l-6-6-6 6"/></svg><svg class="i" width="12" height="12" viewBox="0 0 24 24" style="color:#94A3B8;"><path d="M6 9l6 6 6-6"/></svg></div>
      <span style="flex:1;font-size:12px;font-weight:700;">${c}</span>
      ${i === 3 ? `<span class="badge" style="background:#F8FAFC;color:#94A3B8;">Men qo'shdim</span>` : ""}
      <svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#94A3B8;">${i === 3 ? '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0122 12s-1.3 2.4-3.6 4.3"/><path d="M6.6 6.6C4.3 8.2 2 12 2 12s3.5 7 10 7"/>' : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'}</svg>
      ${i === 3 ? `<svg class="i" width="15" height="15" viewBox="0 0 24 24" style="color:#E11D48;"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>` : ""}
    </div>`).join("")}
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M20.6 3.4A5.5 5.5 0 0012.8 4L12 5l-.8-1a5.5 5.5 0 00-7.8 7.8L12 20l8.6-8.2a5.5 5.5 0 000-7.8z"/></svg><span class="field-lbl" style="margin:0;">Yangi toifa qo'shish</span></div>
    <div style="display:flex;gap:8px;"><div class="input" style="flex:1;color:#94A3B8;">Masalan: Lyuks parvarish</div><div class="icn-btn" style="background:#4F46E5;color:#fff;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div></div>
  </div>
  <button class="btn-primary">Saqlash</button>
  <p style="text-align:center;font-size:11px;color:#E11D48;font-weight:700;">Standart holatga qaytarish</p>
  `,
});

for (const p of pages) fs.writeFileSync(path.join(OUT, p.file), wrap(p));
console.log("done", pages.length);
