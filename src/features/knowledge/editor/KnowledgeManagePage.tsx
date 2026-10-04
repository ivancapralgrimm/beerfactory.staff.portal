import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  loadKnowledgeEditorArticles,
  type KnowledgeEditorSummary,
} from "./knowledge-editor-api";
import { useKnowledgeEditorAccess } from "./use-editor-access";
import { knowledgeErrorMessage } from "./knowledge-errors";

export function KnowledgeManagePage() {
  const access = useKnowledgeEditorAccess();
  const [articles, setArticles] = useState<KnowledgeEditorSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!access.hasEditorAccess) return;
    let active = true;
    setLoading(true);
    setError("");
    loadKnowledgeEditorArticles()
      .then((items) => {
        if (active) setArticles(items);
      })
      .catch((e) => {
        if (active) setError(knowledgeErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [access.hasEditorAccess, attempt]);
  return (
    <section className="pb-6">
      <Button asChild variant="ghost">
        <Link to="/knowledge">Знания</Link>
      </Button>
      <h1 className="mt-4 text-[28px] font-black">Управление статьями</h1>
      {access.status === "loading" && (
        <p role="status" className="mt-4">
          Проверяем доступ…
        </p>
      )}
      {access.status === "denied" && (
        <p role="alert" className="mt-4">
          Нет доступа к управлению статьями.
        </p>
      )}
      {access.status === "error" && (
        <p role="alert" className="mt-4">
          Не удалось проверить доступ. Попробуйте позже.
        </p>
      )}
      {access.hasEditorAccess && (
        <>
          {access.canCreate && (
            <Button asChild variant="primary" className="mt-4">
              <Link to="/knowledge/new">Новая статья</Link>
            </Button>
          )}
          {loading && (
            <p role="status" className="mt-4">
              Загружаем статьи…
            </p>
          )}
          {error && (
            <div className="mt-4">
              <p role="alert">{error}</p>
              <Button className="mt-3" onClick={() => setAttempt((v) => v + 1)}>
                Повторить
              </Button>
            </div>
          )}
          {!loading && !error && (
            <div className="mt-4">
              {articles.length ? (
                articles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--bf-line)] py-4"
                  >
                    <div className="min-w-0">
                      <h2 className="break-words font-bold">{article.title}</h2>
                      <p className="mt-1 text-xs text-[var(--bf-muted)]">
                        {article.category} ·{" "}
                        {article.status === "draft"
                          ? "Черновик"
                          : article.status === "archived"
                            ? "Архив"
                            : "Опубликована"}
                      </p>
                    </div>
                    {access.canEdit && (
                      <Button asChild>
                        <Link
                          to={`/knowledge/${encodeURIComponent(article.id)}/edit`}
                        >
                          Редактировать
                        </Link>
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p>Статей пока нет.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
