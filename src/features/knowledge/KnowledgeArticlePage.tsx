import { ArrowLeft, BookCheck, Share2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { KnowledgeImageDialog } from "@/features/knowledge/KnowledgeImageDialog";
import {
  parseKnowledgeMarkdown,
  renderKnowledgeInline,
} from "@/features/knowledge/knowledge-markdown";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";
import { useKnowledgeEditorAccess } from "./editor/use-editor-access";
import { loadKnowledgeArticleForEditor } from "./editor/knowledge-editor-api";
import type { KnowledgeArticleDocument } from "./editor/article-model";
import { KnowledgeDocumentView } from "./editor/KnowledgeDocumentView";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sectionTitle(
  block: ReturnType<typeof parseKnowledgeMarkdown>[number],
) {
  if (block.type === "heading") return block.text;
  if (block.type !== "paragraph" || block.lines.length !== 1) return null;
  return block.lines[0].match(/^\*\*([^*]+)\*\*$/u)?.[1] ?? null;
}

function normalizeTopic(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function KnowledgeArticlePage() {
  const { articleId = "" } = useParams();
  const requestedId = safeDecode(articleId);
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
  const editorAccess = useKnowledgeEditorAccess();
  const progress = useKnowledgeProgress(userId);
  const location = useLocation();
  const [shareStatus, setShareStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeImage, setActiveImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const article = useMemo(
    () => state.articles.find((item) => item.id === requestedId),
    [requestedId, state.articles],
  );

  const [serverDetail, setServerDetail] = useState<{
    id: string;
    revision?: number;
    document: KnowledgeArticleDocument | null;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!article || article.source !== "supabase") return;
    let active = true;
    const { id, revision } = article;
    setServerDetail({ id, revision, document: null, error: false });
    void loadKnowledgeArticleForEditor(id)
      .then((document) => {
        if (document.status !== "published")
          throw new Error("article_not_published");
        if (active) setServerDetail({ id, revision, document, error: false });
      })
      .catch(() => {
        if (active)
          setServerDetail({ id, revision, document: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [article?.id, article?.revision, article?.source]);
  const detail =
    serverDetail?.id === article?.id &&
    serverDetail?.revision === article?.revision
      ? serverDetail
      : null;

  const blocks = useMemo(
    () =>
      article && article.source !== "supabase"
        ? parseKnowledgeMarkdown(article.body)
        : [],
    [article],
  );
  const titleTopics = useMemo(
    () =>
      new Set(
        (article?.title ?? "")
          .split(/\s*,\s*/u)
          .map(normalizeTopic)
          .filter(Boolean),
      ),
    [article],
  );
  const sections = useMemo(
    () =>
      blocks.flatMap((block, index) => {
        const title = sectionTitle(block);
        return title && titleTopics.has(normalizeTopic(title))
          ? [{ index, title }]
          : [];
      }),
    [blocks, titleTopics],
  );

  const read = article ? progress.state.readIds.has(article.id) : false;

  const backTarget =
    location.state &&
    typeof location.state === "object" &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/knowledge";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [requestedId]);

  async function shareArticle() {
    if (!article) return;

    const url = window.location.href;
    const title = `${article.title} · BeerFactory`;
    const text = `${article.title} · база знаний BeerFactory`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Ссылка скопирована");
    } catch {
      setShareStatus("Не удалось скопировать ссылку");
    }

    window.setTimeout(() => setShareStatus(""), 2200);
  }

  async function markRead() {
    if (!article || saving) return;

    setSaving(true);
    setSaveStatus("");

    try {
      const source = await progress.markRead(article.id);
      setSaveStatus(
        source === "profile"
          ? "Отметка сохранена в профиле."
          : "Отметка сохранена на этом устройстве.",
      );
    } catch {
      setSaveStatus(
        "Профиль сейчас недоступен. Отметка сохранена на этом устройстве.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <section className="py-3">
        <div className="h-11 w-28 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-7 h-16 w-4/5 animate-pulse rounded-xl bg-[var(--bf-surface)]" />
        <div className="mt-5 h-72 animate-pulse rounded-2xl bg-[var(--bf-surface)]" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="py-3">
        <Button asChild>
          <Link to="/knowledge">
            <ArrowLeft className="size-4" aria-hidden />
            Знания
          </Link>
        </Button>

        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <h1 className="text-2xl font-black">Не удалось открыть статью</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
            Материалы базы знаний сейчас недоступны.
          </p>
          <Button className="mt-4" onClick={reload}>
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="py-3">
        <Button asChild>
          <Link to="/knowledge">
            <ArrowLeft className="size-4" aria-hidden />
            Знания
          </Link>
        </Button>

        <div className="mt-6 border-y border-[var(--bf-line)] py-6">
          <h1 className="text-2xl font-black">Статья не найдена</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--bf-muted)]">
            Возможно, материал был перемещён или удалён.
          </p>
        </div>
      </section>
    );
  }

  return (
    <article className="knowledge-notebook mx-auto max-w-[860px]">
      <div className="knowledge-notebook-toolbar">
        <Button asChild variant="ghost" className="knowledge-notebook-back">
          <Link to={backTarget}>
            <ArrowLeft className="size-4" aria-hidden />
            Знания
          </Link>
        </Button>

        <span
          className="knowledge-wordmark"
          aria-label="BeerFactory Staff Portal"
        >
          <b>BF</b>Staff
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            aria-label="Поделиться статьёй"
            onClick={shareArticle}
          >
            <Share2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="knowledge-notebook-sheet">
        <div
          role="status"
          aria-live="polite"
          className="text-right text-xs text-[var(--bf-muted)] empty:hidden"
        >
          {shareStatus}
        </div>

        <header className="knowledge-notebook-heading">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{article.category.toUpperCase()}</span>
            <span className="knowledge-reading-time">
              {article.readingMinutes} мин чтения
            </span>
            {read ? (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-green),transparent_65%)] px-2 text-[10px] font-bold text-[#9dd0a0]">
                <BookCheck className="size-3" aria-hidden />
                Прочитано
              </span>
            ) : null}
          </div>

          <h1>{article.title}</h1>
        </header>

        {sections.length >= 2 ? (
          <nav
            aria-label="Разделы статьи"
            className="mt-4 flex flex-wrap gap-2"
          >
            {sections.map(({ index, title }) => (
              <button
                key={index}
                type="button"
                className="min-h-11 max-w-full rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-[11px] font-bold text-[var(--bf-cream)] focus-visible:outline-2 focus-visible:outline-[var(--bf-copper-hi)]"
                onClick={() =>
                  document
                    .getElementById(`knowledge-section-${index}`)
                    ?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    })
                }
              >
                {title}
              </button>
            ))}
          </nav>
        ) : null}

        {editorAccess.canEdit && (
          <div className="my-4">
            <Button asChild>
              <Link
                to={`/knowledge/${encodeURIComponent(article.id)}/edit`}
                state={{ from: backTarget }}
              >
                Редактировать статью
              </Link>
            </Button>
          </div>
        )}
        {article.source === "supabase" &&
          (detail?.document ? (
            <KnowledgeDocumentView document={detail.document} />
          ) : detail?.error ? (
            <div role="alert" className="my-6">
              <p>Не удалось загрузить статью. Проверьте соединение.</p>
              <Button className="mt-3" onClick={() => void reload()}>
                Повторить
              </Button>
            </div>
          ) : (
            <p role="status" className="my-6">
              Загружаем статью…
            </p>
          ))}
        {article.source !== "supabase" && (
          <div className="knowledge-prose py-4 sm:py-6">
            {blocks.map((block, index) => {
              if (block.type === "paragraph") {
                const standaloneTitle = sectionTitle(block);
                if (
                  standaloneTitle &&
                  titleTopics.has(normalizeTopic(standaloneTitle))
                ) {
                  return (
                    <h2
                      key={index}
                      id={`knowledge-section-${index}`}
                      className="knowledge-chapter"
                    >
                      {standaloneTitle}
                    </h2>
                  );
                }
                return (
                  <p key={index}>
                    {block.lines.map((line, lineIndex) => (
                      <Fragment key={`${line}-${lineIndex}`}>
                        {lineIndex > 0 ? <br /> : null}
                        {renderKnowledgeInline(line)}
                      </Fragment>
                    ))}
                  </p>
                );
              }

              if (block.type === "heading") {
                const chapter = titleTopics.has(normalizeTopic(block.text));
                return (
                  <h2
                    key={index}
                    id={chapter ? `knowledge-section-${index}` : undefined}
                    className={chapter ? "knowledge-chapter" : undefined}
                  >
                    {renderKnowledgeInline(block.text)}
                  </h2>
                );
              }

              if (block.type === "callout") {
                return (
                  <aside key={index} className="knowledge-callout">
                    {renderKnowledgeInline(block.text)}
                  </aside>
                );
              }

              if (block.type === "separator") {
                return <hr key={index} />;
              }

              if (block.type === "list") {
                const List = block.ordered ? "ol" : "ul";

                return (
                  <List key={index}>
                    {block.items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>
                        {renderKnowledgeInline(item)}
                      </li>
                    ))}
                  </List>
                );
              }

              return (
                <figure key={index} className="knowledge-figure">
                  <button
                    type="button"
                    className="knowledge-image-button"
                    aria-label={
                      block.alt
                        ? `Открыть изображение: ${block.alt}`
                        : "Открыть изображение"
                    }
                    onClick={() =>
                      setActiveImage({
                        src: block.src,
                        alt: block.alt,
                      })
                    }
                  >
                    <img
                      src={block.src}
                      alt={block.alt}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </button>
                  {block.alt ? <figcaption>{block.alt}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        )}

        <footer className="knowledge-notebook-footer">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={
                saving ||
                read ||
                (article.source === "supabase" && !detail?.document)
              }
              onClick={markRead}
            >
              <BookCheck className="size-4" aria-hidden />
              {saving
                ? "Сохраняем…"
                : read
                  ? "Прочитано ✓"
                  : "Отметить прочитанным"}
            </Button>

            <Button asChild>
              <Link to="/attestation">Проверить знания</Link>
            </Button>
          </div>

          <p
            className="mt-3 min-h-5 text-xs leading-5 text-[var(--bf-muted)]"
            role="status"
            aria-live="polite"
          >
            {saveStatus}
          </p>
        </footer>
      </div>
      <div className="knowledge-notebook-trim" aria-hidden />
      {activeImage ? (
        <KnowledgeImageDialog
          open
          src={activeImage.src}
          alt={activeImage.alt}
          onClose={() => setActiveImage(null)}
        />
      ) : null}
    </article>
  );
}
