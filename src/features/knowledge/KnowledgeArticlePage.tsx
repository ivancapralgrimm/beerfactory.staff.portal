import { WarmBack } from "@/components/warm/WarmBack";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmTitle, WarmEmpty } from "@/components/warm/WarmPage";
import { KnowledgeMaterialActions } from "./editor/KnowledgeMaterialActions";
import "./knowledge-warm.css";
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

export function KnowledgeArticlePage() {
  const { articleId = "" } = useParams();
  const requestedId = safeDecode(articleId);
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
  const editorAccess = useKnowledgeEditorAccess();
  const progress = useKnowledgeProgress(userId);
  const location = useLocation();
  const [detailAttempt, setDetailAttempt] = useState(0);
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
  }, [article?.id, article?.revision, article?.source, detailAttempt]);
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
  const sections = useMemo(
    () =>
      blocks.flatMap((block, index) => {
        const title = sectionTitle(block);
        return title
          ? [{ index, title }]
          : [];
      }),
    [blocks],
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

  const back = <WarmBack to={backTarget} label="В знания" />;
  if (state.status === "loading") return <section className="bf-knowledge-article">{back}<p role="status">Загружаем статью…</p></section>;
  if (state.status === "error") return <section className="bf-knowledge-article">{back}<WarmEmpty title="Не удалось открыть статью" body="Материалы базы знаний сейчас недоступны." /><Button onClick={() => void reload()}>Повторить</Button></section>;
  if (!article) return <section className="bf-knowledge-article">{back}<WarmEmpty title="Статья не найдена" body="Возможно, материал был перемещён или удалён." /></section>;

  return (
    <article className="bf-knowledge-article">
      {back}
      <div className="bf-article-meta">
        <span className="pill">{article.category}</span>
        <span>{article.readingMinutes} мин чтения</span>
        {read && <span className="pill"><WarmIcon name="check" size={15} />Прочитано</span>}
      </div>
      <WarmTitle title={article.title} />
        {sections.length >= 2 ? (
          <nav
            aria-label="Разделы статьи"
            className="bf-article-chapters"
          >
            {sections.map(({ index, title }) => (
              <button
                key={index}
                type="button"
                className="bf-chapter-link"
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

        {article.source === "supabase" &&
          (detail?.document ? (
            <KnowledgeDocumentView document={detail.document} />
          ) : detail?.error ? (
            <div role="alert" className="my-6">
              <p>Не удалось загрузить статью. Проверьте соединение.</p>
              <Button className="mt-3" onClick={() => setDetailAttempt(n => n + 1)}>
                Повторить
              </Button>
            </div>
          ) : (
            <p role="status" className="my-6">
              Загружаем статью…
            </p>
          ))}
        {article.source !== "supabase" && (
          <div className="knowledge-prose bf-article-document">
            {blocks.map((block, index) => {
              if (block.type === "paragraph") {
                const standaloneTitle = sectionTitle(block);
                if (
                  standaloneTitle
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
                return (
                  <h2
                    key={index}
                    id={`knowledge-section-${index}`}
                    className="knowledge-chapter"
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

      <footer className="bf-knowledge-article-footer">
        <Button type="button" variant={read ? "secondary" : "primary"} disabled={saving || read || (article.source === "supabase" && !detail?.document)} onClick={() => void markRead()}>
          <WarmIcon name="check" />{saving ? "Сохраняем…" : read ? "Прочитано" : "Отметить прочитанным"}
        </Button>
        {editorAccess.canEdit && <Button asChild><Link to={`/knowledge/${encodeURIComponent(article.id)}/edit`} state={{ from: backTarget }}><WarmIcon name="edit" />Редактировать статью</Link></Button>}
        <p role="status" aria-live="polite">{saveStatus}</p>
      </footer>
      <KnowledgeMaterialActions document={detail?.document} />
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
