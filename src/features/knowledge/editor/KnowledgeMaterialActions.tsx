import { useId, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { useKnowledgeEditorAccess } from "./use-editor-access";
import { useKnowledgeLifecycleCapabilities, loadKnowledgeLifecycleCapabilities } from "./use-knowledge-lifecycle";
import { deleteKnowledgeArticle, loadKnowledgeEditorContext, saveKnowledgeArticle, KnowledgeEditorApiError } from "./knowledge-editor-api";
import type { KnowledgeArticleDocument } from "./article-model";
import { invalidateKnowledgeArticles } from "../knowledge-data";
import { knowledgeErrorMessage } from "./knowledge-errors";

export function KnowledgeMaterialActions({document: article, disabled = false, onSaved}: {
  document?: KnowledgeArticleDocument | null; disabled?: boolean; onSaved?: (document: KnowledgeArticleDocument) => void;
}) {
  const access = useKnowledgeEditorAccess();
  const capability = useKnowledgeLifecycleCapabilities();
  const navigate = useNavigate();
  const id = useId();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const scope = useRef(access.userId);
  useEffect(() => { alive.current = true; return () => {alive.current = false;}; }, []);
  useEffect(() => {scope.current = access.userId; setConfirm(null); setError(""); setBusy(false);}, [access.userId]);
  if (!article || article.revision === 0 || !access.canEdit || !access.canPublish) return null;
  const unavailable = !capability.knowledgeLifecycle;
  async function perform() {
    if (!article || !confirm || busy || disabled || unavailable) return;
    const operation = confirm, userId = access.userId;
    const current = () => alive.current && scope.current === userId;
    setBusy(true); setError("");
    try {
      const context = await loadKnowledgeEditorContext();
      if (!context.can_edit || !context.can_publish) throw new KnowledgeEditorApiError("forbidden");
      const currentCapability = await loadKnowledgeLifecycleCapabilities();
      if (!currentCapability.knowledgeLifecycle) throw new KnowledgeEditorApiError("knowledge_lifecycle_unavailable");
      if (!current()) return;
      if (operation === "archive") {
        const next = {...article, status: "archived" as const};
        const saved = await saveKnowledgeArticle(next, article.revision);
        invalidateKnowledgeArticles();
        if (current()) { onSaved?.({...next, revision: saved.revision}); setConfirm(null); }
        if (current() && !onSaved) navigate("/knowledge/manage", {replace: true});
      } else {
        await deleteKnowledgeArticle(article.id, article.revision);
        invalidateKnowledgeArticles();
        if (current()) navigate("/knowledge/manage", {replace: true});
      }
    } catch (e) { if (current()) { setError(knowledgeErrorMessage(e)); setConfirm(null); } }
    finally { if (current()) setBusy(false); }
  }
  return <>
    <details className="bf-content-actions bf-knowledge-material-actions">
      <summary><span>Действия с материалом</span><WarmIcon name="chevron" size={18} /></summary>
      <div className="bf-knowledge-material-actions-body">
        <div className="bf-material-action-buttons">
          <Button type="button" disabled={disabled || busy || unavailable || article.status === "archived"} aria-describedby={`${id}-help`} onClick={() => {setError(""); setConfirm("archive");}}><WarmIcon name="archive" size={18} />В архив</Button>
          <Button type="button" variant="danger" disabled={disabled || busy || unavailable} aria-describedby={`${id}-help`} onClick={() => {setError(""); setConfirm("delete");}}><WarmIcon name="trash" size={18} />Удалить</Button>
        </div>
        <p id={`${id}-help`}>{unavailable ? "Эти действия станут доступны после обновления сервера для связанных вопросов и билетов." : disabled ? "Сначала сохраните изменения статьи." : "Связанные вопросы и билеты будут обновлены вместе с материалом. История попыток сохранится."}</p>
        {error && <p role="alert" className="bf-error">{error}</p>}
        {busy && <p role="status">Сохраняем изменения…</p>}
      </div>
    </details>
    {confirm && <WarmDialog title={confirm === "archive" ? "Убрать статью в архив?" : "Удалить статью?"} confirm onClose={() => {if (!busy) setConfirm(null);}}>
      <p>{confirm === "archive" ? "Статья и связанные вопросы будут архивированы. Вопросы в билетах будут перераспределены." : "Статья и связанные вопросы будут удалены навсегда. Вопросы в билетах будут перераспределены."} История попыток сохранится.</p>
      <div className="bf-bank-actions"><Button type="button" disabled={busy} onClick={() => setConfirm(null)}>Отмена</Button><Button type="button" variant={confirm === "delete" ? "danger" : "primary"} disabled={busy} onClick={() => void perform()}>{busy ? "Подождите…" : confirm === "delete" ? "Удалить" : "В архив"}</Button></div>
    </WarmDialog>}
  </>;
}
