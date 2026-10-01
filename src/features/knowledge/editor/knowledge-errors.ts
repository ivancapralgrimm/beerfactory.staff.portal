export function knowledgeErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "article_revision_conflict")
    return "Статья изменена другим редактором. Ваш текст сохранён на экране. Скопируйте его или скачайте копию перед открытием актуальной версии.";
  if (code === "forbidden")
    return "Нет права на это действие. Ваш текст остаётся на экране. Обратитесь к администратору.";
  if (code === "article_not_found")
    return "Статья ещё не перенесена в серверное хранилище или недоступна. Чтение старых материалов остаётся доступным в разделе «Знания».";
  if (code === "knowledge_backend_unavailable")
    return "Редактор ещё не подключён к серверу. Попробуйте позже или сообщите администратору.";
  if (error instanceof Error && error.name === "KnowledgeArticleError")
    return error.message;
  return "Не удалось выполнить действие. Изменения остаются на экране. Проверьте соединение и повторите попытку.";
}
