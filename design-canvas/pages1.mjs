import { fs, path, OUT, wrap, header } from "./gen.mjs";

const pages = [];

// ---------- Products (list) ----------
pages.push({
  file: "Products.dc.html",
  activeNav: 1,
  headerHtml: header("Mahsulotlar", "24 ta mahsulot", {
    right: `<div class="chip" style="background:#EEF2FF;border-color:#E0E7FF;color:#4F46E5;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>4.2 mln so'm<svg class="i" width="10" height="10" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>`,
  }),
  body: `
  <div class="input" style="gap:8px;color:#94A3B8;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>Mahsulot qidirish...</div>
  <div style="display:flex;gap:8px;overflow:hidden;">
    <div class="chip chip-active">Barchasi (24)</div>
    <div class="chip">Faol (20)</div>
    <div class="chip">Nofaol (4)</div>
    <div class="chip" style="color:#D97706;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M12 2L2 20h20z"/><path d="M12 9v5"/></svg>Kam qoldi (4)</div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#6366F1);border:none;color:#fff;display:flex;align-items:center;gap:10px;">
    <svg class="i" width="18" height="18" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg>
    <div style="flex:1;"><p style="font-size:12px;font-weight:800;margin:0;">3 ta AI qoralamasi tayyor</p><p style="font-size:10px;margin:2px 0 0;opacity:.85;">Ko'rib chiqish uchun bosing</p></div>
    <svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
  </div>
  ${["Bolalar kombinezoni · Ko'k, 74 sm", "Yozgi shim · Pushti, 80 sm", "Trikotaj futbolka · Sariq, 68 sm"].map((n, i) => `
  <div class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px;">
    <div style="display:flex;gap:10px;align-items:center;">
      <div style="width:16px;height:16px;border-radius:5px;border:1.5px solid #CBD5E1;flex-shrink:0;"></div>
      <div style="width:48px;height:48px;border-radius:12px;background:#F1F5F9;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:12px;font-weight:800;margin:0;">${n}</p>
      </div>
      <div class="switch ${i === 2 ? "switch-off" : "switch-on"}" style="transform:scale(0.85);"><div class="switch-dot" style="${i === 2 ? "left:2px;" : "right:2px;"}"></div></div>
      <svg class="i" width="16" height="16" viewBox="0 0 24 24" style="color:#94A3B8;"><circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/></svg>
    </div>
    <div class="divider"></div>
    <div style="display:flex;align-items:center;font-size:11px;font-weight:800;color:#334155;">
      <span style="flex:1;">${125000 + i * 20000} so'm</span>
      <span style="width:1px;height:14px;background:#F1F5F9;margin:0 10px;"></span>
      <span style="flex:1;color:${i === 1 ? "#E11D48" : "#334155"};">Ombor: ${i === 1 ? "3" : 22 - i * 4} ta</span>
      <span style="width:1px;height:14px;background:#F1F5F9;margin:0 10px;"></span>
      <span style="flex:1;display:flex;align-items:center;gap:4px;color:#EA580C;"><svg class="i" width="11" height="11" viewBox="0 0 24 24"><path d="M12 3c-2 4-6 5-6 9a6 6 0 0012 0c0-4-4-5-6-9z"/></svg>${18 - i * 5} sotildi</span>
    </div>
  </div>`).join("")}
  <button class="btn-primary" style="margin-top:4px;"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Yangi mahsulot qo'shish</button>
  `,
});

// ---------- ProductAnalytics ----------
pages.push({
  file: "ProductAnalytics.dc.html",
  activeNav: 1,
  headerHtml: header("Mahsulotlar tahlili", "SO'NGGI 30 KUN", { right: `<div class="icn-btn"><svg class="i" width="15" height="15" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></div>` }),
  body: `
  <div style="display:flex;gap:8px;">
    <div class="chip">Hafta</div><div class="chip chip-active">Oy</div><div class="chip">Chorak</div><div class="chip">Yil</div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border:none;color:#fff;">
    <div style="display:flex;align-items:center;gap:6px;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M5 4h14l-1 9a6 6 0 01-12 0z"/></svg><span class="lbl" style="color:#C7D2FE;">Eng ko'p sotilgan</span></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
      <div style="width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,.2);"></div>
      <div><p style="font-weight:800;font-size:13px;margin:0;">Bolalar kombinezoni</p><p style="font-size:10px;margin:2px 0 0;opacity:.8;">Kiyim-kechak</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Tushum</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">890 000 so'm</p></div>
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;"><p style="font-size:9px;opacity:.8;margin:0;">Sotildi</p><p style="font-size:13px;font-weight:900;margin:2px 0 0;">36 ta</p></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/></svg><p style="font-size:14px;font-weight:900;margin:4px 0 0;">24</p><p class="lbl" style="margin:0;">Mahsulot</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#059669;"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg><p style="font-size:14px;font-weight:900;margin:4px 0 0;">142</p><p class="lbl" style="margin:0;">Sotildi</p></div>
    <div class="card" style="padding:10px;text-align:center;"><svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#D97706;"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3 1.2-6.9-5-4.9 6.9-1z"/></svg><p style="font-size:13px;font-weight:900;margin:4px 0 0;">Kiyim</p><p class="lbl" style="margin:0;">Top toifa</p></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;"><p class="lbl" style="margin:0;">Top mahsulotlar</p><div class="chip chip-active" style="padding:5px 9px;font-size:9px;">Tushum</div></div>
    ${["Bolalar kombinezoni", "Yozgi shim", "Trikotaj futbolka"].map((n, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
      <span style="font-size:10px;font-weight:900;color:#94A3B8;width:14px;">#${i + 1}</span>
      <div style="width:30px;height:30px;border-radius:8px;background:#F1F5F9;flex-shrink:0;"></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:700;margin:0 0 4px;">${n}</p><div class="progress"><div class="progress-fill" style="width:${90 - i * 25}%;background:#4F46E5;"></div></div></div>
      <span style="font-size:10px;font-weight:800;">${890 - i * 300}k</span>
    </div>`).join("")}
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#D97706;"><path d="M12 2L2 20h20z"/><path d="M12 9v5"/></svg><p class="lbl" style="margin:0;color:#D97706;">Tez tugaydi</p></div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
      <div style="width:30px;height:30px;border-radius:8px;background:#F1F5F9;flex-shrink:0;"></div>
      <div style="flex:1;"><p style="font-size:11px;font-weight:700;margin:0;">Yozgi shim, Pushti</p><p style="font-size:9px;color:#94A3B8;margin:2px 0 0;">≈2 kunda tugaydi</p></div>
      <span style="font-size:11px;font-weight:900;color:#E11D48;">3 ta</span>
    </div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border-color:#E0E7FF;">
    <div style="display:flex;align-items:center;gap:6px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg><p class="lbl" style="margin:0;color:#4F46E5;">AI CEO xulosasi</p></div>
    <p style="font-size:11px;color:#4338CA;margin:8px 0 0;line-height:1.5;">Yozgi shim toifasida ombordagi zaxira tugab qolyapti — 2-3 kun ichida to'ldirishni tavsiya qilamiz, aks holda kunlik ~40 000 so'mlik sotuv yo'qotilishi mumkin.</p>
  </div>
  `,
});

// ---------- ProductDraftReview ----------
pages.push({
  file: "ProductDraftReview.dc.html",
  activeNav: 1,
  headerHtml: header("AI qoralamalar", "3 ta ko'rib chiqilmagan"),
  body: `
  <div class="card" style="padding:12px;">
    <div style="display:flex;gap:10px;margin-bottom:10px;">
      <div style="width:56px;height:56px;border-radius:10px;background:#F1F5F9;flex-shrink:0;"></div>
      <div style="width:56px;height:56px;border-radius:10px;background:#F1F5F9;flex-shrink:0;"></div>
      <div style="width:56px;height:56px;border-radius:10px;background:#F1F5F9;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#CBD5E1;"><svg class="i" width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-11 11"/></svg></div>
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;"><svg class="i" width="11" height="11" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg><span style="font-size:10px;font-weight:800;color:#4F46E5;">AI tomonidan tayyorlangan</span></div>
    <p class="field-lbl">Nomi</p>
    <div class="input" style="margin-bottom:10px;">Bolalar yozgi shlyapasi, sariq</div>
    <p class="field-lbl">Tavsif</p>
    <div class="textarea" style="min-height:50px;margin-bottom:10px;">Yengil paxta matodan tikilgan, quyoshdan himoya qiluvchi bolalar shlyapasi...</div>
    <p class="field-lbl">Toifa</p>
    <div class="input" style="margin-bottom:10px;">Kiyim-kechak</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      <div><p class="field-lbl">Tan narxi</p><div class="input">18 000</div></div>
      <div><p class="field-lbl">Sotish narxi</p><div class="input">32 000</div></div>
    </div>
    <p class="field-lbl">Qoldiq</p>
    <div class="input" style="margin-bottom:12px;">15</div>
    <div style="display:flex;gap:8px;">
      <button class="btn-outline" style="flex:1;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>Rad etish</button>
      <button class="btn-primary" style="flex:2;"><svg class="i" width="14" height="14" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Tasdiqlash</button>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#94A3B8;">yana 2 ta qoralama qolgan</p>
  `,
});

// ---------- AddProductPage ----------
pages.push({
  file: "AddProduct.dc.html",
  activeNav: 2,
  headerHtml: header("Yangi mahsulot", "Ma'lumotlarni to'ldiring"),
  body: `
  <div style="display:flex;gap:8px;">
    <div class="chip chip-active" style="flex:1;justify-content:center;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>Qo'lda</div>
    <div class="chip" style="flex:1;justify-content:center;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg>AI orqali</div>
  </div>
  <div class="card">
    <p class="lbl" style="margin-bottom:8px;">Rasmlar 1/4</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      <div style="aspect-ratio:1;border-radius:10px;background:#F1F5F9;position:relative;">
        <span style="position:absolute;top:3px;left:3px;background:#4F46E5;color:#fff;border-radius:5px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;"><svg class="i" width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3 1.2-6.9-5-4.9 6.9-1z"/></svg></span>
      </div>
      ${[1, 2, 3].map(() => `<div style="aspect-ratio:1;border-radius:10px;border:1.5px dashed #E2E8F0;display:flex;align-items:center;justify-content:center;color:#CBD5E1;"><svg class="i" width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>`).join("")}
    </div>
  </div>
  <div class="card">
    <p class="field-lbl">Mahsulot nomi</p>
    <div class="input" style="margin-bottom:10px;color:#94A3B8;">Masalan: Bolalar kombinezoni</div>
    <p class="field-lbl">Toifa</p>
    <div class="input" style="justify-content:space-between;">Kiyim-kechak<svg class="i" width="13" height="13" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><svg class="i" width="13" height="13" viewBox="0 0 24 24" style="color:#4F46E5;"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h5"/></svg><span style="font-size:11px;font-weight:800;color:#4F46E5;">Aqlli kalkulyator</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><p class="field-lbl">Tan narxi</p><div class="input">18 000</div></div>
      <div><p class="field-lbl">Sotish narxi</p><div class="input">32 000</div></div>
    </div>
    <div style="background:#ECFDF5;border-radius:10px;padding:10px;margin-top:10px;display:flex;justify-content:space-between;">
      <div><p style="font-size:9px;color:#059669;margin:0;">SOF FOYDA</p><p style="font-size:13px;font-weight:900;color:#059669;margin:2px 0 0;">14 000 so'm</p></div>
      <div style="text-align:right;"><p style="font-size:9px;color:#059669;margin:0;">MARJA</p><p style="font-size:13px;font-weight:900;color:#059669;margin:2px 0 0;">43.8%</p></div>
    </div>
    <p class="field-lbl" style="margin-top:10px;">Qoldiq (dona)</p>
    <div class="input">40</div>
  </div>
  <div class="card">
    <p class="field-lbl">Variantlar (rang, o'lcham)</p>
    <div class="input" style="justify-content:space-between;color:#94A3B8;">Variant qo'shish<svg class="i" width="14" height="14" viewBox="0 0 24 24" style="color:#4F46E5;"><path d="M12 5v14M5 12h14"/></svg></div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      <span class="chip" style="background:#F8FAFC;">Ko'k ✕</span><span class="chip" style="background:#F8FAFC;">74 sm ✕</span>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><p class="field-lbl" style="margin:0;">Tavsif</p><span style="font-size:10px;font-weight:800;color:#4F46E5;display:flex;align-items:center;gap:4px;"><svg class="i" width="12" height="12" viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/></svg>AI bilan to'ldirish</span></div>
    <div class="textarea" style="min-height:70px;">—</div>
  </div>
  <button class="btn-primary">Mahsulotni saqlash</button>
  `,
});

const outDir = OUT;
for (const p of pages) {
  fs.writeFileSync(path.join(outDir, p.file), wrap(p));
  console.log("wrote", p.file);
}
