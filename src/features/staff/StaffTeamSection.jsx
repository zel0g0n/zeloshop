import { useEffect, useState, useCallback } from "react";
import { UserRoundCog, Plus, Check, Loader2, ChevronDown, PhoneCall, Trash2 } from "lucide-react";
import { useStaffSession } from "@/context/StaffSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getStaffList } from "@/services/staff/getStaffList";
import { createStaffInvite, setStaffPermissions, setStaffActive, removeStaff } from "@/services/staff/staffManagement";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { formatUzPhone, isValidUzPhone, hasMeaningfulPhoneDigits } from "@/utils/phone";
import { getTariffLimits } from "@/utils/tariffLimits";
import {
  PERMISSION_KEYS, STAFF_ROLE_KEYS, normalizeStaffPermissions,
  getRolePermissionPreset, matchRoleFromPermissions,
} from "@/utils/staffRoles";
import { PERMISSION_META, ROLE_META } from "@/features/staff/staffPermissionMeta";

const EMPTY_PERMISSIONS = normalizeStaffPermissions(null);

/**
 * Xodim Mini App'i — "Jamoa" bo'limi. Faqat `permissions.manageStaff`
 * ruxsatiga ega FAOL xodimga ("Admin" roli) ko'rsatiladi (2026-09
 * punkt-royxati, 2-band "Advanced Team & RBAC").
 *
 * `src/features/seller/components/staff/StaffManagementPage.jsx`ning
 * xodim-tomonidagi qisqartirilgan versiyasi — bir xil HAQIQIY servis
 * funksiyalarini (`createStaffInvite`/`setStaffPermissions`/
 * `setStaffActive`/`removeStaff`) ishlatadi. MUHIM FARQ: bu yerda
 * chaqiruvchi HAQIQIY do'kon egasi EMAS, shuning uchun backend
 * (`functions/staff.js` + `functions/lib/staffRoles.js`dagi
 * `canActorManageTargetStaff`) ba'zi amallarni ATAYLAB rad etishi
 * mumkin (masalan, ALLAQACHON `manageStaff`ga ega BOSHQA xodimni
 * tahrirlash/o'chirish — "teng darajadagilar bir-birini boshqara
 * olmaydi"). Bu yerdagi UI, seller sahifasidan farqli o'laroq, bunday
 * xatoliklarni JIM YUTMAYDI — aniq xabar bilan ko'rsatadi, chunki
 * xodim-administrator uchun bu KUTILGAN, tez-tez uchraydigan holat.
 */
const StaffTeamSection = () => {
  const { t } = useLanguage();
  const { sellerId, staffId, store } = useStaffSession();
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

  const [actionError, setActionError] = useState(null);

  // --- Yangi xodim qo'shish ---
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState(null);
  const [newPermissions, setNewPermissions] = useState(EMPTY_PERMISSIONS);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newInviteLink, setNewInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const atLimit = maxStaff !== null && staffList.length >= maxStaff;

  const handleSelectRole = useCallback((role) => {
    setNewRole(role);
    setRoleMenuOpen(false);
    const preset = getRolePermissionPreset(role);
    if (preset) setNewPermissions(preset);
  }, []);

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

  // --- Faollashtirish/o'chirish/ruxsat/rol ---
  const [togglingId, setTogglingId] = useState(null);
  const [permissionPendingKey, setPermissionPendingKey] = useState(null);
  const [rolePendingId, setRolePendingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const handleToggleActive = useCallback(async (member) => {
    setTogglingId(member.id);
    setActionError(null);
    try {
      await setStaffActive(member.id, member.status !== "active");
    } catch (err) {
      setActionError(err.message || t("staffApp.teamActionDenied"));
    } finally {
      setTogglingId(null);
    }
  }, [t]);

  const handleTogglePermission = useCallback(async (member, permKey) => {
    const pendingKey = `${member.id}:${permKey}`;
    setPermissionPendingKey(pendingKey);
    setActionError(null);
    try {
      const current = normalizeStaffPermissions(member.permissions);
      const nextPermissions = { ...current, [permKey]: !current[permKey] };
      await setStaffPermissions(member.id, nextPermissions, matchRoleFromPermissions(nextPermissions));
    } catch (err) {
      setActionError(err.message || t("staffApp.teamActionDenied"));
    } finally {
      setPermissionPendingKey(null);
    }
  }, [t]);

  const handleSetMemberRole = useCallback(async (member, role) => {
    setRoleMenuOpenId(null);
    setRolePendingId(member.id);
    setActionError(null);
    try {
      const preset = getRolePermissionPreset(role) || EMPTY_PERMISSIONS;
      await setStaffPermissions(member.id, preset, role);
    } catch (err) {
      setActionError(err.message || t("staffApp.teamActionDenied"));
    } finally {
      setRolePendingId(null);
    }
  }, [t]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setActionError(null);
    try {
      await removeStaff(removeTarget.id);
      setRemoveTarget(null);
    } catch (err) {
      setActionError(err.message || t("staffApp.teamActionDenied"));
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, t]);

  return (
    <div className="p-4 space-y-4 pb-24">
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
              const isSelf = String(member.id) === String(staffId);
              return (
                <div key={member.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                        <UserRoundCog size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {member.name}{isSelf ? ` (${t("staffApp.youSuffix")})` : ""}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 truncate">
                          {member.phone ? (<><PhoneCall size={10} /> {member.phone}</>) : (isActive ? t("staffManagement.statusActive") : t("staffManagement.statusInactive"))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member)}
                        disabled={togglingId === member.id || isSelf}
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {newInviteLink && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={() => setNewInviteLink(null)} role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("staffManagement.inviteReadyTitle")}</h3>
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
              onClick={() => setNewInviteLink(null)}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md"
            >
              {t("common.close")}
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

      {actionError && <Toast message={actionError} onDone={() => setActionError(null)} duration={3500} />}
    </div>
  );
};

export default StaffTeamSection;
