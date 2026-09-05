import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, UserRoundCog, Plus, Check, Send, Trash2, Loader2, X, PhoneCall, ChevronDown,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTelegramWebApp } from "@/config/telegram";
import { getStaffList } from "@/services/staff/getStaffList";
import { createStaffInvite, setStaffPermissions, setStaffActive, removeStaff } from "@/services/staff/staffManagement";
import getOrderData from "@/services/orders/getOrderData";
import { computeStaffPerformance } from "@/utils/staffPerformanceStats";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatUzPhone, isValidUzPhone, hasMeaningfulPhoneDigits } from "@/utils/phone";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useExpenses } from "@/hooks/seller/useExpenses";
import { getTariffLimits } from "@/utils/tariffLimits";
import {
  PERMISSION_KEYS, STAFF_ROLE_KEYS, normalizeStaffPermissions,
  getRolePermissionPreset, matchRoleFromPermissions,
} from "@/utils/staffRoles";
import { PERMISSION_META, ROLE_META } from "@/features/staff/staffPermissionMeta";
import PersonPerformancePanel from "@/features/seller/components/shared/PersonPerformancePanel";

const EMPTY_PERMISSIONS = normalizeStaffPermissions(null);

/**
 * Sotuvchi — "Xodimlar" sahifasi.
 *
 * `CourierManagementPage.jsx`dagi bilan BIR XIL "taklif havolasi
 * yaratish" naqshi (sotuvchi ismni/telefonni kiritadi, tizim havola
 * yasaydi, sotuvchi buni o'zi xodimga yuboradi — xodim boti
 * Telegram ID'si hali noma'lum bo'lgani uchun O'ZI xabar
 * yubormaydi). Xodim soni — Z-Tariflarga qarab (`getTariffLimits`:
 * Start 0, Pro 2, Biznes 5). Har bir xodimga QAYSI amallarni ruxsat
 * berish TALAB QILINGAN — taklif yaratishda tanlanadi (ixtiyoriy
 * ravishda 8 ta tayyor ROL orqali OLDINDAN to'ldiriladi), keyinroq
 * ro'yxatdagi kartochkadan o'zgartirilishi mumkin (2026-09
 * punkt-royxati, 2-band "Advanced Team & RBAC"). ATAYLAB HECH QANDAY
 * "AI CEO" ruxsat maydoni YO'Q — xodim bu funksiyaga hech qachon
 * kira olmaydi (`firestore.rules`).
 */
const StaffManagementPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
  const maxStaff = getTariffLimits(store).maxStaff;

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getStaffList(
      sellerId,
      (data) => { setStaffList(data); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsubscribe?.();
  }, [sellerId]);

  // 2026-09 punkt-royxati, 11-band: har bir xodim uchun "necha
  // buyurtma qayta ishlangan" statistikasi — do'konning TO'LIQ
  // buyurtmalar ro'yxatidan (`lastActionByStaffId` maydoni bo'yicha,
  // `computeStaffPerformance`) hisoblanadi. Bu bo'lim FAQAT statistika
  // uchun - ro'yxatning o'zi (yuqorida) alohida, o'z manbasidan
  // o'qiladi.
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getOrderData(sellerId, setOrders, () => setOrders([]));
    return () => unsubscribe?.();
  }, [sellerId]);

  const staffPerformanceById = useMemo(() => {
    const map = new Map();
    staffList.forEach((member) => map.set(member.id, computeStaffPerformance(orders, member.id)));
    return map;
  }, [staffList, orders]);

  // 2026-09 punkt-royxati, 11-band: "batafsil statistika" paneli uchun
  // — bu HAQIQIY, P&L Dashboard bilan bir xil `sellers/{id}/expenses`
  // manbasidan (`useExpenses`), har bir xodim uchun `linkedStaffId`
  // bo'yicha mijoz tomonida filtrlanadi (ro'yxat kichik, alohida
  // Firestore so'rov/indeks shart emas).
  const { expenses: allExpenses, create: createExpenseRaw } = useExpenses(sellerId);
  const handleAddStaffExpense = useCallback(
    (staffId) => (data) => createExpenseRaw({ ...data, linkedStaffId: staffId }),
    [createExpenseRaw]
  );

  // --- Yangi xodim qo'shish ---
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState(null); // null = "Moslashtirilgan"
  const [newPermissions, setNewPermissions] = useState(EMPTY_PERMISSIONS);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newInviteLink, setNewInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const atLimit = maxStaff !== null && staffList.length >= maxStaff;

  // Rol tanlansa — o'sha rolning tayyor ruxsat to'plami OLDINDAN
  // to'ldiriladi (2026-09 punkt-royxati, 2-band). Sotuvchi buni
  // pastdagi ruxsat tugmalaridan yana o'zgartirishi mumkin — bu
  // o'zgarish hech qachon "rol bilan qayta sinxronlanib" yo'qolmaydi,
  // chunki rol faqat SHU TANLASH pallida ishlatiladi (ro'yxatga
  // yuborilgach, HAQIQIY manba — saqlangan `permissions` obyekti).
  const handleSelectRole = useCallback((role) => {
    setNewRole(role);
    setRoleMenuOpen(false);
    const preset = getRolePermissionPreset(role);
    if (preset) setNewPermissions(preset);
  }, []);

  // Ruxsatni qo'lda o'zgartirsa — rol belgisi endi ANIQ mos kelmasligi
  // mumkin, shuning uchun qayta hisoblanadi (mos preset topilsa o'sha
  // rol, aks holda "Moslashtirilgan" — `null`).
  const handleToggleNewPermission = useCallback((key) => {
    setNewPermissions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setNewRole(matchRoleFromPermissions(next));
      return next;
    });
  }, []);

  const handleCreateInvite = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError(t("staffManagement.errorNameRequired"));
      return;
    }
    const hasAnyPhoneDigits = hasMeaningfulPhoneDigits(phone);
    if (hasAnyPhoneDigits && !isValidUzPhone(phone)) {
      setCreateError(t("staffManagement.errorPhoneInvalid"));
      return;
    }
    if (!Object.values(newPermissions).some(Boolean)) {
      setCreateError(t("staffManagement.errorPermissionRequired"));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createStaffInvite(name.trim(), hasAnyPhoneDigits ? phone.trim() : "", newPermissions, newRole);
      setNewInviteLink(result.inviteLink);
      setName("");
      setPhone("");
      setNewRole(null);
      setNewPermissions(EMPTY_PERMISSIONS);
    } catch (err) {
      setCreateError(err.message || t("staffManagement.errorCreateGeneric"));
    } finally {
      setCreating(false);
    }
  }, [name, phone, newPermissions, newRole, t]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!newInviteLink) return;
    try {
      await navigator.clipboard.writeText(newInviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [newInviteLink]);

  const handleShareInviteLink = useCallback(async () => {
    if (!newInviteLink) return;
    const shareText = t("staffManagement.shareText");
    if (navigator.share) {
      try {
        await navigator.share({ title: t("staffManagement.shareTitle"), text: shareText, url: newInviteLink });
        return;
      } catch {
        return;
      }
    }
    const webApp = getTelegramWebApp();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(newInviteLink)}&text=${encodeURIComponent(shareText)}`;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [newInviteLink, t]);

  // --- Faollashtirish/o'chirish/ruxsatlar/rol ---
  const [togglingId, setTogglingId] = useState(null);
  const [permissionPendingKey, setPermissionPendingKey] = useState(null); // "{staffId}:{perm}"
  const [rolePendingId, setRolePendingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEscapeToClose(() => setNewInviteLink(null), Boolean(newInviteLink));

  const handleToggleActive = useCallback(async (member) => {
    setTogglingId(member.id);
    try {
      await setStaffActive(member.id, member.status !== "active");
    } catch {
      // Xato bo'lsa ham jim qolamiz - ro'yxat real-vaqtli.
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleTogglePermission = useCallback(async (member, permKey) => {
    const pendingKey = `${member.id}:${permKey}`;
    setPermissionPendingKey(pendingKey);
    try {
      const current = normalizeStaffPermissions(member.permissions);
      const nextPermissions = { ...current, [permKey]: !current[permKey] };
      // Ruxsat qo'lda o'zgartirilsa, mavjud rol belgisi endi ANIQ mos
      // kelmasligi mumkin — qayta hisoblanadi ("Moslashtirilgan"ga
      // tushishi mumkin, bu KUTILGAN va TO'G'RI xatti-harakat).
      await setStaffPermissions(member.id, nextPermissions, matchRoleFromPermissions(nextPermissions));
    } catch {
      // Xato bo'lsa ham jim qolamiz - ro'yxat real-vaqtli.
    } finally {
      setPermissionPendingKey(null);
    }
  }, []);

  // Ro'yxatdagi xodimning rolini o'zgartirish — tanlangan rolning
  // tayyor ruxsat to'plami DARHOL yoziladi (`setStaffPermissions`
  // orqali, `role` bilan birga).
  const handleSetMemberRole = useCallback(async (member, role) => {
    setRoleMenuOpenId(null);
    setRolePendingId(member.id);
    try {
      const preset = getRolePermissionPreset(role) || EMPTY_PERMISSIONS;
      await setStaffPermissions(member.id, preset, role);
    } catch {
      // Xato bo'lsa ham jim qolamiz - ro'yxat real-vaqtli.
    } finally {
      setRolePendingId(null);
    }
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeStaff(removeTarget.id);
      setRemoveTarget(null);
    } catch {
      // Xato bo'lsa modal ochiq qoladi - sotuvchi qayta urinishi mumkin.
    } finally {
      setRemoving(false);
    }
  }, [removeTarget]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("staffManagement.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("staffManagement.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* YANGI XODIM QO'SHISH */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <UserRoundCog size={20} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {atLimit ? t("staffManagement.limitReachedDesc", { max: maxStaff }) : t("staffManagement.addStaffDesc")}
            </p>
          </div>

          {!atLimit && (
            <form onSubmit={handleCreateInvite} className="space-y-2">
              <input
                type="text"
                disabled={creating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("staffManagement.namePlaceholder")}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={17}
                disabled={creating}
                value={phone}
                onFocus={() => { if (!phone) setPhone("+998 "); }}
                onChange={(e) => setPhone(formatUzPhone(e.target.value))}
                placeholder={t("staffManagement.phonePlaceholder")}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />

              {/* ROL TANLASH (2026-09 punkt-royxati, 2-band): ixtiyoriy —
                  tanlansa ruxsatlar pastda avtomatik belgilanadi. */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block pl-1">
                  {t("staffManagement.roleLabel")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => setRoleMenuOpen((v) => !v)}
                    className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold flex items-center justify-between disabled:opacity-60"
                  >
                    <span>{newRole ? t(`staffManagement.${ROLE_META[newRole].nameKey}`) : t("staffManagement.roleCustomOption")}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {roleMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-lg max-h-64 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectRole(null)}
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {t("staffManagement.roleCustomOption")}
                      </button>
                      {STAFF_ROLE_KEYS.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleSelectRole(role)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <p className="text-xs font-black text-slate-700 dark:text-white">{t(`staffManagement.${ROLE_META[role].nameKey}`)}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t(`staffManagement.${ROLE_META[role].descKey}`)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed pl-1">{t("staffManagement.roleHint")}</p>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block pl-1">
                  {t("staffManagement.permissionsLabel")}
                </label>
                {PERMISSION_KEYS.map((permKey) => {
                  const { Icon, titleKey, descKey } = PERMISSION_META[permKey];
                  const checked = newPermissions[permKey];
                  return (
                    <button
                      key={permKey}
                      type="button"
                      disabled={creating}
                      onClick={() => handleToggleNewPermission(permKey)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors disabled:opacity-60 ${
                        checked ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500" : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent"
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-indigo-400"}`}>
                        <Icon size={16} />
                      </span>
                      <div className="text-left flex-1">
                        <p className={`text-xs font-black ${checked ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}>{t(`staffManagement.${titleKey}`)}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t(`staffManagement.${descKey}`)}</p>
                      </div>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {createError && <p className="text-[11px] text-rose-500 font-semibold">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {creating ? t("staffManagement.creating") : t("staffManagement.createButton")}
              </button>
            </form>
          )}
        </div>

        {/* RO'YXAT */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
            {t("staffManagement.listTitle")} ({staffList.length}/{maxStaff})
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
          ) : staffList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("staffManagement.listEmpty")}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
              {staffList.map((member) => {
                const isActive = member.status === "active";
                return (
                  <div key={member.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                          <UserRoundCog size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{member.name}</h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 truncate">
                            {member.phone ? (<><PhoneCall size={10} /> {member.phone}</>) : (isActive ? t("staffManagement.statusActive") : t("staffManagement.statusInactive"))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member)}
                          disabled={togglingId === member.id}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${isActive ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                          aria-label={isActive ? t("staffManagement.deactivateAria") : t("staffManagement.activateAria")}
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${isActive ? "translate-x-5" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member)}
                          className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center"
                          aria-label={t("staffManagement.removeAria")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* ROL BELGISI + O'ZGARTIRISH (2026-09 punkt-royxati,
                        2-band): saqlangan `member.role` bo'lsa o'shani,
                        aks holda joriy ruxsatlarga MOS keladigan
                        presetni (agar bo'lsa) ko'rsatadi — mos kelmasa
                        "Moslashtirilgan". */}
                    <div className="relative pl-11.5">
                      <button
                        type="button"
                        disabled={rolePendingId === member.id}
                        onClick={() => setRoleMenuOpenId((v) => (v === member.id ? null : member.id))}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 disabled:opacity-50"
                      >
                        {rolePendingId === member.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <>
                            {member.role && ROLE_META[member.role]
                              ? t(`staffManagement.${ROLE_META[member.role].nameKey}`)
                              : (() => {
                                  const matched = matchRoleFromPermissions(member.permissions);
                                  return matched ? t(`staffManagement.${ROLE_META[matched].nameKey}`) : t("staffManagement.roleCustomOption");
                                })()}
                            <ChevronDown size={11} className={`transition-transform ${roleMenuOpenId === member.id ? "rotate-180" : ""}`} />
                          </>
                        )}
                      </button>
                      {roleMenuOpenId === member.id && (
                        <div className="absolute z-20 mt-1 left-11.5 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-lg max-h-64 overflow-y-auto">
                          {STAFF_ROLE_KEYS.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => handleSetMemberRole(member, role)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <p className="text-[11px] font-black text-slate-700 dark:text-white">{t(`staffManagement.${ROLE_META[role].nameKey}`)}</p>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500">{t(`staffManagement.${ROLE_META[role].descKey}`)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pl-11.5">
                      {PERMISSION_KEYS.map((permKey) => {
                        const { Icon, shortKey } = PERMISSION_META[permKey];
                        const has = normalizeStaffPermissions(member.permissions)[permKey];
                        return (
                          <button
                            key={permKey}
                            type="button"
                            onClick={() => handleTogglePermission(member, permKey)}
                            disabled={permissionPendingKey === `${member.id}:${permKey}`}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 ${
                              has
                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <Icon size={11} /> {t(`staffManagement.${shortKey}`)}
                          </button>
                        );
                      })}
                    </div>

                    {/* 2026-09 punkt-royxati, 11-band: "nazorat va
                        boshqarish" — ish faoliyati (buyurtmalar,
                        FAQAT `manageOrders` ruxsati bo'lgan xodim uchun
                        ma'noli bo'ladi — aks holda son haqiqatda ham
                        nolga teng, bu MOCK emas) VA shu xodimga
                        bog'langan xarajatlar (bog'liq ruxsatdan
                        qat'i nazar — masalan naqd maosh to'lovi). */}
                    <PersonPerformancePanel
                      type="staff"
                      accent="indigo"
                      stats={staffPerformanceById.get(member.id)}
                      expenses={allExpenses.filter((exp) => exp.linkedStaffId === member.id)}
                      onAddExpense={handleAddStaffExpense(member.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {newInviteLink && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={() => setNewInviteLink(null)} role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("staffManagement.inviteReadyTitle")}</h3>
              <button type="button" onClick={() => setNewInviteLink(null)} className="text-slate-400 dark:text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
              <span className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{newInviteLink}</span>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                {linkCopied ? (<><Check size={11} /> {t("staffManagement.copiedButton")}</>) : t("staffManagement.copyButton")}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("staffManagement.inviteHint")}</p>
            <button
              type="button"
              onClick={handleShareInviteLink}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
            >
              <Send size={14} /> {t("staffManagement.shareButton")}
            </button>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title={t("staffManagement.removeConfirmTitle")}
          message={t("staffManagement.removeConfirmMessage", { name: removeTarget.name })}
          confirmLabel={t("staffManagement.removeConfirmLabel")}
          danger
          busy={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
};

export default StaffManagementPage;
