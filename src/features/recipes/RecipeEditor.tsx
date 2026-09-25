import {
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode
} from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  AdminRecipeApiError,
  createAdminRecipe,
  updateAdminRecipe,
  type AdminRecipeInput,
  type AdminRecipeSource,
  type AdminRecipeStatus
} from "@/features/admin/recipe-admin-api";
import {
  categoryLabel,
  recipeStatusKind
} from "@/features/recipes/recipe-data";
import type { Recipe } from "@/features/recipes/types";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const DEFAULT_BAR_CATEGORIES = [
  "Лимонад",
  "Заготовка",
  "Коктейль",
  "Настойка"
];
const STATUS_OPTIONS: AdminRecipeStatus[] = ["Актуальный", "Архив"];

type EditorMode = "create" | "edit";

type RecipeEditorProps = {
  accessToken: string;
  mode: EditorMode;
  recipe?: Recipe;
  recipes: Recipe[];
  onCancel: () => void;
  onSaved: (recipeId: string) => void | Promise<void>;
};

function emptyEditor(): AdminRecipeInput {
  return {
    source: "bar",
    name: "",
    category: "Лимонад",
    status: "Актуальный",
    venue: "BF",
    description: "",
    ingredients: "",
    method: "",
    serving: "",
    tags: "",
    changeNote: "",
    removePhoto: false
  };
}

function editorFromRecipe(recipe: Recipe): AdminRecipeInput {
  const source: AdminRecipeSource =
    recipe.source === "kitchen" ? "kitchen" : "bar";

  return {
    source,
    name: recipe.name,
    category:
      source === "bar"
        ? recipe.category.trim() || "Лимонад"
        : "Кухня",
    status:
      recipeStatusKind(recipe.status) === "archive"
        ? "Архив"
        : "Актуальный",
    venue: recipe.venue || "BF",
    description:
      source === "kitchen"
        ? recipe.method || recipe.desc || ""
        : "",
    ingredients: recipe.ingredients.join("\n"),
    method: source === "bar" ? recipe.method : "",
    serving: recipe.serving,
    tags: recipe.tags.join(" "),
    changeNote: "",
    removePhoto: false
  };
}

function sourceLabel(source: AdminRecipeSource) {
  return source === "kitchen" ? "Кухня" : "Бар";
}

function recipeErrorText(error: unknown) {
  if (!(error instanceof AdminRecipeApiError)) {
    return "Не удалось сохранить рецепт.";
  }

  switch (error.code) {
    case "unauthorized":
    case "admin_required":
      return "Недостаточно прав для изменения рецептов.";
    case "recipe_admin_write_unavailable":
      return "Запись рецептов на сервере сейчас недоступна.";
    case "worker_recipe_editor_unavailable":
      return "Редактор установлен, но серверная часть ещё не обновлена.";
    case "invalid_source":
      return "Выбран неизвестный раздел рецептов.";
    case "invalid_name":
      return "Укажите название рецепта.";
    case "invalid_category":
      return "Выберите категорию.";
    case "ingredients_required":
      return "Для бара обязательно заполните состав.";
    case "description_required":
      return "Для кухни обязательно заполните описание.";
    case "invalid_status":
      return "Выбран неизвестный статус.";
    case "invalid_venue":
      return "Выберите заведение BF или BB.";
    case "photo_too_large":
      return "Фото больше 1 МБ.";
    case "photo_type_not_allowed":
      return "Фото должно быть JPEG или PNG.";
    case "nocodb_photo_upload_failed":
      return "NocoDB не принял фотографию.";
    case "nocodb_write_failed":
      return "NocoDB не сохранил рецепт.";
    default:
      return "Изменение не применено. Проверьте поля и повторите.";
  }
}

function fieldClass(invalid = false) {
  return cn(
    "min-h-11 w-full rounded-xl border bg-[var(--bf-surface-2)] px-3 text-sm text-[var(--bf-cream)] outline-none placeholder:text-[var(--bf-dim)] focus-visible:ring-2 focus-visible:ring-[var(--bf-copper-hi)]",
    invalid ? "border-[var(--bf-red)]" : "border-[var(--bf-line)]"
  );
}

function FieldLabel({
  children,
  required = false
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-xs font-black text-[var(--bf-cream)]">
      {children}
      {required ? (
        <span className="ml-1 text-[var(--bf-copper-hi)]" aria-hidden>*</span>
      ) : null}
    </span>
  );
}

export function RecipeEditor({
  accessToken,
  mode,
  recipe,
  recipes,
  onCancel,
  onSaved
}: RecipeEditorProps) {
  const [editor, setEditor] = useState<AdminRecipeInput>(() =>
    mode === "edit" && recipe ? editorFromRecipe(recipe) : emptyEditor()
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditor(mode === "edit" && recipe ? editorFromRecipe(recipe) : emptyEditor());
    setFormError(null);
    setPhotoError(null);
    setPhoto(null);
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }, [mode, recipe]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const barCategories = useMemo(() => {
    const fromData = recipes
      .filter((item) => item.source === "bar")
      .map((item) => item.category.trim())
      .filter(Boolean)
      .map((value) => /^лимонад$/i.test(value) ? "Лимонад" : value);

    return Array.from(new Set([...DEFAULT_BAR_CATEGORIES, ...fromData]))
      .sort((a, b) => a.localeCompare(b, "ru"));
  }, [recipes]);

  const activePhoto =
    photoPreview ||
    (mode === "edit" && recipe && !editor.removePhoto ? recipe.photo : "") ||
    null;

  function resetPhoto() {
    setPhoto(null);
    setPhotoError(null);
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }

  function updateEditor<K extends keyof AdminRecipeInput>(
    key: K,
    value: AdminRecipeInput[K]
  ) {
    setEditor((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function changeSource(source: AdminRecipeSource) {
    if (mode === "edit") return;

    setEditor((current) => ({
      ...current,
      source,
      category: source === "bar" ? barCategories[0] || "Лимонад" : "Кухня"
    }));
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    if (!PHOTO_TYPES.has(file.type)) {
      setPhotoError("Только JPEG или PNG.");
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Фото должно быть не больше 1 МБ.");
      return;
    }

    resetPhoto();
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
    updateEditor("removePhoto", false);
  }

  function removeCurrentPhoto() {
    resetPhoto();
    updateEditor("removePhoto", true);
  }

  function validate() {
    if (!editor.name.trim()) return "Укажите название.";
    if (!editor.category.trim()) return "Выберите категорию.";
    if (editor.source === "bar" && !editor.ingredients.trim()) {
      return "Для бара обязательно заполните состав.";
    }
    if (editor.source === "kitchen" && !editor.description.trim()) {
      return "Для кухни обязательно заполните описание.";
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = mode === "create"
        ? await createAdminRecipe(accessToken, editor, photo)
        : await updateAdminRecipe(
            accessToken,
            recipe?.recordId || "",
            editor,
            photo
          );

      await onSaved(result.id);
    } catch (error) {
      setFormError(recipeErrorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            {mode === "create" ? "НОВЫЙ РЕЦЕПТ" : "РЕДАКТИРОВАНИЕ"}
          </p>
          <h2 className="mt-1 truncate text-xl font-black">
            {mode === "create" ? "Создать техкарту" : recipe?.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Закрыть редактор"
          disabled={saving}
          onClick={onCancel}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-4 disabled:opacity-70">
          <div>
            <FieldLabel required>Раздел</FieldLabel>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Раздел рецепта">
              {(["bar", "kitchen"] as AdminRecipeSource[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  disabled={mode === "edit"}
                  aria-pressed={editor.source === source}
                  onClick={() => changeSource(source)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-black",
                    editor.source === source
                      ? "border-[var(--bf-copper-hi)] bg-[var(--bf-surface-2)] text-[var(--bf-cream)]"
                      : "border-[var(--bf-line)] bg-[var(--bf-surface)] text-[var(--bf-muted)]",
                    mode === "edit" && "cursor-not-allowed opacity-70"
                  )}
                >
                  {sourceLabel(source)}
                </button>
              ))}
            </div>
          </div>

          <label>
            <FieldLabel required>Название</FieldLabel>
            <input
              value={editor.name}
              maxLength={180}
              onChange={(event) => updateEditor("name", event.target.value)}
              className={fieldClass()}
              placeholder="Название позиции"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <FieldLabel required>Категория</FieldLabel>
              <select
                value={editor.category}
                onChange={(event) => updateEditor("category", event.target.value)}
                className={fieldClass()}
                required
              >
                {editor.source === "bar" ? (
                  barCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))
                ) : (
                  <option value="Кухня">Кухня</option>
                )}
              </select>
            </label>

            <label>
              <FieldLabel required>Заведение</FieldLabel>
              <select
                value={editor.venue}
                onChange={(event) => updateEditor(
                  "venue",
                  event.target.value === "BB" ? "BB" : "BF"
                )}
                className={fieldClass()}
              >
                <option value="BF">BeerFactory · BF</option>
                <option value="BB">BeerBistro · BB</option>
              </select>
            </label>
          </div>

          <label>
            <FieldLabel>Статус</FieldLabel>
            <select
              value={editor.status}
              onChange={(event) => updateEditor(
                "status",
                event.target.value as AdminRecipeStatus
              )}
              className={fieldClass()}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <div>
            <FieldLabel>Фото</FieldLabel>
            <div className="overflow-hidden rounded-2xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
              {activePhoto ? (
                <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--bf-line)]">
                  <img
                    src={activePhoto}
                    alt="Предпросмотр фото рецепта"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="grid min-h-24 place-items-center text-[var(--bf-dim)]">
                  <ImagePlus className="size-7" aria-hidden />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-xs font-black text-[var(--bf-cream)]">
                    JPEG или PNG · до 1 МБ
                  </p>
                  {photo ? (
                    <p className="mt-1 max-w-[210px] truncate text-[10px] text-[var(--bf-dim)]">
                      {photo.name}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  {activePhoto ? (
                    <Button type="button" variant="ghost" onClick={removeCurrentPhoto}>
                      <Trash2 className="size-4" aria-hidden />
                      Убрать
                    </Button>
                  ) : null}

                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--bf-line-strong)] bg-[var(--bf-surface)] px-3 text-xs font-black text-[var(--bf-cream)]">
                    <ImagePlus className="size-4" aria-hidden />
                    {activePhoto ? "Заменить" : "Добавить"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={choosePhoto}
                    />
                  </label>
                </div>
              </div>
            </div>
            {photoError ? (
              <p className="mt-1.5 text-xs font-bold text-[#e99990]" role="alert">
                {photoError}
              </p>
            ) : null}
          </div>

          {editor.source === "bar" ? (
            <>
              <label>
                <FieldLabel required>Состав</FieldLabel>
                <textarea
                  value={editor.ingredients}
                  rows={7}
                  onChange={(event) => updateEditor("ingredients", event.target.value)}
                  className={cn(fieldClass(), "resize-y py-3 leading-5")}
                  placeholder={'Каждый ингредиент с новой строки\nНапример: Джин 40 мл'}
                  required
                />
              </label>

              <label>
                <FieldLabel>Приготовление / метод</FieldLabel>
                <textarea
                  value={editor.method}
                  rows={5}
                  onChange={(event) => updateEditor("method", event.target.value)}
                  className={cn(fieldClass(), "resize-y py-3 leading-5")}
                  placeholder="Как приготовить"
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <FieldLabel required>Описание</FieldLabel>
                <textarea
                  value={editor.description}
                  rows={6}
                  onChange={(event) => updateEditor("description", event.target.value)}
                  className={cn(fieldClass(), "resize-y py-3 leading-5")}
                  placeholder="Описание блюда / технология"
                  required
                />
              </label>

              <label>
                <FieldLabel>Состав</FieldLabel>
                <textarea
                  value={editor.ingredients}
                  rows={5}
                  onChange={(event) => updateEditor("ingredients", event.target.value)}
                  className={cn(fieldClass(), "resize-y py-3 leading-5")}
                  placeholder="Состав блюда"
                />
              </label>
            </>
          )}

          <label>
            <FieldLabel>
              {editor.source === "kitchen" ? "Граммовка / выход" : "Подача / выход"}
            </FieldLabel>
            <input
              value={editor.serving}
              onChange={(event) => updateEditor("serving", event.target.value)}
              className={fieldClass()}
              placeholder={editor.source === "kitchen" ? "Например: 250 г" : "Например: 350 мл"}
            />
          </label>

          <label>
            <FieldLabel>Теги</FieldLabel>
            <input
              value={editor.tags}
              onChange={(event) => updateEditor("tags", event.target.value)}
              className={fieldClass()}
              placeholder="Через пробел или запятую"
            />
          </label>

          {mode === "edit" ? (
            <label>
              <FieldLabel>Что изменилось</FieldLabel>
              <input
                value={editor.changeNote}
                onChange={(event) => updateEditor("changeNote", event.target.value)}
                className={fieldClass()}
                placeholder="Коротко, необязательно"
              />
            </label>
          ) : null}
        </fieldset>

        {formError ? (
          <div
            className="rounded-xl border border-[#75443d] bg-[#36231f80] px-3 py-2 text-xs font-bold leading-5 text-[#e99990]"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving || Boolean(photoError)}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : mode === "create" ? (
              <Plus className="size-4" aria-hidden />
            ) : (
              <Pencil className="size-4" aria-hidden />
            )}
            {saving
              ? "Сохраняем…"
              : mode === "create"
                ? "Создать рецепт"
                : "Сохранить изменения"}
          </Button>
        </div>
      </form>
    </Surface>
  );
}
