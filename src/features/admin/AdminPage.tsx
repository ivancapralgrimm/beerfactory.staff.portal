import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmTitle, WarmRow, WarmEmpty, WarmNotice } from "@/components/warm/WarmPage";
import { AdminApiError, loadAdminUsers, mutateAdminUser } from "./admin-api";
import { AdminAuditPanel } from "./AdminAuditPanel";
import { AdminAttemptsPanel } from "./AdminAttemptsPanel";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { AdminUserCard } from "./AdminUserCard";
import { ShiftHistoryPanel } from "./ShiftHistoryPanel";
import { staffFullName, staffVenue } from "./staff-presentation";
import { registrationQr, registrationUrl } from "./invitation";
import type { AdminMutation, AdminSelf, AdminUser } from "./types";
import { useAuth } from "@/features/auth/auth-context";
import { canManageStaffClient, staffAccessLabel, STAFF_POSITION_LABELS } from "@/types/auth";
import "@/features/settings/profile-admin.css";

type ConfirmState = { kind: "toggle" | "delete"; user: AdminUser } | null;
function errorText(error: unknown) {
  if (!(error instanceof AdminApiError)) return "Не удалось сохранить изменение.";
  const errors: Record<string, string> = { owner_required: "Это действие доступно только владельцу.", owner_protected: "Аккаунт владельца защищён.", cannot_demote_self: "Нельзя изменить собственные права.", cannot_disable_self: "Нельзя отключить собственный доступ.", cannot_delete_self: "Нельзя удалить собственный аккаунт.", invalid_role: "Выберите другой уровень доступа.", invalid_position: "Выберите другую должность.", user_not_found: "Сотрудник больше не найден. Обновите список." };
  return errors[error.code] || "Изменение не применено.";
}
export function AdminPage() {
  const { state, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const section = params.get("section");
  const userId = params.get("user");
  const shiftHistory = section === "audit" && params.get("view") === "shifts";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [me, setMe] = useState<AdminSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [inviting, setInviting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ error: boolean; text: string } | null>(null);
  const authenticated = state.status === "authenticated";
  const canManage = authenticated && canManageStaffClient(state.user);
  const token = authenticated ? state.session.access_token : null;
  const load = useCallback(async (quiet = false) => {
    if (!token || !canManage) return;
    if (!quiet) setLoading(true);
    setError(null);
    try { const data = await loadAdminUsers(token); setUsers(data.users); setMe(data.me); return true; }
    catch { setError("Не удалось загрузить команду."); return false; }
    finally { if (!quiet) setLoading(false); }
  }, [token, canManage]);
  useEffect(() => { if (section && canManage) void load(); }, [load, section, canManage]);
  useEffect(() => { setActionMessage(null); }, [userId]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru");
    return users.filter((user) => `${staffFullName(user)} ${user.position_code ? STAFF_POSITION_LABELS[user.position_code] : ""} ${staffAccessLabel(user)} ${staffVenue(user.position_code)}`.toLocaleLowerCase("ru").includes(needle));
  }, [users, search]);
  async function mutate(mutation: AdminMutation) {
    if (!token || pendingId) throw new Error("unauthorized_or_busy");
    setPendingId(mutation.user_id); setActionMessage(null);
    try {
      const result = await mutateAdminUser(token, mutation);
      const reloaded = await load(true);
      if (authenticated && mutation.user_id === state.user.id) await refreshProfile();
      setActionMessage({ error: !reloaded, text: !reloaded ? "Изменение сохранено, но обновить список не удалось. Обновите страницу перед следующим изменением." : result.audit_recorded === false ? "Изменение сохранено. Запись в журнале пока недоступна." : "Изменение сохранено." });
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.payload.prepared === true) {
        await load(true);
        setActionMessage({ error: true, text: "Удаление не завершено. Доступ сотрудника уже отключён; обновите список перед повторной попыткой." });
      } else setActionMessage({ error: true, text: errorText(reason) });
      throw reason;
    }
    finally { setPendingId(null); }
  }
  async function confirmAction() {
    if (!confirm) return;
    try { await mutate(confirm.kind === "toggle" ? { action: "set_active", user_id: confirm.user.id, is_active: !confirm.user.is_active } : { action: "delete_user", user_id: confirm.user.id }); setConfirm(null); }
    catch { /* The original action remains open and its error is shown. */ }
  }
  if (!authenticated) return null;
  if (!section) return <Navigate to="/settings" replace />;
  if (section !== "audit" && !canManage) return <Navigate to="/settings" replace />;
  if (!["team", "attempts", "audit"].includes(section)) return <Navigate to="/settings" replace />;
  const selected = users.find((user) => user.id === userId);
  const name = confirm ? staffFullName(confirm.user) : "сотрудника";
  return <section className="stack bf-editor-page bf-account-page">
    <WarmBack to={shiftHistory ? "/admin?section=audit" : userId && section === "team" ? "/admin?section=team" : "/settings"} label={shiftHistory ? "В журнал" : userId && section === "team" ? "К сотрудникам" : "В настройки"} />
    <WarmTitle title={section === "audit" ? shiftHistory ? "История смен" : "Журнал" : section === "attempts" ? "Аттестации" : userId && selected ? staffFullName(selected) : "Сотрудники"} action={section === "team" && !userId ? <Button type="button" variant="primary" onClick={() => setInviting(true)}>Пригласить</Button> : undefined} />
    {actionMessage ? <WarmNotice error={actionMessage.error}>{actionMessage.text}</WarmNotice> : null}
    {section === "team" ? <>
      {userId ? loading ? <p role="status" className="bf-account-hint">Загружаем сотрудника…</p> : error ? <WarmNotice error>{error}</WarmNotice> : selected && me ? <AdminUserCard key={selected.id} user={selected} me={me} pending={pendingId !== null} onMutate={mutate} onRequestToggle={(user) => setConfirm({ kind: "toggle", user })} onRequestDelete={(user) => setConfirm({ kind: "delete", user })} /> : <WarmEmpty title="Сотрудник не найден" body="Вернитесь к списку и выберите доступную запись." /> : <>
        <div className="bf-bank-tools"><label className="bf-field"><span className="bf-field-label">Найти сотрудника</span><input type="search" placeholder="Имя, должность или доступ" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{!loading && !error ? <p className="bf-bank-counts">Найдено: {filtered.length} из {users.length} · активны {users.filter((user) => user.is_active).length}</p> : null}</div>
        {loading ? <p role="status" className="bf-account-hint">Загружаем сотрудников…</p> : error ? <><WarmNotice error>{error}</WarmNotice><Button type="button" onClick={() => void load()}>Повторить</Button></> : filtered.length ? <div className="bf-bank-list">{filtered.map((user) => <Link className="bf-directory-row" key={user.id} to={`/admin?section=team&user=${encodeURIComponent(user.id)}`}><span className="bf-directory-copy"><span className="bf-directory-name"><strong>{staffFullName(user)}</strong><span className="bf-directory-status">{user.is_active ? "Активен" : "Отключён"}</span></span><span>{user.position_code ? STAFF_POSITION_LABELS[user.position_code] : "Не назначена"} · {staffVenue(user.position_code)} · {staffAccessLabel(user)}</span></span><WarmIcon name="chevron" size={18} /></Link>)}</div> : <WarmEmpty title="Сотрудник не найден" body="Попробуйте другое имя или очистите поиск." />}
      </>}
    </> : null}
    {section === "attempts" ? <AdminAttemptsPanel users={users} /> : null}
    {section === "audit" ? shiftHistory ? <ShiftHistoryPanel /> : <>{canManage ? <AdminAuditPanel users={users} /> : null}<WarmRow to="/admin?section=audit&view=shifts" title="История смен" description="Завершённые и открытые смены моей должности" icon="clock" /></> : null}
    {inviting ? <WarmDialog title="Пригласить сотрудника" onClose={() => setInviting(false)}><div className="bf-invitation"><p>Отсканируйте QR-код, чтобы открыть регистрацию BFStaff.</p><img src={registrationQr} alt="QR-код регистрации BFStaff" width={260} height={260} /><a className="bf-registration-link" href={registrationUrl} target="_blank" rel="noopener noreferrer">bfstaff.vercel.app/#/register<WarmIcon name="arrow" size={17} /></a><p className="bf-account-hint">Регистрация проходит на сайте. Права назначаются отдельно.</p></div></WarmDialog> : null}
    <AdminConfirmDialog open={Boolean(confirm)} title={confirm?.kind === "delete" ? `Удалить ${name}?` : confirm?.user.is_active ? `Отключить доступ ${name}?` : `Включить доступ ${name}?`} description={confirm?.kind === "delete" ? "Учётная запись и личные данные будут удалены. Действие необратимо." : confirm?.user.is_active ? "Сотрудник не сможет войти до повторного включения доступа." : "Сотрудник снова сможет войти в портал."} confirmLabel={confirm?.kind === "delete" ? "Удалить навсегда" : confirm?.user.is_active ? "Отключить" : "Включить"} requirePhrase={confirm?.kind === "delete" ? "УДАЛИТЬ" : undefined} pending={pendingId !== null} error={actionMessage?.error ? actionMessage.text : null} onCancel={() => { if (!pendingId) setConfirm(null); }} onConfirm={() => void confirmAction()} />
  </section>;
}
