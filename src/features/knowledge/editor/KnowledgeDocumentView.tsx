import { useEffect, useState } from "react";
import type { KnowledgeArticleDocument, RichText } from "./article-model";
import { richTextSegments } from "./rich-text";
import { signKnowledgeMedia, legacyKnowledgeImage } from "./knowledge-media";
import { KnowledgeImageDialog } from "../KnowledgeImageDialog";

function normalizeTopic(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function KnowledgeRichText({ value }: { value: RichText }) {
  return richTextSegments(value).map((segment, index) => {
    let content = (
      <span className="whitespace-pre-wrap" key={index}>
        {segment.text}
      </span>
    );
    if (segment.marks.includes("bold"))
      content = <strong key={index}>{content}</strong>;
    if (segment.marks.includes("italic"))
      content = <em key={index}>{content}</em>;
    if (segment.marks.includes("highlight"))
      content = <mark key={index}>{content}</mark>;
    return content;
  });
}

export function KnowledgeDocumentView({
  document: article,
  previews = {},
}: {
  document: KnowledgeArticleDocument;
  previews?: Record<string, string>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const pathKey = JSON.stringify(
    article.blocks.flatMap((b) =>
      b.type === "image" && b.storagePath ? [b.storagePath] : [],
    ),
  );
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      signKnowledgeMedia(JSON.parse(pathKey))
        .then((next) => {
          if (active && current === generation) {
            setUrls(next);
            setBroken({});
            setFailed(false);
          }
        })
        .catch(() => {
          if (active && current === generation) {
            setUrls({});
            setFailed(true);
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 50 * 60 * 1000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathKey, attempt]);
  const topics = new Set(article.title.split(/\s*,\s*/).map(normalizeTopic));
  const headings = article.blocks.filter(
    (b) => b.type === "heading" && topics.has(normalizeTopic(b.content.text)),
  );
  return (
    <>
      {headings.length >= 2 && (
        <nav aria-label="Разделы статьи" className="mt-4 flex flex-wrap gap-2">
          {headings.map(
            (b) =>
              b.type === "heading" && (
                <button
                  key={b.id}
                  type="button"
                  className="min-h-11 rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface)] px-3 text-xs"
                  onClick={() =>
                    window.document
                      .getElementById(`knowledge-${b.id}`)
                      ?.scrollIntoView({
                        block: "start",
                        behavior: matchMedia("(prefers-reduced-motion: reduce)")
                          .matches
                          ? "auto"
                          : "smooth",
                      })
                  }
                >
                  {b.content.text}
                </button>
              ),
          )}
        </nav>
      )}
      <div className="knowledge-prose py-4 sm:py-6">
        {article.blocks.map((b) => {
          if (b.type === "paragraph")
            return (
              <p key={b.id}>
                <KnowledgeRichText value={b.content} />
              </p>
            );
          if (b.type === "heading") {
            const Heading = b.level === 3 ? "h3" : "h2";
            return (
              <Heading
                key={b.id}
                id={`knowledge-${b.id}`}
                className={
                  topics.has(normalizeTopic(b.content.text))
                    ? "knowledge-chapter"
                    : ""
                }
              >
                <KnowledgeRichText value={b.content} />
              </Heading>
            );
          }
          if (b.type === "quote")
            return (
              <aside key={b.id} className="knowledge-callout">
                <KnowledgeRichText value={b.content} />
              </aside>
            );
          if (b.type === "separator") return <hr key={b.id} />;
          if (b.type === "list") {
            const List = b.ordered ? "ol" : "ul";
            return (
              <List key={b.id}>
                {b.items.map((item, index) => (
                  <li key={index}>
                    <KnowledgeRichText value={item} />
                  </li>
                ))}
              </List>
            );
          }
          if (b.type !== "image") return null;
          const src =
            legacyKnowledgeImage(b.legacySrc) ||
            (b.storagePath ? urls[b.storagePath] : "") ||
            previews[b.id];
          return (
            <figure key={b.id} className="knowledge-figure">
              {src && !broken[src] ? (
                <button
                  type="button"
                  className="knowledge-image-button"
                  aria-label={
                    b.alt
                      ? `Открыть изображение: ${b.alt}`
                      : "Открыть изображение"
                  }
                  onClick={() => setImage({ src, alt: b.alt })}
                >
                  <img
                    src={src}
                    alt={b.alt}
                    width={b.width ?? undefined}
                    height={b.height ?? undefined}
                    loading="lazy"
                    onError={() =>
                      setBroken((current) => ({ ...current, [src]: true }))
                    }
                    className="h-auto w-full object-contain"
                  />
                </button>
              ) : (
                <p role="status">
                  {failed || (src && broken[src])
                    ? "Изображение сейчас недоступно."
                    : "Загружаем изображение…"}
                </p>
              )}
              {(b.caption || (b.legacySrc && b.alt)) && (
                <figcaption>{b.caption || b.alt}</figcaption>
              )}
            </figure>
          );
        })}
      </div>
      {(failed || Object.values(broken).some(Boolean)) && (
        <button
          type="button"
          className="min-h-11 rounded-xl border border-[var(--bf-line)] px-4"
          onClick={() => setAttempt((v) => v + 1)}
        >
          Повторить загрузку картинок
        </button>
      )}
      {image && (
        <KnowledgeImageDialog
          open
          src={image.src}
          alt={image.alt}
          onClose={() => setImage(null)}
        />
      )}
    </>
  );
}
