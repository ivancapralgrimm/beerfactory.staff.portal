import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmNotice } from "@/components/warm/WarmPage";
import type { AdminMutation } from "./types";

const codeOk = (value: string) => /^\d{4,12}$/.test(value);
export function AdminSecurityDialog({ open, userId, fullName, recoveryConfigured, pending, onMutate, onClose }: {
  open: boolean; userId: string; fullName: string; recoveryConfigured: boolean; pending: boolean; onMutate: (mutation: AdminMutation) => Promise<void>; onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [action, setAction] = useState<"password" | "secret" | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => { if (!open) { setPassword(""); setSecret(""); setMessage(null); setAction(null); } }, [open]);
  if (!open) return null;
  const busy = pending || action !== null;
  async function save(event: FormEvent<HTMLFormElement>, kind: "password" | "secret") {
    event.preventDefault();
    const value = (kind === "password" ? password : secret).trim();
    if (busy || !codeOk(value)) return;
    setAction(kind); setMessage(null);
    try {
      await onMutate(kind === "password" ? { action: "set_password", user_id: userId, password: value } : { action: "set_secret", user_id: userId, secret_code: value });
      if (kind === "password") setPassword(""); else setSecret("");
      setMessage({ error: false, text: kind === "password" ? "Код входа обновлён." : "Код восстановления обновлён." });
    } catch { setMessage({ error: true, text: "Не удалось обновить код. Повторите попытку." }); }
    finally { setAction(null); }
  }
  return <WarmDialog title="Безопасность" onClose={() => { if (!busy) onClose(); }}>
    <p>{fullName}</p>
    <p className="bf-account-hint">Коды входа и восстановления: от 4 до 12 цифр.</p>
    <form className="form-stack bf-compact-form" onSubmit={(event) => void save(event, "password")}><label className="bf-field"><span className="bf-field-label">Новый код входа</span><input type="password" inputMode="numeric" autoComplete="new-password" value={password} disabled={busy} maxLength={12} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 12))} /></label><Button type="submit" disabled={busy || !codeOk(password)}>{action === "password" ? "Сохраняем…" : "Изменить код входа"}</Button></form>
    <form className="form-stack bf-compact-form" onSubmit={(event) => void save(event, "secret")}><label className="bf-field"><span className="bf-field-label">Новый код восстановления</span><input type="password" inputMode="numeric" autoComplete="off" value={secret} disabled={busy} maxLength={12} onChange={(event) => setSecret(event.target.value.replace(/\D/g, "").slice(0, 12))} /></label><p className="bf-account-hint">{recoveryConfigured ? "Код восстановления настроен." : "Код восстановления ещё не настроен."}</p><Button type="submit" disabled={busy || !codeOk(secret)}>{action === "secret" ? "Сохраняем…" : "Изменить код восстановления"}</Button></form>
    {message ? <WarmNotice error={message.error}>{message.text}</WarmNotice> : null}
  </WarmDialog>;
}
