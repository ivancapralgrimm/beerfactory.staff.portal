import {
  ArrowLeft,
  BookCheck,
  Share2
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Link,
  useLocation,
  useParams
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { KnowledgeImageDialog } from "@/features/knowledge/KnowledgeImageDialog";
import {
  parseKnowledgeMarkdown,
  renderKnowledgeInline
} from "@/features/knowledge/knowledge-markdown";
import { useKnowledgeArticles } from "@/features/knowledge/use-knowledge";
import { useKnowledgeProgress } from "@/features/knowledge/use-knowledge-progress";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function KnowledgeArticlePage() {
  const { articleId = "" } = useParams();
  const requestedId = safeDecode(articleId);
  const { state: auth } = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const { state, reload } = useKnowledgeArticles();
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
    [requestedId, state.articles]
  );

  const blocks = useMemo(
    () => (article ? parseKnowledgeMarkdown(article.body) : []),
    [article]
  );

  const read = article
    ? progress.state.readIds.has(article.id)
    : false;

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
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
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
          : "Отметка сохранена на этом устройстве."
      );
    } catch {
      setSaveStatus(
        "Профиль сейчас недоступен. Отметка сохранена на этом устройстве."
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
          <h1 className="text-2xl font-black">
            Не удалось открыть статью
          </h1>
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
    <article className="mx-auto max-w-[860px] pb-7">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to={backTarget}>
            <ArrowLeft className="size-4" aria-hidden />
            Знания
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--bf-line)] px-3 py-2 text-xs font-bold text-[var(--bf-muted)]">
            {article.readingMinutes} мин
          </span>
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

      <div
        role="status"
        aria-live="polite"
        className="min-h-5 text-right text-xs text-[var(--bf-muted)]"
      >
        {shareStatus}
      </div>

      <header className="mt-4 border-y border-[var(--bf-line)] py-7 sm:py-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{article.category.toUpperCase()}</span>
          {read ? (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--bf-green),transparent_65%)] px-2 text-[10px] font-bold text-[#9dd0a0]">
              <BookCheck className="size-3" aria-hidden />
              Прочитано
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 text-balance text-[clamp(36px,8vw,58px)] font-black leading-[0.96] tracking-[-0.045em]">
          {article.title}
        </h1>
      </header>

      <div className="knowledge-prose py-5 sm:py-7">
        {blocks.map((block, index) => {
          if (block.type === "paragraph") {
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
              <h2 key={index}>
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
                    alt: block.alt
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

      <footer className="border-t border-[var(--bf-line)] pt-5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={saving || read}
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
