import { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmNotice } from "@/components/warm/WarmPage";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { AdminSecurityDialog } from "./AdminSecurityDialog";
import { ACCESS_ROLE_LABELS, type AdminMutation, type AdminSelf, type AdminUser } from "./types";
import { staffFullName, staffVenue } from "./staff-presentation";
import { ASSIGNABLE_STAFF_ROLES, STAFF_POSITION_LABELS, staffAccessLabel, type AssignableStaffRole, type StaffPosition } from "@/types/auth";

const POSITIONS = Object.keys(STAFF_POSITION_LABELS) as StaffPosition[];
export function AdminUserCard({ user, me, pending, onMutate, onRequestToggle, onRequestDelete }: {
  user: AdminUser; me: AdminSelf; pending: boolean; onMutate: (mutation: AdminMutation) => Promise<void>; onRequestToggle: (user: AdminUser) => void; onRequestDelete: (user: AdminUser) => void;
}) {
  const [role, setRole] = useState<AssignableStaffRole | "manager">(user.role);
  const [position, setPosition] = useState<StaffPosition | "">(user.position_code || "");
  const [securityOpen, setSecurityOpen] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => { setRole(user.role); setPosition(user.position_code || ""); }, [user.role, user.position_code]);
  const isSelf = user.id === me.id;
  const protectedOwner = user.is_owner && !isSelf;
  const roleLocked = user.is_owner || isSelf;
  const dirty = (!roleLocked && role !== user.role) || (position || null) !== (user.position_code || null);
  const blocker = useBlocker(dirty || pending);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  async function save(mutation: AdminMutation) {
    if (pending) return;
    setMessage(null);
    try { await onMutate(mutation); }
    catch { setMessage({ error: true, text: "Изменение не применено. Повторите попытку." }); }
  }
  return <>
    <div className="form-stack bf-personal-form bf-compact-form">
      <div className="bf-personal-pair"><label className="bf-field"><span className="bf-field-label">Имя</span><input readOnly value={user.first_name || ""} /></label><label className="bf-field"><span className="bf-field-label">Фамилия</span><input readOnly value={user.last_name || ""} /></label></div>
      <label className="bf-field"><span className="bf-field-label">Рабочая должность</span><select aria-label="Рабочая должность" value={position} disabled={pending || protectedOwner} onChange={(event) => { setPosition(event.target.value as StaffPosition | ""); setMessage(null); }}><option value="">Не назначена</option>{POSITIONS.map((item) => <option key={item} value={item}>{STAFF_POSITION_LABELS[item]}</option>)}</select></label>
      {(position || null) !== (user.position_code || null) ? <Button type="button" disabled={pending || protectedOwner} onClick={() => void save({ action: "set_position", user_id: user.id, position_code: position || null })}>{pending ? "Сохраняем…" : "Сохранить должность"}</Button> : null}
      <label className="bf-field"><span className="bf-field-label">Роль доступа</span><select aria-label="Роль доступа" value={user.is_owner ? "owner" : role} disabled={pending || roleLocked || protectedOwner} onChange={(event) => { setRole(event.target.value as AssignableStaffRole); setMessage(null); }}>{user.is_owner ? <option value="owner">Владелец</option> : null}{user.role === "manager" ? <option value="manager" disabled>Прежняя роль менеджера</option> : null}{ASSIGNABLE_STAFF_ROLES.map((item) => <option key={item} value={item}>{item === "senior" ? staffAccessLabel({ role: "senior", is_owner: false, position_code: position || null }) : ACCESS_ROLE_LABELS[item]}</option>)}</select></label>
      {!roleLocked && role !== "manager" && role !== user.role ? <Button type="button" disabled={pending || protectedOwner} onClick={() => void save({ action: "set_role", user_id: user.id, role })}>{pending ? "Сохраняем…" : "Сохранить доступ"}</Button> : null}
      <label className="bf-field"><span className="bf-field-label">Дата рождения</span><input type="date" value={user.birth_date || ""} readOnly /></label>
      <dl className="bf-profile-facts"><div><dt>Заведение</dt><dd>{staffVenue(user.position_code)}</dd></div><div><dt>Доступ</dt><dd>{staffAccessLabel(user)}</dd></div></dl>
      <p className="bf-account-hint">{user.is_active ? "Доступ активен." : "Доступ отключён."}{isSelf ? " Свои права и активность здесь изменить нельзя." : ""}{protectedOwner ? " Профиль владельца защищён от изменений другим сотрудником." : ""}</p>
      <div className="bf-account-actions"><Button type="button" variant="secondary" disabled={pending || protectedOwner} onClick={() => setSecurityOpen(true)}><WarmIcon name="admin" size={18} />Безопасность</Button><Button type="button" variant={user.is_active ? "danger" : "secondary"} disabled={pending || isSelf || user.is_owner} onClick={() => onRequestToggle(user)}>{user.is_active ? "Отключить доступ" : "Включить доступ"}</Button></div>
      {!isSelf && !user.is_owner ? <Button type="button" variant="danger" disabled={pending} onClick={() => onRequestDelete(user)}><WarmIcon name="trash" size={18} />Удалить сотрудника</Button> : null}
      {message ? <WarmNotice error={message.error}>{message.text}</WarmNotice> : null}
    </div>
    <AdminSecurityDialog open={securityOpen} userId={user.id} fullName={staffFullName(user)} recoveryConfigured={Boolean(user.recovery_set_at)} pending={pending} onMutate={onMutate} onClose={() => setSecurityOpen(false)} />
    {blocker.state === "blocked" ? <WarmDialog title="Покинуть карточку сотрудника?" confirm onClose={() => { if (!pending && blocker.state === "blocked") blocker.reset(); }}><p>{pending ? "Изменение ещё выполняется. Дождитесь результата." : "Есть несохранённые изменения."}</p><div className="bf-account-actions"><Button type="button" disabled={pending} onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Остаться</Button><Button type="button" variant="danger" disabled={pending} onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Выйти без сохранения</Button></div></WarmDialog> : null}
  </>;
}
