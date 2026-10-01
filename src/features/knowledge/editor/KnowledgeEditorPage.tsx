import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Eye,
  Pencil,
  MoreHorizontal,
  Download,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
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
import { EditorMenu } from "./EditorMenu";
import { AddContentMenu } from "./AddContentMenu";

export function KnowledgeEditorPage() {
  const { articleId } = useParams();
  const access = useKnowledgeEditorAccess();
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
  const dialog = useRef<HTMLDialogElement>(null);
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
    if (blocker.state === "blocked") dialog.current?.showModal();
    else dialog.current?.close();
  }, [blocker.state]);
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
  function add(type: KnowledgeBlock["type"], after: string | null) {
    if (!document) return;
    try {
      change(insertKnowledgeBlock(document, createKnowledgeBlock(type), after));
    } catch (e) {
      setError(knowledgeErrorMessage(e));
    }
  }
  function chooseImage(after: string | null, replace?: string) {
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
  function backup() {
    if (!document) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `knowledge-${document.id.replace(/:/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  const insertion = (after: string | null) => (
    <AddContentMenu
      disabled={busy || document!.blocks.length >= 200}
      onAdd={(type) => {
        add(type, after);
        const index = after ? document!.blocks.findIndex(item => item.id === after) + 1 : 0;
        requestAnimationFrame(() => {
          window.document.querySelectorAll<HTMLElement>(".bf-editor-content [data-block-id]")[index]?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        });
      }}
      onPhoto={() => chooseImage(after)}
    />
  );
  const [uploadIndicatorVisible, setUploadIndicatorVisible] = useState(false);
  useEffect(() => {
    if (!busy) setUploadIndicatorVisible(false);
  }, [busy]);
  return (
    <section
      className="bf-article-editor mx-auto max-w-[760px] pb-6"
      aria-busy={busy || (canUseEditor && loading)}
    >
      <Button asChild variant="ghost" className="-ml-3">
        <Link to="/knowledge">
          <ArrowLeft className="size-4" />
          Знания
        </Link>
      </Button>
      <h1 className="mt-3 text-[24px] font-bold">
        {document && document.revision > 0
          ? "Редактирование статьи"
          : "Новая статья"}
      </h1>
      {access.status === "loading" && (
        <p role="status" className="mt-4">
          Проверяем доступ…
        </p>
      )}
      {(access.status === "denied" ||
        (access.status === "allowed" && !canUseEditor)) && (
        <p role="alert" className="mt-4">
          Нет разрешения на эту операцию. Сейчас доступ по умолчанию имеют
          владелец и администратор.
        </p>
      )}
      {access.status === "error" && (
        <p role="alert" className="mt-4">
          Не удалось проверить доступ к редактору. Проверьте соединение и
          вернитесь в раздел «Знания».
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="my-4 rounded-xl border border-[var(--bf-red)] p-3 text-sm"
        >
          {error}
        </p>
      )}
      {document && loadedKey.current === key && !canUseEditor && (
        <Button className="mt-3" onClick={backup}>
          Скачать несохранённую копию
        </Button>
      )}
      {!canUseEditor && message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
      {canUseEditor && loading && (
        <p role="status" className="mt-4">
          Загружаем статью…
        </p>
      )}
      {canUseEditor && !loading && !document && (
        <Button className="mt-4" onClick={() => void load()}>
          Повторить загрузку
        </Button>
      )}
      {canUseEditor && !loading && document && (
        <>
          {knowledgeSource === "legacy" && (
            <p className="mt-3 text-xs text-[var(--bf-muted)]">
              Сохранённые изменения появятся в общем разделе после завершения
              переноса материалов. Предпросмотр доступен здесь.
            </p>
          )}
          <div className="bf-editor-main-actions">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={preview}
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? (
                <Pencil aria-hidden className="size-4" />
              ) : (
                <Eye aria-hidden className="size-4" />
              )}
              {preview ? "Редактор" : "Предпросмотр"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save aria-hidden className="size-4" />
              {busy ? "Подождите…" : "Сохранить"}
            </Button>
            <EditorMenu
              label="Дополнительные действия"
              iconOnly
              trigger={<MoreHorizontal aria-hidden className="size-5" />}
              disabled={busy}
            >
              {(close) => (
                <>
                  <Button
                    role="menuitem"
                    variant="ghost"
                    onClick={() => {
                      close();
                      backup();
                    }}
                  >
                    <Download aria-hidden className="size-4" />
                    Скачать копию
                  </Button>
                  {document.revision > 0 &&
                    document.status === "published" &&
                    knowledgeSource === "supabase" && (
                      <Button asChild variant="ghost" role="menuitem">
                        <Link
                          onClick={close}
                          to={`/knowledge/${encodeURIComponent(document.id)}`}
                        >
                          <ExternalLink aria-hidden className="size-4" />
                          Открыть статью
                        </Link>
                      </Button>
                    )}
                </>
              )}
            </EditorMenu>
          </div>
          <p role="status" className="my-3 text-xs text-[var(--bf-muted)]">
            {message ||
              (dirty
                ? "Есть несохранённые изменения"
                : document.revision
                  ? "Нет несохранённых изменений"
                  : "Новый черновик")}
          </p>
          {error && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button type="button" onClick={backup}>
                <Download aria-hidden className="size-4" />
                Скачать копию
              </Button>
              {document.revision > 0 && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !dirty ||
                      confirm(
                        "Загрузить серверную версию и заменить изменения в редакторе? Перед этим можно скачать копию.",
                      )
                    )
                      void load();
                  }}
                >
                  Загрузить серверную версию
                </Button>
              )}
            </div>
          )}
          {preview ? (
            <>
              <h2 className="text-2xl font-black">
                {document.title || "Без заголовка"}
              </h2>
              <KnowledgeDocumentView document={document} previews={urls} />
            </>
          ) : (
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <label className="block text-sm">
                Заголовок
                <Input
                  id="article-title"
                  value={document.title}
                  maxLength={240}
                  className="mt-2"
                  onChange={(e) =>
                    change({ ...document, title: e.target.value })
                  }
                />
              </label>
              <div className="bf-editor-metadata">
                <label className="block text-sm">
                  Категория
                  <Input
                    value={document.category}
                    maxLength={80}
                    className="mt-2"
                    onChange={(event) =>
                      change({ ...document, category: event.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Статус
                  <select
                    aria-label="Статус"
                    disabled={!access.canPublish}
                    className="bf-editor-input mt-2"
                    value={document.status}
                    onChange={(event) =>
                      change({
                        ...document,
                        status: event.target
                          .value as KnowledgeArticleDocument["status"],
                      })
                    }
                  >
                    <option value="draft">Черновик</option>
                    <option value="published">Опубликована</option>
                    <option value="archived">Архив</option>
                  </select>
                </label>
              </div>
              <details className="bf-editor-details">
                <summary>Параметры статьи</summary>
                <label className="mt-2 block text-sm">
                  Краткое описание
                  <textarea
                    id="article-description"
                    aria-label="Краткое описание"
                    className="bf-editor-input mt-2"
                    value={document.description}
                    maxLength={1000}
                    rows={2}
                    onChange={(event) =>
                      change({ ...document, description: event.target.value })
                    }
                  />
                </label>
              </details>
              <div className="bf-editor-content-help">
                <p>
                  Добавляйте текст и фотографии в нужном порядке. Дополнительные
                  элементы находятся в меню +.
                </p>
                <p className="mt-1 text-xs">
                  Выделите часть текста, затем выберите формат.
                </p>
                {document.blocks.length >= 180 && (
                  <p role="status" className="mt-2">
                    Статья почти достигла максимального объёма: осталось{" "}
                    {200 - document.blocks.length} элементов.
                  </p>
                )}
              </div>
              <div className="bf-editor-content">
                {insertion(null)}
                {document.blocks.map((block, index) => (
                  <div key={block.id}>
                    <EditorBlock
                      block={block}
                      index={index}
                      count={document.blocks.length}
                      preview={urls[block.id]}
                      disabled={busy}
                      onChange={updateBlock}
                      onMove={(delta) =>
                        change(moveKnowledgeBlock(document, block.id, delta))
                      }
                      onRemove={() => {
                        if (
                          document.blocks.length > 1 &&
                          confirm("Удалить этот фрагмент статьи?")
                        )
                          change({
                            ...document,
                            blocks: document.blocks.filter(
                              (b) => b.id !== block.id,
                            ),
                          });
                      }}
                      onReplace={() => chooseImage(null, block.id)}
                    />
                    {insertion(block.id)}
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setUploadIndicatorVisible(true);
            void upload(file);
          }
        }}
      />
      {uploadIndicatorVisible && (
        <div
          className="bf-editor-upload-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="bf-editor-upload-status-card">
            <LoaderCircle
              aria-hidden
              className="size-7 shrink-0 animate-spin text-[var(--bf-copper-hi)]"
            />
            <span>
              <strong>Загружаем изображение…</strong>
              <small>Не закрывайте страницу</small>
            </span>
          </div>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="unsaved-title"
        className="m-auto w-[min(92vw,440px)] rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-bg)] p-5 text-[var(--bf-cream)]"
        onCancel={(e) => {
          e.preventDefault();
          if (blocker.state === "blocked") blocker.reset();
        }}
      >
        <h2 id="unsaved-title" className="text-xl font-bold">
          Покинуть редактор?
        </h2>
        <p className="my-4 text-sm">
          {busy ? "Операция ещё выполняется." : "Есть несохранённые изменения."}{" "}
          Можно остаться, сохранить статью или скачать копию.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            Остаться
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Выйти без сохранения
          </Button>
        </div>
      </dialog>
    </section>
  );
}
