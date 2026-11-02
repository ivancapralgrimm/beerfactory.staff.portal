import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmTitle, WarmRow, WarmNotice } from "@/components/warm/WarmPage";
import { fetchStaffProfile, updateStaffProfile } from "@/features/auth/auth-api";
import { useAuth } from "@/features/auth/auth-context";
import { staffFullName, staffVenue } from "@/features/admin/staff-presentation";
import { NotificationSettingsPage } from "@/features/settings/NotificationSettingsPage";
import { STAFF_POSITION_LABELS, staffAccessLabel, type StaffPosition, type StaffProfile } from "@/types/auth";
import "@/features/settings/profile-admin.css";

const POSITIONS = Object.keys(STAFF_POSITION_LABELS) as StaffPosition[];
function validBirthDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > new Date().toISOString().slice(0, 10)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function changeTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Novosibirsk" }).format(new Date(value));
}

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const view = location.pathname.endsWith("/details") ? "details" : params.get("view");
  const { state, logout, refreshProfile } = useAuth();
  const authUser = state.status === "authenticated" ? state.user : null;
  const [confirmedProfile, setConfirmedProfile] = useState<StaffProfile | null>(null);
  const user = confirmedProfile?.id === authUser?.id ? { ...authUser, ...confirmedProfile } : authUser;
  const [position, setPosition] = useState<StaffPosition | "">(user?.position_code || "");
  const [birthDate, setBirthDate] = useState(user?.birth_date || "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const baseline = useRef({ id: authUser?.id || "", position: authUser?.position_code || "", birthDate: authUser?.birth_date || "" });
  useEffect(() => {
    const previous = baseline.current;
    const next = { id: authUser?.id || "", position: authUser?.position_code || "", birthDate: authUser?.birth_date || "" };
    // A profile refresh must not discard an unsaved birthday or position draft.
    setPosition((current) => previous.id !== next.id || current === previous.position ? next.position as StaffPosition | "" : current);
    setBirthDate((current) => previous.id !== next.id || current === previous.birthDate ? next.birthDate : current);
    baseline.current = next;
    setConfirmedProfile(null);
  }, [authUser?.id, authUser?.position_code, authUser?.birth_date, authUser?.position_change_allowed, authUser?.position_change_reason]);
  useEffect(() => { setMessage(null); }, [view]);
  const positionDirty = position !== (user?.position_code || "");
  const birthdayDirty = birthDate !== (user?.birth_date || "");
  const dirty = positionDirty || birthdayDirty;
  const guarding = Boolean(user && view === "details" && (dirty || pending));
  const blocker = useBlocker(guarding);
  useEffect(() => {
    if (!guarding) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guarding]);
  if (state.status !== "authenticated" || !user) return null;
  const token = state.session.access_token;
  const positionLocked = user.position_change_allowed !== true;
  const fullName = staffFullName(user);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !dirty) return;
    if (!validBirthDate(birthDate)) {
      setMessage({ error: true, text: "Укажите существующую дату рождения с 1900 года по сегодняшний день." }); return;
    }
    if (positionDirty && (positionLocked || !position)) {
      setMessage({ error: true, text: "Сейчас должность изменить нельзя. Верните текущую должность и сохраните остальные данные." }); return;
    }
    setPending(true); setMessage(null);
    try {
      const updated = await updateStaffProfile(token, {
        ...(birthdayDirty ? { birthDate: birthDate || null } : {}),
        ...(positionDirty && position ? { positionCode: position } : {})
      });
      const verified = updated || await fetchStaffProfile(token);
      if (!verified || verified.id !== user!.id || (birthdayDirty && (verified.birth_date || "") !== birthDate) || (positionDirty && verified.position_code !== position)) throw new Error("profile_confirmation_failed");
      setConfirmedProfile(verified);
      baseline.current = { id: verified.id, position: verified.position_code || "", birthDate: verified.birth_date || "" };
      await refreshProfile();
      setMessage({ error: false, text: "Личные данные сохранены." });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      // Main's PATCH may commit a position before a later birthday/read fails.
      // Reconcile the real server state while retaining each uncommitted draft.
      try {
        const verified = await fetchStaffProfile(token);
        if (verified && verified.id === user!.id) {
          setConfirmedProfile(verified);
          baseline.current = { id: verified.id, position: verified.position_code || "", birthDate: verified.birth_date || "" };
        }
      } catch { /* Retain drafts and the last verified profile when offline. */ }
      if (code === "position_change_next_window" || code === "position_change_window_locked") {
        setMessage({ error: true, text: code === "position_change_window_locked" ? "Изменить должность можно с 11:00 до 02:59 по Новосибирску." : "Должность уже менялась в эту смену." });
      } else setMessage({ error: true, text: "Не удалось подтвердить сохранение всех данных. Проверьте поля и повторите попытку." });
    } finally { setPending(false); }
  }
  async function signOut() {
    if (pending) return;
    setPending(true); setMessage(null);
    try { await logout(); navigate("/login", { replace: true }); }
    catch { setMessage({ error: true, text: "Не удалось выйти. Повторите попытку." }); setPending(false); }
  }
  if (view === "notifications") return <NotificationSettingsPage fromProfile />;
  if (view === "details") {
    const nextChange = changeTime(user.position_change_available_at);
    return <section className="stack bf-profile-page bf-account-page">
      <WarmBack to="/profile" label="В профиль" />
      <WarmTitle title="Личные данные" />
      <form className="form-stack bf-personal-form bf-compact-form" onSubmit={(event) => void save(event)}>
        <div className="bf-personal-pair">
          <label className="bf-field"><span className="bf-field-label">Имя</span><input autoComplete="given-name" value={user.first_name || ""} readOnly /></label>
          <label className="bf-field"><span className="bf-field-label">Фамилия</span><input autoComplete="family-name" value={user.last_name || ""} readOnly /></label>
        </div>
        <label className="bf-field"><span className="bf-field-label">Дата рождения</span><input type="date" autoComplete="bday" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={birthDate} disabled={pending} onChange={(event) => { setBirthDate(event.target.value); setMessage(null); }} /></label>
        <label className="bf-field"><span className="bf-field-label">Рабочая должность</span><select value={position} disabled={positionLocked || pending} onChange={(event) => { setPosition(event.target.value as StaffPosition); setMessage(null); }}><option value="" disabled>Не назначена</option>{POSITIONS.map((item) => <option key={item} value={item}>{STAFF_POSITION_LABELS[item]}</option>)}</select><span className="bf-account-hint">{positionLocked ? user.position_change_reason === "window_locked" ? "Изменить можно с 11:00 до 02:59 по Новосибирску." : "Должность уже менялась в эту рабочую смену." : "Можно изменить один раз за рабочую смену. Роль доступа здесь не меняется."}{positionLocked && nextChange ? ` Следующая возможность: ${nextChange}.` : ""}</span></label>
        <dl className="bf-profile-facts"><div><dt>Заведение</dt><dd>{staffVenue(user.position_code)}</dd></div><div><dt>Доступ</dt><dd>{staffAccessLabel(user)}</dd></div></dl>
        <Button type="submit" variant="primary" disabled={pending || !dirty}>{pending ? "Сохраняем…" : "Сохранить изменения"}</Button>
      </form>
      {message ? <WarmNotice error={message.error}>{message.text}</WarmNotice> : null}
      {blocker.state === "blocked" ? <WarmDialog title="Покинуть личные данные?" confirm onClose={() => { if (!pending && blocker.state === "blocked") blocker.reset(); }}><p>{pending ? "Сохранение ещё выполняется. Дождитесь результата." : "Есть несохранённые изменения."}</p><div className="bf-account-actions"><Button type="button" disabled={pending} onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Остаться</Button><Button type="button" variant="danger" disabled={pending} onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Выйти без сохранения</Button></div></WarmDialog> : null}
    </section>;
  }
  return <section className="stack bf-profile-page bf-account-page">
    <WarmTitle title="Мой профиль" />
    <section className="bf-profile-identity" aria-label="Личная карточка"><StaffAvatar user={{ id: state.user.id, position_code: user.position_code, is_owner: user.is_owner }} className="bf-profile-avatar" /><div><h2>{fullName}</h2><p className="bf-profile-position"><span>{user.position_code ? STAFF_POSITION_LABELS[user.position_code] : "Должность не назначена"}</span><span aria-hidden="true"> • </span><span>{staffVenue(user.position_code)}</span></p><span className="bf-profile-access">{staffAccessLabel(user)}</span></div></section>
    <div className="bf-profile-group">
      <WarmRow to="/profile?view=details" title="Личные данные" description="Дата рождения и рабочая должность" icon="people" />
      <WarmRow to="/attestation?view=history" title="Мои аттестации" description="Результаты и разбор моих ответов" icon="shift" />
      <WarmRow to="/profile?view=notifications" title="Уведомления" description="Важные сообщения команды" icon="bell" />
    </div>
    <button type="button" className="bf-account-logout" disabled={pending} onClick={() => void signOut()}><WarmIcon name="logout" size={18} />{pending ? "Выходим…" : "Выйти из аккаунта"}</button>
    {message ? <WarmNotice error={message.error}>{message.text}</WarmNotice> : null}
  </section>;
}
