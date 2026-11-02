import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle } from "@/components/warm/WarmPage";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { KnowledgeMaterialActions } from "./KnowledgeMaterialActions";
import "../knowledge-warm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  invalidateKnowledgeArticles,
  knowledgeSource,
} from "../knowledge-data";
import {
  createKnowledgeArticle,
  createKnowledgeBlock,
  insertKnowledgeBlock,
  moveKnowledgeBlock,
  validateKnowledgeArticle,
  type KnowledgeArticleDocument,
  type KnowledgeBlock,
} from "./article-model";
import {
  loadKnowledgeArticleForEditor,
  loadKnowledgeEditorContext,
  saveKnowledgeArticle,
  uploadKnowledgeImage,
  KnowledgeEditorApiError,
} from "./knowledge-editor-api";
import { useKnowledgeEditorAccess } from "./use-editor-access";
import { prepareKnowledgeImage } from "./image-validation";
import { signKnowledgeMedia, legacyKnowledgeImage } from "./knowledge-media";
import { knowledgeErrorMessage } from "./knowledge-errors";
import { KnowledgeDocumentView } from "./KnowledgeDocumentView";
import { EditorBlock } from "./EditorBlock";
import { AddContentMenu } from "./AddContentMenu";
import { loadKnowledgeLifecycleCapabilities, useKnowledgeLifecycleCapabilities } from "./use-knowledge-lifecycle";

export function KnowledgeEditorPage() {
  const { articleId } = useParams();
  const access = useKnowledgeEditorAccess();
  const capability = useKnowledgeLifecycleCapabilities();
  const originalStatus = useRef<KnowledgeArticleDocument["status"]>("draft");
  const key = `${access.userId}:${articleId || "new"}`;
  const [document, setDocument] = useState<KnowledgeArticleDocument | null>(
    null,
  );
  const canUseEditor =
    articleId || (document?.revision || 0) > 0
      ? access.canEdit
      : access.canCreate;
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const loadedKey = useRef("");
  const userScope = useRef(access.userId);
  const alive = useRef(true);
  const loadGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<{ after: string | null; replace?: string } | null>(
    null,
  );
  const blocker = useBlocker(dirty || busy);
  const [confirmation, setConfirmation] = useState<{title: string; body: string; run: () => void} | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      loadGeneration.current++;
    };
  }, []);
  useEffect(() => {
    if (userScope.current !== access.userId) {
      userScope.current = access.userId;
      loadGeneration.current++;
      loadedKey.current = "";
      setDocument(null);
      setUrls({});
      setDirty(false);
      setBusy(false);
      setError("");
    }
  }, [access.userId]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function load() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    if (loadedKey.current !== key) {
      setDocument(null);
      setUrls({});
    }
    try {
      const next = articleId
        ? await loadKnowledgeArticleForEditor(articleId)
        : createKnowledgeArticle();
      if (!alive.current || generation !== loadGeneration.current) return;
      loadedKey.current = key;
      originalStatus.current = next.status;
      setDocument(next);
      setDirty(false);
      setMessage("");
      const paths = next.blocks.flatMap((b) =>
        b.type === "image" && b.storagePath ? [b.storagePath] : [],
      );
      try {
        const signed = await signKnowledgeMedia(paths);
        if (!alive.current || generation !== loadGeneration.current) return;
        setUrls(
          Object.fromEntries(
            next.blocks.flatMap((b) =>
              b.type === "image"
                ? [
                    [
                      b.id,
                      legacyKnowledgeImage(b.legacySrc) ||
                        (b.storagePath ? signed[b.storagePath] : ""),
                    ],
                  ]
                : [],
            ),
          ),
        );
      } catch {
        if (alive.current)
          setMessage("Некоторые картинки недоступны. Текст статьи загружен.");
      }
    } catch (e) {
      if (alive.current && generation === loadGeneration.current)
        setError(knowledgeErrorMessage(e));
    } finally {
      if (alive.current && generation === loadGeneration.current)
        setLoading(false);
    }
  }
  useEffect(() => {
    if (canUseEditor && loadedKey.current !== key) void load();
  }, [canUseEditor, key]);
  const mediaScope =
    document?.blocks.flatMap((b) =>
      b.type === "image" && b.storagePath ? [[b.id, b.storagePath]] : [],
    ) || [];
  const mediaKey = JSON.stringify(mediaScope);
  useEffect(() => {
    if (!canUseEditor || !mediaScope.length) return;
    let active = true,
      generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try {
        const signed = await signKnowledgeMedia(
          mediaScope.map(([, path]) => path),
        );
        if (active && current === generation)
          setUrls((old) => ({
            ...old,
            ...Object.fromEntries(
              mediaScope.map(([id, path]) => [id, signed[path] || ""]),
            ),
          }));
      } catch {
        /* Preserve the draft and show the image placeholder. */
      }
    };
    void refresh();
    const visible = () => {
      if (window.document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(visible, 50 * 60 * 1000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    window.document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      window.document.removeEventListener("visibilitychange", visible);
    };
  }, [mediaKey, key, canUseEditor]);
  function change(next: KnowledgeArticleDocument) {
    setDocument(next);
    setDirty(true);
    setMessage("");
  }
  function updateBlock(block: KnowledgeBlock) {
    if (document)
      change({
        ...document,
        blocks: document.blocks.map((b) => (b.id === block.id ? block : b)),
      });
  }
  function add(type: KnowledgeBlock["type"], after: string | null, level?: 2 | 3) {
    if (!document) return;
    try {
      const block = createKnowledgeBlock(type);
      if (block.type === "heading") block.level = level ?? 2;
      change(insertKnowledgeBlock(document, block, after));
      requestAnimationFrame(() => window.document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] [data-block-focus]`)?.focus());
    } catch (e) {
      setError(knowledgeErrorMessage(e));
    }
  }
  function chooseImage(after: string | null, replace?: string) {
    if (busy || !capability.knowledgeMediaCleanup) return;
    target.current = { after, replace };
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.click();
    }
  }
  async function upload(file: File) {
    const insertion = target.current;
    target.current = null;
    if (!document || !insertion || busy) return;
    const operationGeneration = loadGeneration.current;
    const currentOperation = () =>
      alive.current && operationGeneration === loadGeneration.current;
    setBusy(true);
    setError("");
    let objectUrl = "";
    try {
      const context = await loadKnowledgeEditorContext();
      if (!context.can_create && !context.can_edit)
        throw new KnowledgeEditorApiError("forbidden");
      const currentCapability = await loadKnowledgeLifecycleCapabilities();
      if (!currentCapability.knowledgeMediaCleanup)
        throw new KnowledgeEditorApiError("knowledge_media_cleanup_unavailable");
      const prepared = await prepareKnowledgeImage(file);
      objectUrl = prepared.previewUrl;
      if (!currentOperation()) return;
      const uploaded = await uploadKnowledgeImage(file);
      if (!currentOperation()) return;
      const previous = document.blocks.find((b) => b.id === insertion.replace);
      const block: KnowledgeBlock = {
        id: previous?.id || crypto.randomUUID(),
        type: "image",
        mediaId: uploaded.media.id,
        storagePath: uploaded.media.storage_path,
        legacySrc: null,
        width: uploaded.media.width,
        height: uploaded.media.height,
        name: uploaded.media.original_name,
        alt: previous?.type === "image" ? previous.alt : "",
        caption: previous?.type === "image" ? previous.caption : "",
      };
      const next = insertion.replace
        ? {
            ...document,
            blocks: document.blocks.map((b) =>
              b.id === insertion.replace ? block : b,
            ),
          }
        : insertKnowledgeBlock(document, block, insertion.after);
      change(validateKnowledgeArticle(next, { requireTitle: false }));
      setUrls((current) => ({ ...current, [block.id]: uploaded.signed_url }));
      if (!uploaded.signed_url)
        setMessage(
          "Картинка загружена. Предпросмотр временно недоступен; статью можно сохранить.",
        );
    } catch (e) {
      if (currentOperation()) setError(knowledgeErrorMessage(e));
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (currentOperation()) setBusy(false);
    }
  }
  async function save() {
    if (!document || busy || !canUseEditor) return;
    const operationGeneration = loadGeneration.current;
    const currentOperation = () =>
      alive.current && operationGeneration === loadGeneration.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (document.status === "archived" && originalStatus.current !== "archived")
        throw new KnowledgeEditorApiError("knowledge_lifecycle_action_required");
      const normalized = validateKnowledgeArticle(document);
      const context = await loadKnowledgeEditorContext();
      if (
        !(document.revision === 0 ? context.can_create : context.can_edit) ||
        ((document.revision === 0
          ? document.status !== "draft"
          : document.status !== originalStatus.current) &&
          !context.can_publish)
      )
        throw new KnowledgeEditorApiError("forbidden");
      if (!currentOperation()) return;
      const saved = await saveKnowledgeArticle(normalized, document.revision);
      if (!currentOperation()) return;
      originalStatus.current = normalized.status;
      setDocument({ ...normalized, revision: saved.revision });
      setDirty(false);
      setMessage("Статья сохранена на сервере.");
      invalidateKnowledgeArticles();
    } catch (e) {
      if (currentOperation()) setError(knowledgeErrorMessage(e));
    } finally {
      if (currentOperation()) setBusy(false);
    }
  }
  const [uploadIndicatorVisible, setUploadIndicatorVisible] = useState(false);
  useEffect(() => {
    if (!busy) setUploadIndicatorVisible(false);
  }, [busy]);
  return <section className="bf-article-editor bf-editor-page" aria-busy={busy || (canUseEditor && loading)}>
    <WarmBack to={articleId ? `/knowledge/${encodeURIComponent(articleId)}` : "/knowledge/manage"} label={articleId ? "К статье" : "К редактору знаний"} />
    <WarmTitle title={document && document.revision > 0 ? "Редактор статьи" : "Новая статья"} />
    {access.status === "loading" && <p role="status">Проверяем доступ…</p>}
    {(access.status === "denied" || access.status === "allowed" && !canUseEditor) && <p role="alert">Нет разрешения на эту операцию.</p>}
    {access.status === "error" && <p role="alert">Не удалось проверить доступ к редактору. Проверьте соединение и вернитесь в раздел «Знания».</p>}
    {error && <p className="bf-error" role="alert">{error}</p>}
    {canUseEditor && loading && <p role="status">Загружаем статью…</p>}
    {canUseEditor && !loading && !document && <Button onClick={() => void load()}>Повторить загрузку</Button>}
    {canUseEditor && !loading && document && <>
      {knowledgeSource === "legacy" && <p className="bf-knowledge-editor-notice">Сохранённые изменения появятся в общем разделе после завершения переноса материалов. Предпросмотр доступен здесь.</p>}
      <form className="bf-material-editor bf-compact-form" onSubmit={e => {e.preventDefault(); void save();}}>
        <fieldset disabled={busy} className="bf-knowledge-editor-fields">
          <label className="bf-field" htmlFor="article-title">Название<Input id="article-title" value={document.title} maxLength={240} onChange={e => change({...document, title: e.target.value})} /></label>
          <div className="bf-editor-pair">
            <label className="bf-field">Тема<Input value={document.category} maxLength={80} onChange={e => change({...document, category: e.target.value})} /></label>
            <label className="bf-field">Публикация<select disabled={!access.canPublish || busy} value={document.status} onChange={e => change({...document, status: e.target.value as KnowledgeArticleDocument["status"]})}>
              <option value="published">Опубликована</option><option value="draft">Черновик</option>{originalStatus.current === "archived" && <option value="archived">Архив</option>}
            </select></label>
          </div>
          <details className="bf-editor-details"><summary>Краткое описание</summary><label className="bf-field" htmlFor="article-description"><span className="sr-only">Краткое описание</span><textarea id="article-description" value={document.description} maxLength={1000} rows={2} onChange={e => change({...document, description: e.target.value})} /></label></details>
          <div className="bf-bank-actions"><Button type="button" aria-pressed={preview} onClick={() => setPreview(v => !v)}>{preview ? "К блокам" : "Предпросмотр"}</Button>{document.revision > 0 && document.status === "published" && knowledgeSource === "supabase" && <Button asChild><Link to={`/knowledge/${encodeURIComponent(document.id)}`}>Открыть статью</Link></Button>}</div>
          {preview ? <><h2>{document.title || "Без заголовка"}</h2><KnowledgeDocumentView document={document} previews={urls} /></> : <section className="bf-editor-section" aria-label="Содержание статьи">
            <div className="bf-article-blocks bf-editor-content">
              {document.blocks.map((block, index) => <EditorBlock key={`${block.id}:${document.revision}`} block={block} index={index} count={document.blocks.length} preview={urls[block.id]} disabled={busy} mediaAvailable={capability.knowledgeMediaCleanup} underlineAvailable={capability.knowledgeUnderline} onChange={updateBlock}
                onMove={delta => {change(moveKnowledgeBlock(document, block.id, delta)); requestAnimationFrame(() => window.document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] [data-block-focus]`)?.focus());}}
                onRemove={() => {if (block.type === "image" && !capability.knowledgeMediaCleanup) return; if (document.blocks.length > 1) setConfirmation({title: "Убрать блок?", body: "Фрагмент будет удалён из статьи после сохранения.", run: () => change({...document, blocks: document.blocks.filter(b => b.id !== block.id)})});}}
                onReplace={() => chooseImage(null, block.id)} />)}
            </div>
            <AddContentMenu disabled={busy || document.blocks.length >= 200} mediaAvailable={capability.knowledgeMediaCleanup} onAdd={(type, level) => add(type, document.blocks.at(-1)?.id ?? null, level)} onPhoto={() => chooseImage(document.blocks.at(-1)?.id ?? null)} />
            {(!capability.knowledgeUnderline || !capability.knowledgeMediaCleanup) && <p className="bf-knowledge-editor-notice">{!capability.knowledgeUnderline ? "Подчёркивание станет доступно после обновления сервера. " : ""}{!capability.knowledgeMediaCleanup ? "Изменение картинок станет доступно после подключения очистки файлов." : ""}</p>}
            {document.blocks.length >= 180 && <p role="status">Осталось {200 - document.blocks.length} элементов.</p>}
          </section>}
        </fieldset>
        <p role="status" className="bf-knowledge-editor-status">{message || (dirty ? "Есть несохранённые изменения" : document.revision ? "Нет несохранённых изменений" : "Новый черновик")}</p>
        {error && document.revision > 0 && <Button type="button" disabled={busy} onClick={() => {
          if (!dirty) void load(); else setConfirmation({title: "Загрузить серверную версию?", body: "Несохранённые изменения будут потеряны.", run: () => void load()});
        }}>Загрузить серверную версию</Button>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Подождите…" : "Сохранить статью"}</Button>
      </form>
      <KnowledgeMaterialActions document={document} disabled={busy || dirty} onSaved={next => {originalStatus.current = next.status; setDocument(next); setDirty(false); setMessage("Статья и связанные вопросы помещены в архив.");}} />
    </>}
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => {const file = e.target.files?.[0]; if (file) {setUploadIndicatorVisible(true); void upload(file);}}} />
    {uploadIndicatorVisible && <div className="bf-knowledge-upload-status" role="status" aria-live="polite"><WarmIcon name="clock" /><span>Загружаем изображение…</span></div>}
    {confirmation && <WarmDialog title={confirmation.title} confirm onClose={() => setConfirmation(null)}><p>{confirmation.body}</p><div className="bf-bank-actions"><Button type="button" onClick={() => setConfirmation(null)}>Отмена</Button><Button type="button" variant="danger" onClick={() => {confirmation.run(); setConfirmation(null);}}>Продолжить</Button></div></WarmDialog>}
    {blocker.state === "blocked" && <WarmDialog title="Покинуть редактор?" confirm onClose={() => {if (blocker.state === "blocked") blocker.reset();}}><p>{busy ? "Операция ещё выполняется." : "Есть несохранённые изменения."} Можно остаться и сохранить изменения или выйти без сохранения.</p><div className="bf-bank-actions"><Button type="button" onClick={() => {if (blocker.state === "blocked") blocker.reset();}}>Остаться</Button><Button type="button" variant="danger" onClick={() => {if (blocker.state === "blocked") blocker.proceed();}}>Выйти без сохранения</Button></div></WarmDialog>}
  </section>;
}
