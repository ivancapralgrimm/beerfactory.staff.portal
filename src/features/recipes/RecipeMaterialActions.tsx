import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WarmDialog } from "@/components/warm/WarmDialog";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmNotice } from "@/components/warm/WarmPage";
import { AdminRecipeApiError, deleteAdminRecipe, setAdminRecipeStatus, type RecipeMaterialLifecycleRequest } from "@/features/admin/recipe-admin-api";
import { isArchive } from "./recipe-data";
import type { Recipe } from "./types";

export const RECIPE_LIFECYCLE_UNAVAILABLE = "Архивирование и удаление пока недоступны: сервер должен поддерживать обработку связанных вопросов и билетов. Обнови рецепты и попробуй снова.";

export function recipeMutationError(error: unknown) {
  if (!(error instanceof AdminRecipeApiError)) return "Не удалось применить изменения. Проверь подключение и повтори.";
  if (["unauthorized", "admin_required"].includes(error.code)) return "Недостаточно прав для изменения рецепта.";
  if (/version|conflict|revision/.test(error.code)) return "Рецепт изменился. Обнови страницу и проверь изменения перед повтором.";
  if (/lifecycle.*unavailable|lifecycle.*required|capability/.test(error.code)) return RECIPE_LIFECYCLE_UNAVAILABLE;
  if (/photo.*cleanup/.test(error.code)) return "Изменить фото пока нельзя: сервер должен поддерживать удаление прежнего файла.";
  if (error.code === "recipe_write_response_invalid") return "Не удалось подтвердить результат сохранения. Обнови рецепты и проверь изменения перед повтором.";
  if (error.code === "recipe_write_timeout" || error.code === "recipe_write_unconfirmed") return "Сервер не подтвердил результат вовремя. Запрос мог выполниться. Обнови рецепты и проверь изменения перед повтором.";
  if (/lifecycle|operation.*pending/.test(error.code)) return "Обработка связанных материалов не завершена. Повтори действие: сохранённый запрос продолжится без дублирования.";
  return "Не удалось подтвердить изменения. Проверь подключение, обнови рецепты и попробуй ещё раз.";
}

export function RecipeLifecycleConfirm({ recipe, deleting = false, pending, onCancel, onConfirm, error }: {
  recipe: Recipe; deleting?: boolean; pending: boolean; onCancel: () => void; onConfirm: () => void; error?: string;
}) {
  return <WarmDialog title={deleting ? `Удалить «${recipe.name}» и связанные вопросы?` : `Архивировать «${recipe.name}» и связанные вопросы?`} confirm onClose={() => { if (!pending) onCancel(); }}>
    <p className="small muted">{deleting ? "Рецепт и все связанные с ним вопросы будут удалены. Это действие нельзя отменить." : "Рецепт и все связанные с ним вопросы будут перемещены в архив."} Затронутые билеты будут перераспределены. История уже пройденных попыток сохранится.</p>
    {error ? <WarmNotice error>{error}</WarmNotice> : null}
    <div className="warm-recipe-editor-actions mt-4"><Button disabled={pending} onClick={onCancel}>Отмена</Button><Button variant={deleting ? "danger" : "primary"} disabled={pending} onClick={onConfirm}>{pending ? "Выполняем…" : deleting ? "Удалить" : "Архивировать"}</Button></div>
  </WarmDialog>;
}

export function RecipeMaterialActions({ accessToken, recipe, lifecycleAvailable = false, onChanged, onDeleted }: {
  accessToken: string; recipe: Recipe; lifecycleAvailable?: boolean; onChanged: () => Promise<unknown>; onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const operation = useRef<{ kind: "archive" | "delete"; request: RecipeMaterialLifecycleRequest } | null>(null);
  const archived = isArchive(recipe);
  const editableSource = recipe.source === "bar" || recipe.source === "kitchen";
  useEffect(() => { setConfirm(null); setError(""); setMessage(""); operation.current = null; }, [recipe.id, recipe.version]);

  async function act(kind: "archive" | "delete") {
    if (pending || !editableSource) return;
    if (!lifecycleAvailable) { setError(RECIPE_LIFECYCLE_UNAVAILABLE); return; }
    if (!operation.current || operation.current.kind !== kind) {
      operation.current = { kind, request: { operationId: crypto.randomUUID(), expectedVersion: recipe.version } };
    }
    setPending(true); setError(""); setMessage("");
    try {
      if (kind === "delete") await deleteAdminRecipe(accessToken, recipe.source as "bar" | "kitchen", recipe.recordId, operation.current.request);
      else await setAdminRecipeStatus(accessToken, recipe.source as "bar" | "kitchen", recipe.recordId, "Архив", operation.current.request);
      setConfirm(null);
      await onChanged();
      if (kind === "delete") onDeleted();
      else setMessage("Рецепт и связанные вопросы перемещены в архив.");
      operation.current = null;
    } catch (cause) { setError(recipeMutationError(cause)); }
    finally { setPending(false); }
  }

  async function restore() {
    if (pending || !editableSource) return;
    setPending(true); setError(""); setMessage("");
    try {
      await setAdminRecipeStatus(accessToken, recipe.source as "bar" | "kitchen", recipe.recordId, "Актуальный");
      await onChanged();
      setMessage("Рецепт возвращён в актуальное меню. Связанные вопросы остаются в архиве.");
    } catch (cause) { setError(recipeMutationError(cause)); }
    finally { setPending(false); }
  }

  return <>
    <details className="bf-bank-question bf-content-actions warm-recipe-disclosure" key={recipe.id}>
      <summary><span className="bf-bank-question-text">Действия с материалом</span><WarmIcon name="chevron" size={18} /></summary>
      <div className="bf-bank-question-body">
        {!lifecycleAvailable ? <p className="small muted">{RECIPE_LIFECYCLE_UNAVAILABLE}</p> : null}
        {error && !confirm ? <WarmNotice error>{error}</WarmNotice> : null}
        {message ? <WarmNotice>{message}</WarmNotice> : null}
        <div className="bf-material-action-buttons">
          <Button disabled={pending || !editableSource || (!archived && !lifecycleAvailable)} onClick={() => { setError(""); if (archived) void restore(); else setConfirm("archive"); }}><WarmIcon name="archive" size={18} />{archived ? "Вернуть" : "Архив"}</Button>
          <Button variant="danger" disabled={pending || !editableSource || !lifecycleAvailable} onClick={() => { setError(""); setConfirm("delete"); }}><WarmIcon name="trash" size={18} />Удалить</Button>
        </div>
      </div>
    </details>
    {confirm ? <RecipeLifecycleConfirm recipe={recipe} deleting={confirm === "delete"} pending={pending} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void act(confirm)} /> : null}
  </>;
}
