import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmNotice } from "@/components/warm/WarmPage";

export function AdminConfirmDialog({ open, title, description, confirmLabel, requirePhrase, pending, error, onCancel, onConfirm }: {
  open: boolean; title: string; description: string; confirmLabel: string; requirePhrase?: string; pending: boolean; error?: string | null; onCancel: () => void; onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  useEffect(() => { if (!open) setPhrase(""); }, [open]);
  if (!open) return null;
  const phraseOk = !requirePhrase || phrase.trim().toUpperCase() === requirePhrase.toUpperCase();
  return <WarmDialog title={title} confirm onClose={() => { if (!pending) onCancel(); }}>
    <p>{description}</p>
    {error ? <WarmNotice error>{error}</WarmNotice> : null}
    {requirePhrase ? <label className="bf-field"><span className="bf-field-label">Для подтверждения введите {requirePhrase}</span><input value={phrase} disabled={pending} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" /></label> : null}
    <div className="bf-account-actions"><Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Отмена</Button><Button type="button" variant="danger" disabled={pending || !phraseOk} onClick={onConfirm}>{pending ? "Выполняем…" : confirmLabel}</Button></div>
  </WarmDialog>;
}
