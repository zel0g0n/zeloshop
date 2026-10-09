# -*- coding: utf-8 -*-
"""
ZeloShop — "Tuzatilishi kerak bo'lgan narsalar" va "Kelajakdagi rejalar"
ro'yxatini PDF sifatida tayyorlaydi. Manba: 2026-09-11 audit natijalari +
loyiha xotirasidagi (memory) to'liq roadmap.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, ListFlowable, ListItem,
)
from reportlab.pdfbase.pdfmetrics import stringWidth

ACCENT = colors.HexColor("#5346E0")
ACCENT_DARK = colors.HexColor("#3730A3")
SLATE_900 = colors.HexColor("#0F172A")
SLATE_600 = colors.HexColor("#475569")
SLATE_400 = colors.HexColor("#94A3B8")
TAG_MUTED = colors.HexColor("#64748B")
AMBER = colors.HexColor("#B45309")
ROSE = colors.HexColor("#BE123C")
EMERALD = colors.HexColor("#047857")
LIGHT_BG = colors.HexColor("#F4F5F9")

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "TitleZS", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=22, leading=26, textColor=SLATE_900, spaceAfter=4,
)
subtitle_style = ParagraphStyle(
    "SubtitleZS", parent=styles["Normal"], fontName="Helvetica",
    fontSize=11, leading=15, textColor=SLATE_600, spaceAfter=2,
)
meta_style = ParagraphStyle(
    "MetaZS", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9, leading=12, textColor=SLATE_400,
)
section_title_style = ParagraphStyle(
    "SectionTitleZS", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=15, leading=19, textColor=colors.white, spaceAfter=0, spaceBefore=0,
)
section_desc_style = ParagraphStyle(
    "SectionDescZS", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13, textColor=SLATE_600, spaceBefore=6, spaceAfter=10,
)
group_title_style = ParagraphStyle(
    "GroupTitleZS", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=11.5, leading=14, textColor=ACCENT_DARK, spaceBefore=14, spaceAfter=6,
)
item_title_style = ParagraphStyle(
    "ItemTitleZS", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, leading=13, textColor=SLATE_900,
)
item_body_style = ParagraphStyle(
    "ItemBodyZS", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.3, leading=13, textColor=SLATE_600, spaceAfter=9,
)
footer_style = ParagraphStyle(
    "FooterZS", parent=styles["Normal"], fontName="Helvetica",
    fontSize=7.5, leading=10, textColor=SLATE_400,
)


def section_header(num, title_text, desc_text):
    bar = Table(
        [[Paragraph(f"{num}. {title_text}", section_title_style)]],
        colWidths=[170 * mm],
    )
    bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return [bar, Paragraph(desc_text, section_desc_style)]


def item(title_text, body_text, tag=None, tag_color=None):
    tag_html = f'<font color="{tag_color.hexval() if tag_color else "#94A3B8"}">[{tag}]</font>  ' if tag else ""
    return Paragraph(f"{tag_html}<b>{title_text}</b> — {body_text}", item_body_style)


story = []

# ---------- TITLE ----------
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("ZeloShop", ParagraphStyle(
    "Brand", fontName="Helvetica-Bold", fontSize=13, textColor=ACCENT, spaceAfter=2)))
story.append(Paragraph("Kelajakdagi rejalar va tuzatilishi kerak bo'lgan funksiyalar", title_style))
story.append(Paragraph("Hozirgi holat audit natijalari + to'liq roadmap — bir joyda", subtitle_style))
story.append(Paragraph("Tayyorlangan sana: 2026-09-11 &nbsp;&middot;&nbsp; Loyiha: commerce-zelo", meta_style))
story.append(Spacer(1, 4 * mm))
story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#E2E8F0")))
story.append(Spacer(1, 6 * mm))

intro = Paragraph(
    "Ushbu hujjat ikki qismdan iborat: <b>(1) hozir ishlayotgan, lekin "
    "yaxshilanishi/tuzatilishi kerak bo'lgan joylar</b> va <b>(2) kelajakda "
    "qo'shilishi rejalashtirilgan yangi funksiyalar</b>. Ro'yxat 2026-09-11 "
    "kunidagi to'liq audit va loyiha tarixiga asoslangan — bu yerda faqat "
    "haqiqatan tekshirilgan, kodda tasdiqlangan holatlar bor, taxmin yo'q.",
    section_desc_style,
)
story.append(intro)
story.append(Spacer(1, 4 * mm))

# ============================================================
# SECTION 1 — TUZATILISHI / YAXSHILANISHI KERAK BO'LGAN NARSALAR
# ============================================================
story += section_header(
    1, "Tuzatilishi / yaxshilanishi kerak bo'lgan narsalar",
    "Bular — loyihada HOZIR mavjud, ishlayotgan narsalar, lekin xavfsizlik, "
    "barqarorlik yoki sifat nuqtai nazaridan yaxshilashni talab qiladi.",
)

story.append(Paragraph("A. Xavfsizlik — birinchi navbatda ko'rib chiqilishi kerak", group_title_style))
story.append(item(
    "CSP (Content-Security-Policy) hali “Report-Only” rejimida",
    "hozircha hujumlarni faqat KUZATADI, BLOKLAMAYDI. Haqiqiy himoyaga o'tkazish kerak.",
    "YUQORI", ROSE,
))
story.append(item(
    "Firebase App Check ulanmagan",
    "bot/skript orqali backend'ga to'g'ridan-to'g'ri (Mini App'ni ochmasdan) so'rov "
    "yuborish ehtimoli bor — real trafik ko'payganda xavf ham oshadi.",
    "YUQORI", ROSE,
))
story.append(item(
    "Foydalanish shartlari (Terms of Service) umuman yozilmagan",
    "pul aylanadigan platforma uchun zarur hujjat, hali mavjud emas.",
    "YUQORI", ROSE,
))
story.append(item(
    "Maxfiylik siyosati yurist tomonidan ko'rib chiqilmagan",
    "hujjatning o'zi bor (O'zbekiston qonunchiligiga ishora qiladi), lekin professional yurist tasdig'idan o'tmagan.",
    "O'RTA", AMBER,
))
story.append(item(
    "“npm audit” ogohlantirishlari tuzatilmagan",
    "backend'da 29 ta (1 tasi “yuqori” darajali — uchinchi tomon kutubxonasining ichki bog'liqligida), "
    "frontend'da 2 ta. Asosan real xavfi past, lekin ochiq qolgan.",
    "O'RTA", AMBER,
))

story.append(Paragraph("B. Infratuzilma va barqarorlik", group_title_style))
story.append(item(
    "CI/CD va Staging muhiti hali FAOLLASHTIRILMAGAN",
    "kerakli fayllar (GitHub Actions) tayyorlanib berildi, lekin loyiha hali GitHub'ga "
    "ulanmagan, alohida staging Firebase loyihasi yaratilmagan — shuning uchun deploy "
    "hamon 100% qo'lda, avtomatik tekshiruvsiz.",
    "YUQORI", ROSE,
))
story.append(item(
    "Cloud Functions'da “minInstances” sozlanmagan",
    "funksiya uzoq vaqt chaqirilmasa, keyingi so'rov “sovuq boshlanish” "
    "tufayli sekinroq javob berishi mumkin.",
    "O'RTA", AMBER,
))
story.append(item(
    "Testlar hali faqat “mock” (taqlid) ma'lumotlar bilan",
    "haqiqiy Firestore emulyatori yoki yuklama (load) testlari yo'q.",
    "O'RTA", AMBER,
))
story.append(item(
    "Tashqi, mustaqil kod ko'rigi (code review) bo'lmagan",
    "hozirgacha faqat ichki (AI yordamida) tekshiruvlar o'tkazilgan.",
    "PAST", TAG_MUTED,
))
story.append(item(
    "Ishlatilmayotgan (“o'lik”) fayllar hali tozalanmagan",
    "loyiha davomida qolib ketgan, endi kerak bo'lmagan kod bo'laklari bor.",
    "PAST", TAG_MUTED,
))

story.append(Paragraph("C. Jonli (real) trafikda hali sinalmagan funksiyalar", group_title_style))
story.append(item(
    "Bir nechta AI funksiya jonli Gemini kaliti bilan hech qachon sinalmagan",
    "reklama rasmi generatsiyasi, AI Mahsulot Yordamchisi, AI Business Operating System "
    "kengaytmasi — kod yozilgan va testlardan o'tgan, lekin haqiqiy AI javobi bilan tekshirilmagan.",
    "O'RTA", AMBER,
))
story.append(item(
    "Xodim boti hali jonli sinalmagan",
    "bot toke ni hali yaratilmagan, shuning uchun to'liq oqim (taklif → ulanish → ishlash) real Telegram'da tekshirilmagan.",
    "O'RTA", AMBER,
))
story.append(item(
    "Kuryerning “jonli joylashuv” (real-time location) funksiyasi",
    "asosiy oqim tasdiqlangan, lekin Telegramning davriy joylashuv yangilanishlari real trafikda sinalmagan.",
    "PAST", TAG_MUTED,
))

story.append(Paragraph("D. To'lov bilan bog'liq", group_title_style))
story.append(item(
    "Mijozdan sotuvchiga to'lov — hali faqat naqd yoki qo'lda o'tkazma",
    "real vaqtli, avtomatik tasdiqlanadigan onlayn to'lov integratsiyasi yo'q "
    "(bu segment uchun odatiy holat, lekin kelajakda yaxshilash mumkin).",
    "PAST", TAG_MUTED,
))
story.append(item(
    "“Bo'lib to'lash” (installment) — interfeysda izi bor, ishlamaydi",
    "sotuvchi paneli tomonidan ataylab o'chirib qo'yilgan (backend qo'llab-quvvatlamaydi), "
    "chalkash bo'lmasligi uchun to'liq olib tashlash yoki real qilib qurish kerak.",
    "PAST", TAG_MUTED,
))

story.append(PageBreak())

# ============================================================
# SECTION 2 — KELAJAKDA QO'SHILISHI REJALASHTIRILGAN FUNKSIYALAR
# ============================================================
story += section_header(
    2, "Kelajakda qo'shilishi rejalashtirilgan funksiyalar",
    "Bular — hali umuman qurilmagan, lekin roadmap'da rejalashtirilgan yangi imkoniyatlar.",
)

roadmap_items = [
    ("Mijoz → sotuvchi to'g'ridan-to'g'ri xabar almashish (chat)",
     "hozir mijoz sotuvchiga to'g'ridan-to'g'ri Telegram orqali yoza olmaydi — bu funksiya hali umuman qurilmagan."),
    ("Buyurtma “yetkazib berildi” / “bekor qilindi” bo'lganda mijozga avtomatik xabar",
     "hozir bu ikki holatda mijozga Telegram orqali xabar ketmaydi."),
    ("Administratorga avtomatik bildirishnoma",
     "do'kon tasdiqlanganda, to'xtatilganda yoki obuna muddati tugaganda administratorga xabar hali yo'q."),
    ("Kanalga avtomatik post qilishni BARCHA sotuvchilarga ochish",
     "hozir faqat AI CEO tarifidagi sotuvchilar uchun mavjud — buni kengaytirish narxlash qarori."),
    ("Uzum Tezkor yetkazib berish integratsiyasi",
     "hozir faqat Yandex Delivery bilan integratsiya bor."),
    ("Bo'lib to'lash (split-payment) — real backend qo'llab-quvvatlovi",
     "hozirgi “installment” ko'rinishidan farqli, HAQIQIY, ishlaydigan variant sifatida qurish."),
    ("Z-Biznes 10-punktli rejasining qolgan qismlari",
     "to'liq Multi-Shop (bir nechta do'konni bitta hisobdan boshqarish), to'liq Ombor tizimi "
     "(hozir faqat harakat audit jurnali bor, ko'p-manzilli ombor/partiya kuzatuvi yo'q), "
     "Eksport/Buxgalteriya integratsiyasi, tashqi API/Webhooks, sotuvlarni bashorat qilish (forecasting)."),
    ("AI Business Operating System kengaytmasining qolgan qismlari",
     "hodisalar oqimi (event-bus), fon vazifalar navbati, to'liq kuzatuv (observability) paneli, "
     "boshqa AI provayderlarga o'tish imkoniyati (provider abstraction)."),
    ("Z-Bazar — alohida, mustaqil marketpleys loyihasi",
     "texnik spetsifikatsiya tayyor (“MARKETPLACE_SPEC.md”), lekin kod yozish hali "
     "boshlanmagan — alohida, aniq qaror kutilmoqda."),
    ("Xodimlarga mahsulotlarni o'chirish huquqini berish",
     "hozir bu ataylab yopilgan (xavfsizlik siyosati qarori) — kelajakda kerak bo'lsa qayta ko'rib chiqilishi mumkin."),
]

numbered = ListFlowable(
    [ListItem(Paragraph(f"<b>{t}</b> — {d}", item_body_style), leftIndent=6) for t, d in roadmap_items],
    bulletType="1", start="1", leftIndent=16, bulletFontName="Helvetica-Bold",
    bulletColor=ACCENT_DARK, bulletFontSize=9.5,
)
story.append(numbered)

story.append(Spacer(1, 6 * mm))
story.append(HRFlowable(width="100%", thickness=0.7, color=colors.HexColor("#E2E8F0")))
story.append(Spacer(1, 3 * mm))
story.append(Paragraph(
    "Belgilar: <font color='#BE123C'><b>[YUQORI]</b></font> — birinchi navbatda ko'rib chiqilishi tavsiya "
    "etiladi &nbsp;&middot;&nbsp; <font color='#B45309'><b>[O'RTA]</b></font> — muhim, lekin shoshilinch emas "
    "&nbsp;&middot;&nbsp; <font color='#94A3B8'><b>[PAST]</b></font> — bilib turish kifoya, hozircha xavfsiz.",
    footer_style,
))

doc = SimpleDocTemplate(
    "ZeloShop_Kelajak_Rejalar.pdf",
    pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=16 * mm, bottomMargin=16 * mm,
    title="ZeloShop — Kelajakdagi rejalar va tuzatilishi kerak bo'lgan funksiyalar",
    author="ZeloShop",
)


def add_page_number(canvas, doc_):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE_400)
    canvas.drawRightString(190 * mm, 10 * mm, f"{doc_.page}")
    canvas.drawString(20 * mm, 10 * mm, "ZeloShop — commerce-zelo")
    canvas.restoreState()


doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print("OK")
